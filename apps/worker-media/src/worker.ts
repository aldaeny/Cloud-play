/**
 * Media transcoding worker for Aether/Cloud Play
 *
 * Processes media assets through the transcoding pipeline:
 * 1. Download source video from MinIO/S3
 * 2. FFmpeg transcode to HLS segments (multiple resolutions) + thumbnails
 * 3. Upload output to MinIO/S3
 * 4. Update MediaAsset + TranscodeJob in database
 */

import { NestFactory } from '@nestjs/core';
import { Module, Logger, Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { Queue, Worker, WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { spawn, ChildProcess } from 'child_process';
import { mkdirSync, createWriteStream, existsSync, rmSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { createReadStream, readdirSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { tmpdir } from 'os';

@Injectable()
class MediaProcessor {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async processTranscode(mediaAssetId: string, transcodeJobId?: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
    });

    if (!asset) {
      throw new Error(`MediaAsset ${mediaAssetId} not found`);
    }

    // Use the durable database job when dispatched from the API; manual jobs
    // receive their own record for diagnostics.
    const job = transcodeJobId
      ? await this.prisma.transcodeJob.update({where: {id: transcodeJobId}, data: {status: 'PROCESSING', error: null}})
      : await this.prisma.transcodeJob.create({data: {mediaAssetId: asset.id, status: 'PROCESSING', progress: 0}});
    if (job.mediaAssetId !== asset.id) throw new Error('Transcode job asset mismatch');

    this.logger.log(`Starting transcode job ${job.id} for asset ${asset.id}`);

    const outputDir = join(tmpdir(), `aether-transcode-${asset.id}`);
    try {
      // Update asset status
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'PROCESSING' },
      });

      // Determine output directory
      mkdirSync(outputDir, { recursive: true });

      const sourcePath = join(outputDir, 'source.mp4');
      const storage = this.storageClient();
      const bucket = this.config.get<string>('STORAGE_BUCKET') || 'cloudplay-video';
      const source = await storage.send(new GetObjectCommand({Bucket: bucket, Key: asset.sourceKey}));
      if (!source.Body) throw new Error('Source object has no body');
      await pipeline(source.Body as Readable, createWriteStream(sourcePath));
      const sourceSize = await this.probeDimensions(sourcePath);

      // Run FFmpeg transcode for multiple resolutions (Adaptive Bitrate)
      const resolutions = [
        { name: '1080p', width: 1920, height: 1080, bitrate: '5000k' },
        { name: '720p', width: 1280, height: 720, bitrate: '2500k' },
        { name: '480p', width: 854, height: 480, bitrate: '1000k' },
        { name: '360p', width: 640, height: 360, bitrate: '700k' },
      ].filter(r => r.height <= sourceSize.height).map(r => {
        const factor = Math.min(r.width / sourceSize.width, r.height / sourceSize.height, 1);
        return { ...r, width: Math.floor(sourceSize.width * factor / 2) * 2, height: Math.floor(sourceSize.height * factor / 2) * 2 };
      }).filter(r => r.width >= 2 && r.height >= 2);
      if (resolutions.length === 0) throw new Error('Source must be at least 360 pixels high');

      // Generate master playlist
      const masterPlaylist = join(outputDir, 'master.m3u8');

      for (const res of resolutions) {
        const variantDir = join(outputDir, res.name);
        mkdirSync(variantDir, { recursive: true });

        const playlistPath = join(variantDir, 'playlist.m3u8');

        await this.runFFmpeg(
          [
            '-i', sourcePath,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-vf', `scale=${res.width}:${res.height},setsar=1`,
            '-b:v', res.bitrate,
            '-maxrate', res.bitrate,
            '-bufsize', '2M',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ac', '2',
            '-force_key_frames', 'expr:gte(t,n_forced*6)',
            '-sc_threshold', '0',
            '-hls_time', '6',
            '-hls_flags', 'independent_segments',
            '-hls_playlist_type', 'vod',
            '-hls_segment_filename', join(variantDir, 'segment_%05d.ts'),
            playlistPath,
          ],
          outputDir,
          res.name,
        );

        // Update progress
        const progress = Math.floor((resolutions.indexOf(res) + 1) / resolutions.length * 90);
        await this.prisma.transcodeJob.update({
          where: { id: job.id },
          data: { progress },
        });
      }

      // Generate master playlist referencing all variants
      this.generateMasterPlaylist(resolutions, masterPlaylist);

      // Generate thumbnails
      await this.generateThumbnails(sourcePath, join(outputDir, 'thumbnails'), outputDir);

      // Publish all outputs before marking the DB job complete.
      for (const file of this.filesIn(outputDir)) {
        if (file === sourcePath) continue;
        const key = `hls/${asset.id}/${relative(outputDir, file).split('\\').join('/')}`;
        const type = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : file.endsWith('.ts') ? 'video/mp2t' : 'image/jpeg';
        await storage.send(new PutObjectCommand({Bucket: bucket, Key: key, Body: createReadStream(file), ContentType: type}));
      }
      // Update media asset with HLS manifest key
      const hlsManifestKey = `hls/${asset.id}/master.m3u8`;
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          hlsManifestKey,
          status: 'ACTIVE',
        },
      });

      // Complete transcode job
      await this.prisma.transcodeJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', progress: 100 },
      });

      this.logger.log(`Transcoding complete for ${asset.id}. HLS manifest: ${hlsManifestKey}`);

    } catch (err: any) {
      this.logger.error(`Transcoding failed for ${asset.id}: ${err.message}`);

      // Update job with error
      await this.prisma.transcodeJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: err.message },
      });

      // Update asset status
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'FAILED' },
      });
      throw err;
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }

  private async runFFmpeg(
    args: string[],
    cwd: string,
    label: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = this.config.get('FFMPEG_PATH') || 'ffmpeg';
      const child: ChildProcess = spawn(ffmpegPath, args, { cwd });

      let stderr = '';
      child.stdout?.on('data', (data) => {
        this.logger.debug(`FFmpeg[${label}] stdout: ${data}`);
      });
      child.stderr?.on('data', (data) => {
        stderr = (stderr + data.toString()).slice(-4000);
        this.logger.debug(`FFmpeg[${label}] stderr: ${data}`);
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg[${label}] exited with code ${code}: ${stderr.slice(-1500)}`));
        }
      });
    });
  }

  private storageClient(): S3Client {
    const accessKeyId = this.config.get<string>('STORAGE_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('STORAGE_SECRET_KEY');
    if (!accessKeyId || !secretAccessKey) throw new Error('Storage credentials not configured');
    return new S3Client({endpoint: this.config.get<string>('STORAGE_ENDPOINT') || 'http://localhost:9000', region: this.config.get<string>('STORAGE_REGION') || 'us-east-1', forcePathStyle: true, credentials: {accessKeyId, secretAccessKey}});
  }

  private filesIn(dir: string): string[] {
    return readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? this.filesIn(path) : [path]; });
  }

  private async probeDimensions(source: string): Promise<{width: number; height: number}> {
    return new Promise((resolve, reject) => {
      const child = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', source]);
      let output = ''; child.stdout.on('data', chunk => output += chunk.toString());
      child.on('error', reject); child.on('close', code => {
        try {
          const data = JSON.parse(output) as {streams?: {width?: number; height?: number}[]};
          const width = data.streams?.[0]?.width, height = data.streams?.[0]?.height;
          if (code !== 0 || !width || !height || width < 2 || height < 2) throw new Error('invalid video dimensions');
          resolve({width, height});
        } catch { reject(new Error('ffprobe could not read source dimensions')); }
      });
    });
  }

  private generateMasterPlaylist(resolutions: {name: string; width: number; height: number; bitrate: string}[], masterPath: string): void {
    const lines = ['#EXTM3U'];
    for (const r of resolutions) {
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${(parseInt(r.bitrate, 10) + 128) * 1000},RESOLUTION=${r.width}x${r.height}`, `${r.name}/playlist.m3u8`);
    }
    writeFileSync(masterPath, lines.join('\n') + '\n');
  }

  private async generateThumbnails(sourcePath: string, thumbDir: string, cwd: string): Promise<void> {
    mkdirSync(thumbDir, { recursive: true });
    // Generate thumbnails at 5s intervals
    await this.runFFmpeg(
      [
        '-i', sourcePath,
        '-vf', "select='isnan(prev_selected_t)+gte(t-prev_selected_t,5)',scale=320:-2,format=yuvj420p",
        '-fps_mode', 'vfr',
        '-vframes', '10',
        `${thumbDir}/thumb_%02d.jpg`,
      ],
      cwd,
      'thumbnails',
    );
    if (!readdirSync(thumbDir).some(name => name.endsWith('.jpg'))) throw new Error('FFmpeg produced no thumbnail');
  }
}

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true })], providers: [PrismaService] })
class WorkerMediaModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerMediaModule.name);
  private worker: Worker | null = null;
  private ioRedis: IORedis | null = null;
  private processor: MediaProcessor;
  private queue: Queue | null = null;
  private dispatchTimer: NodeJS.Timeout | null = null;
  private dispatching = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.processor = new MediaProcessor(config, prisma);
  }

  async onModuleInit() {
    this.ioRedis = new IORedis(
      this.config.get('REDIS_URL') || 'redis://localhost:6379',
      { maxRetriesPerRequest: null },
    );

    this.queue = new Queue('media-transcode', { connection: this.ioRedis });

    const workerOptions: WorkerOptions = {
      connection: this.ioRedis,
      concurrency: 2,
    };

    this.worker = new Worker(
      'media-transcode',
      async (job: any) => {
        this.logger.log(`Processing job ${job.id}: ${job.name}`);
        await this.processor.processTranscode(job.data.mediaAssetId, job.data.transcodeJobId);
      },
      workerOptions,
    );

    this.worker.on('completed', (job: any) => {
      this.logger.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: any, err: Error) => {
      this.logger.error(`Job ${job?.id || 'unknown'} failed: ${err.message}`);
    });

    await this.dispatchQueued();
    this.dispatchTimer = setInterval(() => { void this.dispatchQueued(); }, 5000);
    this.logger.log('Media worker started — listening on queue "media-transcode"');
  }

  private async dispatchQueued(): Promise<void> {
    if (this.dispatching || !this.queue) return;
    this.dispatching = true;
    try {
      const jobs = await this.prisma.transcodeJob.findMany({where: {status: 'queued'}, take: 100, orderBy: {createdAt: 'asc'}});
      for (const job of jobs) {
        await this.queue.add('transcode', {mediaAssetId: job.mediaAssetId, transcodeJobId: job.id},
          {jobId: job.id, attempts: 3, backoff: {type: 'exponential', delay: 5000}, removeOnComplete: false, removeOnFail: false});
      }
    } catch (error) { this.logger.error(`Queue dispatch failed: ${error instanceof Error ? error.message : String(error)}`); }
    finally { this.dispatching = false; }
  }

  async onModuleDestroy() {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
    if (this.ioRedis) await this.ioRedis.quit();
  }
}

async function bootstrap() {
  const app = await NestFactory.create(WorkerMediaModule, { bufferLogs: false });
  // Run onModuleDestroy on SIGTERM/SIGINT so the BullMQ worker, queue, Redis
  // connection and Prisma client close gracefully (matches the API bootstrap).
  app.enableShutdownHooks();
  await app.listen(3004, '0.0.0.0');
}

bootstrap();
