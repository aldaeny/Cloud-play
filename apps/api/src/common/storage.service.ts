import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUpload { uploadUrl: string; objectKey: string; contentType: string }
export interface PresignedDownload { downloadUrl: string; objectKey: string; expiresIn: number }

@Injectable()
export class StorageService {
  private client(endpoint: string): S3Client {
    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;
    if (!accessKeyId || !secretAccessKey) throw new Error('Storage credentials are not configured');
    return new S3Client({ endpoint, region: process.env.STORAGE_REGION || 'us-east-1', forcePathStyle: true, maxAttempts: 3, requestHandler: { connectionTimeout: 5000, requestTimeout: 120000 },
      credentials: { accessKeyId, secretAccessKey } });
  }
  private get bucket(): string { return process.env.STORAGE_BUCKET || 'cloudplay-video'; }
  private get internalEndpoint(): string { return process.env.STORAGE_ENDPOINT || 'http://localhost:9000'; }
  private get publicEndpoint(): string { return process.env.STORAGE_PUBLIC_ENDPOINT || this.internalEndpoint; }

  async getPresignedUploadUrl(objectKey: string, contentType: string, expiresIn = 3600): Promise<PresignedUpload> {
    const uploadUrl = await getSignedUrl(this.client(this.publicEndpoint), new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, ContentType: contentType }), { expiresIn });
    return { uploadUrl, objectKey, contentType };
  }
  async getPresignedDownloadUrl(objectKey: string, expiresIn = 600): Promise<PresignedDownload> {
    const downloadUrl = await getSignedUrl(this.client(this.publicEndpoint), new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }), { expiresIn });
    return { downloadUrl, objectKey, expiresIn };
  }
  async uploadFile(objectKey: string, data: Buffer, contentType: string): Promise<void> {
    await this.client(this.internalEndpoint).send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: data, ContentType: contentType }));
  }
  async downloadFile(objectKey: string): Promise<Buffer> {
    const result = await this.client(this.internalEndpoint).send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!result.Body) throw new Error('Empty S3 response body');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async downloadBounded(objectKey: string, maxBytes: number): Promise<Buffer> {
    const result = await this.client(this.internalEndpoint).send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!result.Body || (result.ContentLength !== undefined && result.ContentLength > maxBytes)) {
      if(result.Body){const stream=result.Body as unknown as {destroy?:()=>void};if(stream.destroy)stream.destroy();else await result.Body.transformToWebStream().cancel();}
      throw new Error('OBJECT_TOO_LARGE');
    }
    const parts: Buffer[] = []; let size = 0;
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      size += chunk.length; if (size > maxBytes) throw new Error('OBJECT_TOO_LARGE');
      parts.push(Buffer.from(chunk));
    }
    return Buffer.concat(parts);
  }
  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client(this.internalEndpoint).send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && '$metadata' in error) {
        const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
        if (metadata?.httpStatusCode === 404) return false;
      }
      throw error;
    }
  }
  async checkConnectivity(): Promise<boolean> {
    try { await this.client(this.internalEndpoint).send(new HeadBucketCommand({ Bucket: this.bucket })); return true; } catch { return false; }
  }
}
