import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
// Actual PostgreSQL/Prisma business state machine, synthetic trusted observations.
// No provider network access and no production publication.
export async function testExternalFailover(client,tenant,check,vault){
  const {ExternalChannelsService}=require('../dist/modules/admin/external-channels.service.js');
  const {ExternalReportsService}=require('../dist/modules/admin/external-reports.service.js');
  const service=new ExternalChannelsService(client),reports=new ExternalReportsService(client),actor=randomUUID();
  let group,channel;const servers=[],licenses=[];let sources=[];
  async function observation(server,result='reachable_and_hls_valid'){
    const startedAt=new Date(),finishedAt=new Date();
    await client.externalServer.update({where:{id:server.id},data:{lastCheckedAt:startedAt,lastSuccessfulCheck:result==='reachable_and_hls_valid'?finishedAt:null}});
    await client.serverHealthCheck.create({data:{tenantId:tenant.id,serverId:server.id,startedAt,finishedAt,result,details:{segmentStatus:'fetched_mime_valid',responseTimeMs:5}}});
  }
  try{
    await check('multi-provider: disabled defaults, composite tenant FKs, duplicate ranks/sources and exact order audit',async()=>{
      group=await service.createGroup(tenant.id,actor,{name:'Synthetic Provider Group'});
      channel=await service.createChannel(tenant.id,actor,{groupId:group.id,name:'Synthetic Channel',country:'IQ',platform:'web'});
      assert.equal(channel.enabled,false);assert.equal(channel.autoFailover,false);
      await assert.rejects(service.createChannel(randomUUID(),actor,{groupId:group.id,name:'Tenant escape',country:'IQ',platform:'web'}),{status:404});
      for(let i=0;i<2;i++){
        const license=await client.contentLicense.create({data:{tenantId:tenant.id,provider:`Fixture${i}`,contentOwner:'Synthetic owner',authorizedContact:'fixture@example.invalid',authorizationType:'synthetic',allowedPlatforms:['web'],allowedCountries:['IQ'],commercialUse:true,redistributionPermission:true,territoryRestrictions:'IQ',startDate:new Date(0),expiryDate:new Date('2099-01-01'),status:'verified_authorized',reviewedBy:actor,reviewDate:new Date()}});licenses.push(license);
        const server=await client.externalServer.create({data:{tenantId:tenant.id,name:`Failover Fixture ${i}`,providerName:`Fixture${i}`,protocol:'hls',endpointEncrypted:vault.encryptSecret('https://fixture.example/stream.m3u8'),country:'IQ',category:'synthetic',licenseId:license.id}});servers.push(server);
        await observation(server);
        const source=await service.addSource(tenant.id,actor,channel.id,{serverId:server.id,priority:i+1});sources.push(source);assert.equal(source.enabled,false);
      }
      await assert.rejects(service.addSource(tenant.id,actor,channel.id,{serverId:servers[0].id,priority:3}),{code:'P2002'});
      await assert.rejects(service.reorder(tenant.id,actor,channel.id,{sourceIds:[sources[0].id,sources[0].id]}),{status:400});
      await service.reorder(tenant.id,actor,channel.id,{sourceIds:sources.map(s=>s.id).reverse()});
      await service.reorder(tenant.id,actor,channel.id,{sourceIds:sources.map(s=>s.id)});
      assert.ok((await service.history(tenant.id,channel.id)).some(e=>e.reason.startsWith('ORDER:')));
      await assert.rejects(service.approveSource(tenant.id,actor,channel.id,sources[0].id,{}),{status:403});
      for(const source of sources)await service.approveSource(tenant.id,actor,channel.id,source.id,{publicationApproved:true});
      await service.policy(tenant.id,actor,channel.id,{autoFailover:true,failureThreshold:2,retrySeconds:5,holdDownSeconds:10,stabilitySeconds:30,freshnessSeconds:900});
      const selected=await service.activate(tenant.id,actor,channel.id,{enabled:true,publicationApproved:true});assert.equal(selected.activeSourceId,sources[0].id);
    });
    await check('actual DB failover: threshold, concurrent switch deduplication, stable failback, no rights bypass and scope denial',async()=>{
      await observation(servers[0],'unreachable');
      await service.evaluate(tenant.id,channel.id,true);
      await assert.rejects(service.selected(tenant.id,channel.id,'IQ','web'),{status:503});
      await observation(servers[0],'unreachable');
      await Promise.all([service.evaluate(tenant.id,channel.id,true),service.evaluate(tenant.id,channel.id,true)]);
      assert.equal((await service.selected(tenant.id,channel.id,'IQ','web')).id,sources[1].id);
      let switches=(await service.history(tenant.id,channel.id)).filter(e=>e.fromSourceId===sources[0].id&&e.toSourceId===sources[1].id);assert.equal(switches.length,1);
      await observation(servers[0]);await service.evaluate(tenant.id,channel.id,true);
      assert.equal((await service.channel(tenant.id,channel.id)).activeSourceId,sources[1].id,'no immediate primary flapping');
      await service.evaluate(tenant.id,channel.id,true,new Date(Date.now()+31000));
      assert.equal((await service.channel(tenant.id,channel.id)).activeSourceId,sources[0].id);
      await client.contentLicense.update({where:{id:licenses[0].id},data:{status:'revoked'}});
      await service.evaluate(tenant.id,channel.id,true);assert.equal((await service.selected(tenant.id,channel.id,'IQ','web')).id,sources[1].id);
      await assert.rejects(service.selected(tenant.id,channel.id,'US','web'),{status:403});
      await client.contentLicense.update({where:{id:licenses[1].id},data:{expiryDate:new Date()}});
      await assert.rejects(service.selected(tenant.id,channel.id,'IQ','web'),{status:503});
      await service.policy(tenant.id,actor,channel.id,{autoFailover:false,failureThreshold:1,retrySeconds:5,holdDownSeconds:10,stabilitySeconds:30,freshnessSeconds:900});
      await assert.rejects(service.selected(tenant.id,channel.id,'IQ','web'),{status:503});
    });
    await check('durable reports: racing weekly generation, unchanged weeks retained, no transport/approval means no sending',async()=>{
      const saved=process.env.EXTERNAL_REPORT_WEBHOOK_URL;delete process.env.EXTERNAL_REPORT_WEBHOOK_URL;
      try{
        await reports.configure(tenant.id,actor,{period:'weekly',enabled:true,deliveryApproved:false});
        await Promise.all([reports.tick(),reports.tick()]);
        assert.equal(await client.externalReportDelivery.count({where:{tenantId:tenant.id}}),1);
        await reports.tick(new Date(Date.now()+7*86400000+1000));
        const rows=await client.externalReportDelivery.findMany({where:{tenantId:tenant.id}});assert.equal(rows.length,2);assert.ok(rows.every(r=>r.attempts===0&&r.status==='pending'));
        assert.ok(rows[0].payload.measurement.includes('not continuous'));
      }finally{if(saved!==undefined)process.env.EXTERNAL_REPORT_WEBHOOK_URL=saved;}
    });
  }finally{
    await client.externalReportDelivery.deleteMany({where:{tenantId:tenant.id}});await client.externalReportSchedule.deleteMany({where:{tenantId:tenant.id}});
    await client.externalChannel.updateMany({where:{tenantId:tenant.id},data:{activeSourceId:null}});
    await client.externalFailoverEvent.deleteMany({where:{tenantId:tenant.id}});await client.channelSource.deleteMany({where:{tenantId:tenant.id}});await client.externalChannel.deleteMany({where:{tenantId:tenant.id}});await client.providerGroup.deleteMany({where:{tenantId:tenant.id}});
    await client.serverHealthCheck.deleteMany({where:{serverId:{in:servers.map(s=>s.id)}}});await client.externalServer.deleteMany({where:{id:{in:servers.map(s=>s.id)}}});await client.contentLicense.deleteMany({where:{id:{in:licenses.map(l=>l.id)}}});
  }
}
