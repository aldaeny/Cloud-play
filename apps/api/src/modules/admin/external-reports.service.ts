import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { pinnedProviderRequest } from '../../common/pinned-provider-request';
import { externalBody } from './external-channels.service';
const duration = (period: string) => (period === 'daily' ? 1 : 7) * 86400000;
@Injectable()
export class ExternalReportsService {
  constructor(private readonly prisma: PrismaService) {}
  async configure(tenantId: string, actorId: string, input: unknown) {
    const body = externalBody(input), period = body.period || 'weekly';
    if (!['daily','weekly'].includes(String(period)) || typeof body.enabled !== 'boolean' || typeof body.deliveryApproved !== 'boolean') throw new BadRequestException('INVALID_REPORT_SCHEDULE');
    return this.prisma.$transaction(async tx => {
      const row = await tx.externalReportSchedule.upsert({ where: { tenantId_period: { tenantId, period: String(period) } }, create: { tenantId, actorId, period: String(period), enabled: body.enabled as boolean, deliveryApproved: body.deliveryApproved as boolean, nextRunAt: new Date() },
        update: { enabled: body.enabled as boolean, deliveryApproved: body.deliveryApproved as boolean, leaseUntil: null } });
      await tx.serverAuditLog.create({ data: { tenantId, actorId, entityId: row.id, action: 'REPORT_SCHEDULE_AND_DELIVERY_CONSENT_CHANGED' } });
      return { ...row, transportConfigured: !!process.env.EXTERNAL_REPORT_WEBHOOK_URL, timezone: 'Asia/Baghdad' };
    });
  }
  async list(tenantId: string) { return { schedules: await this.prisma.externalReportSchedule.findMany({ where: { tenantId } }), deliveries: await this.prisma.externalReportDelivery.findMany({ where: { tenantId }, orderBy: { createdAt:'desc' }, take:100 }) }; }
  async aggregate(tenantId: string, start: Date, end: Date, db: Prisma.TransactionClient | PrismaClient = this.prisma) {
    const checks = await db.serverHealthCheck.findMany({ where: { tenantId, startedAt: { gte:start, lt:end } }, orderBy: { startedAt:'asc' }, take:10000, select: { serverId:true,result:true,startedAt:true,details:true } });
    const events = await db.externalFailoverEvent.findMany({ where: { tenantId,createdAt:{gte:start,lt:end}, NOT:{reason:{startsWith:'ORDER:'}} }, select:{channelId:true,toSourceId:true,fromSourceId:true,reason:true,outageDurationMs:true}, take:10000 });
    const providers: Record<string,{checks:number;failures:number;sampleAvailabilityPct:number;responseTimeTotalMs:number}> = {};
    for (const check of checks) {
      const row = providers[check.serverId] ||= { checks:0,failures:0,sampleAvailabilityPct:0,responseTimeTotalMs:0 };
      row.checks++; if (!['reachable_and_hls_valid','reachable_and_dash_valid'].includes(check.result)) row.failures++;
      const latency = (check.details as Record<string,unknown>)?.responseTimeMs; if (typeof latency === 'number' && Number.isFinite(latency)) row.responseTimeTotalMs+=latency;
      row.sampleAvailabilityPct = 100*(row.checks-row.failures)/row.checks;
    }
    return { start,end,timezone:'Asia/Baghdad',measurement:'observed checks, not continuous decoded playback availability',truncated:checks.length===10000||events.length===10000,
      checkCount:checks.length,failedChecks:Object.values(providers).reduce((n,p)=>n+p.failures,0),providers,
      failoverCount:events.filter(e=>e.fromSourceId&&e.toSourceId&&e.fromSourceId!==e.toSourceId).length,
      outageCount:events.filter(e=>!e.toSourceId).length,completedObservedOutageMs:events.reduce((n,e)=>n+(e.outageDurationMs||0),0),
      ongoingOutages:await db.externalChannel.count({where:{tenantId,outageStartedAt:{not:null}}}),
      licenses:await db.contentLicense.groupBy({by:['status'],where:{tenantId},_count:true}), expiredLicenses:await db.contentLicense.count({where:{tenantId,expiryDate:{lte:end}}}) };
  }
  async tick(now = new Date()) {
    await this.prisma.externalReportDelivery.updateMany({ where:{status:'delivering',attempts:{gte:5},leaseUntil:{lt:now}},data:{status:'failed',leaseUntil:null,lastError:'DELIVERY_RETRY_LIMIT_AFTER_CRASH'} });
    const due = await this.prisma.externalReportSchedule.findMany({ where:{enabled:true,nextRunAt:{lte:now}}, take:10,orderBy:{nextRunAt:'asc'} });
    for(const schedule of due) await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${schedule.id}, 0))`;
      const current=await tx.externalReportSchedule.findUnique({where:{id:schedule.id}});
      if(!current?.enabled || current.nextRunAt>now) return;
      const end=current.nextRunAt,start=new Date(end.getTime()-duration(current.period));
      const payload=await this.aggregate(current.tenantId,start,end,tx);
      await tx.externalReportDelivery.upsert({where:{scheduleId_periodStart:{scheduleId:current.id,periodStart:start}},create:{tenantId:current.tenantId,scheduleId:current.id,periodStart:start,payload:JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,nextAttemptAt:now},update:{}});
      await tx.externalReportSchedule.update({where:{id:current.id},data:{nextRunAt:new Date(end.getTime()+duration(current.period))}});
    },{timeout:10000});
    const deliveries=await this.prisma.externalReportDelivery.findMany({where:{status:{in:['pending','retry','delivering']},nextAttemptAt:{lte:now},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}],schedule:{enabled:true,deliveryApproved:true}},take:10,orderBy:{nextAttemptAt:'asc'}});
    const endpoint=process.env.EXTERNAL_REPORT_WEBHOOK_URL;
    if(!endpoint) return; // Generate even unchanged/empty weeks, but do NOT send without setup and explicit consent.
    let url:URL;
    try{url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error();}catch{return;}
    for(const item of deliveries){
      const leaseUntil=new Date(now.getTime()+60000);
      const claim=await this.prisma.externalReportDelivery.updateMany({where:{id:item.id,status:{in:['pending','retry','delivering']},attempts:{lt:5},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},data:{status:'delivering',leaseUntil,attempts:{increment:1}}});
      if(!claim.count)continue;
      let success=false;
      try{
        // Idempotency key must be honoured by the approved recipient: delivery is
        // at-least-once across process crash/remote acknowledgement loss.
        const response=await pinnedProviderRequest(url,{method:'POST',signal:AbortSignal.timeout(8000),body:new URLSearchParams({idempotencyKey:item.id,report:JSON.stringify(item.payload),...(process.env.EXTERNAL_REPORT_WEBHOOK_SECRET?{token:process.env.EXTERNAL_REPORT_WEBHOOK_SECRET}:{})}).toString()},undefined,4096);
        success=response.ok;
      }catch{ /* persist only fixed codes, never raw recipient/socket errors */ }
      await this.prisma.externalReportDelivery.updateMany({where:{id:item.id,leaseUntil},data:{status:success?'delivered':item.attempts+1>=5?'failed':'retry',leaseUntil:null,lastError:success?null:'DELIVERY_TRANSPORT_FAILED',deliveredAt:success?new Date():null,nextAttemptAt:new Date(now.getTime()+Math.min(3600000,60000*2**item.attempts))}});
    }
  }
}
