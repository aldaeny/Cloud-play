import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID, createHmac, createHash } from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url);
export async function testVodDelivery(client,pool,api,check) {
  const previous={...process.env};
  Object.assign(process.env,{API_END_USER_AUTHORITY:'supabase',VOD_DELIVERY_ENABLED:'true',VOD_SIGNING_KEY:randomUUID(),EXTERNAL_GEO_SIGNING_KEY:randomUUID(),FREE_ACCESS:'true'});
  const tenant=await client.tenant.create({data:{}}),sid=randomUUID();
  let app,user,title,asset,revokeDuringRead=false;
  try {
    // Explicit local authority-row fixture, never a claim of real hosted SSO.
    await pool.query('CREATE TABLE auth.sessions (id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz)');
    user=await client.appUser.create({data:{tenantId:tenant.id,profiles:{create:{name:'Synthetic viewer',maturityMax:'PG-13'}}},include:{profiles:true}});
    const device=await client.device.create({data:{userId:user.id,platform:'web',deviceName:'Synthetic browser'}});
    title=await client.title.create({data:{tenantId:tenant.id,kind:'MOVIE',state:'PUBLISHED',maturityRating:'G',titleAr:'فيديو صناعي',titleEn:'Synthetic local VOD',genres:[]}});
    await client.rightsWindow.create({data:{titleId:title.id,contractRef:'original-synthetic-only',territories:'["IQ"]',startsAt:new Date(0),endsAt:new Date('2099-01-01')}});
    asset=await client.mediaAsset.create({data:{ownerType:'title',ownerId:title.id,titleId:title.id,sourceKey:'synthetic.mp4',status:'ACTIVE'}});
    await client.mediaAsset.update({where:{id:asset.id},data:{hlsManifestKey:`hls/${asset.id}/master.m3u8`}});
    await pool.query('INSERT INTO auth.sessions VALUES($1,$2,NULL)',[sid,user.id]);
    const {Test}=require('@nestjs/testing'),{AppModule}=require(path.join(api,'dist/app.module.js')),{PrismaService}=require(path.join(api,'dist/prisma.service.js')),{SupabaseAuthService}=require(path.join(api,'dist/common/supabase-auth.service.js')),{StorageService}=require(path.join(api,'dist/common/storage.service.js'));
    const objects={ 'master.m3u8':Buffer.from('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\nlow.m3u8\n'), 'low.m3u8':Buffer.from('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nsegment.ts\n#EXT-X-ENDLIST\n'), 'segment.ts':Buffer.alloc(188,0x47) };
    const mod=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(PrismaService).useValue(client).overrideProvider(SupabaseAuthService).useValue({verifyAccessToken:async()=>({id:user.id,email:null,emailConfirmed:true})}).overrideProvider(StorageService).useValue({downloadBounded:async(key)=>{
      assert.ok(key.startsWith(`hls/${asset.id}/`));
      if(revokeDuringRead)await client.rightsWindow.updateMany({where:{titleId:title.id},data:{endsAt:new Date(0)}});
      const data=objects[key.slice(`hls/${asset.id}/`.length)];assert.ok(data);return data;
    }}).compile();
    app=mod.createNestApplication({logger:false});await app.init();
    const request=require('supertest'),token='fixture.'+Buffer.from(JSON.stringify({sub:user.id,session_id:sid})).toString('base64url')+'.verified-by-fixture';
    const geo=(country='IQ')=>{const value=Buffer.from(JSON.stringify({channelId:`vod:${title.id}`,tokenHash:createHash('sha256').update(token).digest('hex'),country,platform:'web',deviceName:'Synthetic browser',issuedAt:Date.now(),expiresAt:Date.now()+30000,nonce:randomUUID()})).toString('base64url');return value+'.'+createHmac('sha256',process.env.EXTERNAL_GEO_SIGNING_KEY).update(value).digest('base64url');};
    const post=()=>request(app.getHttpServer()).post('/playback/sessions').set('Authorization',`Bearer ${token}`).set('x-external-geo',geo()).send({titleId:title.id,profileId:user.profiles[0].id,deviceId:device.id});
    const get=url=>request(app.getHttpServer()).get(url).set('Authorization',`Bearer ${token}`).set('x-external-geo',geo());
    let session,segmentUrl;
    const text=response=>Buffer.isBuffer(response.body)?response.body.toString():response.text;
    await check('legacy VOD actual HTTP/DB creates bound session and rewrites nested private manifests (Auth and object-store fixtures)',async()=>{
      session=(await post().expect(201)).body;
      assert.ok(session.sessionId);
      const master=await get(session.manifestUrl).expect(200).expect('Cache-Control','private, no-store');
      const lowUrl=text(master).split('\n').find(s=>s.startsWith('/playback/'));
      assert.ok(lowUrl);const low=await get(lowUrl).expect(200);
      segmentUrl=text(low).split('\n').find(s=>s.startsWith('/playback/'));
      assert.equal((await get(segmentUrl).expect(200)).body.length,188);
    });
    await check('VOD denies forged resource, missing trusted Geo, expired session and revoked device',async()=>{
      await get(segmentUrl.replace('signature=','signature=broken')).expect(403);
      await request(app.getHttpServer()).get(segmentUrl).set('Authorization',`Bearer ${token}`).expect(403);
      await client.device.update({where:{id:device.id},data:{revokedAt:new Date()}});await get(segmentUrl).expect(404);
      await client.device.update({where:{id:device.id},data:{revokedAt:null}});
      await client.playbackSession.update({where:{id:session.sessionId},data:{vodExpiresAt:new Date(0)}});await get(segmentUrl).expect(403);
      await client.playbackSession.update({where:{id:session.sessionId},data:{vodExpiresAt:new Date(session.expiresAt)}});
    });
    await check('VOD rechecks rights after storage read and denies authoritative Auth logout',async()=>{
      revokeDuringRead=true;await get(segmentUrl).expect(403);revokeDuringRead=false;
      await client.rightsWindow.updateMany({where:{titleId:title.id},data:{endsAt:new Date('2099-01-01')}});
      await pool.query('DELETE FROM auth.sessions WHERE id=$1',[sid]);await get(segmentUrl).expect(403);
    });
  } finally {
    await app?.close();
    if(user){await client.externalGeoNonce.deleteMany({where:{}});await client.playbackSession.deleteMany({where:{userId:user.id}});}
    if(asset)await client.mediaAsset.delete({where:{id:asset.id}});
    if(title){await client.rightsWindow.deleteMany({where:{titleId:title.id}});await client.title.delete({where:{id:title.id}});}
    if(user){await client.device.deleteMany({where:{userId:user.id}});await client.profile.deleteMany({where:{userId:user.id}});await client.appUser.delete({where:{id:user.id}});}
    await client.tenant.delete({where:{id:tenant.id}});
    await pool.query('DROP TABLE IF EXISTS auth.sessions');
    for(const key of ['API_END_USER_AUTHORITY','VOD_DELIVERY_ENABLED','VOD_SIGNING_KEY','EXTERNAL_GEO_SIGNING_KEY','FREE_ACCESS'])if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
  }
}
