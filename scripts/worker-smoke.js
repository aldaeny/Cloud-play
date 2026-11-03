// Disposable local services only. Requires the development seed title and TEST_VIDEO.
const {PrismaClient}=require('@prisma/client');
const {S3Client,PutObjectCommand,GetObjectCommand,ListObjectsV2Command,DeleteObjectsCommand}=require('@aws-sdk/client-s3');
const {Queue,QueueEvents}=require('bullmq'); const IORedis=require('ioredis'); const {readFile}=require('fs/promises'); const {execFileSync}=require('child_process'); const {randomUUID}=require('crypto');
const {MediaService}=require('../apps/api/dist/modules/media/media.service'); const {StorageService}=require('../apps/api/dist/common/storage.service');
(async()=>{
 const p=new PrismaClient(),c=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
 const q=new Queue('media-transcode',{connection:c}),events=new QueueEvents('media-transcode',{connection:c});
 const s=new S3Client({endpoint:process.env.STORAGE_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.STORAGE_ACCESS_KEY,secretAccessKey:process.env.STORAGE_SECRET_KEY}});
 const bucket=process.env.STORAGE_BUCKET, source=`source/smoke-${randomUUID()}.mp4`; let asset,job;
 try {
  await events.waitUntilReady(); await s.send(new PutObjectCommand({Bucket:bucket,Key:source,Body:await readFile(process.env.TEST_VIDEO)}));
  const title='00000000-0000-0000-0000-000000000010';
  const confirmed=await new MediaService(p,new StorageService()).confirmUpload(source,'title',title,'video'); asset=confirmed.asset;
  for(let i=0;i<80&&!job;i++){job=await q.getJob(confirmed.job.id);if(!job)await new Promise(r=>setTimeout(r,250));}
  if(!job)throw Error('queued DB job was not dispatched'); await job.waitUntilFinished(events,120000);
  asset=await p.mediaAsset.findUnique({where:{id:asset.id},include:{transcodeJobs:true}});
  if(asset.status!=='ACTIVE'||!asset.hlsManifestKey||asset.transcodeJobs[0].status!=='COMPLETED')throw Error('DB state incorrect');
  const playlist=await s.send(new GetObjectCommand({Bucket:bucket,Key:asset.hlsManifestKey}));const content=await playlist.Body.transformToString();
  const variants=(process.env.EXPECTED_VARIANTS||'360p').split(',');
  for(const variant of variants){
   if(!content.includes(`${variant}/playlist.m3u8`))throw Error(`missing ${variant}: ${content}`);
   const variantPlaylist=await s.send(new GetObjectCommand({Bucket:bucket,Key:`hls/${asset.id}/${variant}/playlist.m3u8`}));const variantText=await variantPlaylist.Body.transformToString();if(!variantText.includes('#EXT-X-INDEPENDENT-SEGMENTS'))throw Error('missing independent segment flag');
   const segment=await s.send(new GetObjectCommand({Bucket:bucket,Key:`hls/${asset.id}/${variant}/segment_00000.ts`}));const bytes=Buffer.from(await segment.Body.transformToByteArray());
   const dimensions=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json','pipe:0'],{input:bytes}).toString()).streams[0];
   if(!content.includes(`RESOLUTION=${dimensions.width}x${dimensions.height}`))throw Error(`wrong master dimensions for ${variant}`);
   console.log(`PASS ${variant}: ${bytes.length} bytes, ${dimensions.width}x${dimensions.height}`);
  }
  if(content.includes('1080p/'))throw Error('unexpected upscale to 1080p');
  const thumb=await s.send(new GetObjectCommand({Bucket:bucket,Key:`hls/${asset.id}/thumbnails/thumb_01.jpg`}));if(!(await thumb.Body.transformToByteArray()).length)throw Error('empty thumbnail');
  console.log('PASS DB outbox, BullMQ, FFmpeg HLS and thumbnail, S3 upload and DB status');
 } finally {
  if(job)await job.remove();
  if(asset){await p.transcodeJob.deleteMany({where:{mediaAssetId:asset.id}});await p.mediaAsset.delete({where:{id:asset.id}});}
  const keys=[source];if(asset){const listed=await s.send(new ListObjectsV2Command({Bucket:bucket,Prefix:`hls/${asset.id}/`}));for(const o of listed.Contents||[])if(o.Key)keys.push(o.Key);}
  if(keys.length)await s.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:keys.map(Key=>({Key})),Quiet:true}}));
  await events.close();await q.close();await c.quit();await p.$disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
