import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
/** Fixed vocabulary and numeric measurements only. Never serialize requests,
 * errors, identities, headers, query strings, media tickets or provider URLs. */
const logger=new Logger('ProtectedPlayback');
export function playbackMetric(event:string,value:number,status?:number){
 if(!['request','startup','buffering','failure','session_expiration','authorization_failure'].includes(event)||!Number.isFinite(value)||value<0||value>14400000)return;
 logger.log(JSON.stringify({event,value:Math.round(value),...(status===undefined?{}:{status})}));
}
@Injectable()
export class ExternalPlaybackMetricsInterceptor implements NestInterceptor {
 intercept(context:ExecutionContext,next:CallHandler):Observable<unknown>{
  const start=performance.now();const response=context.switchToHttp().getResponse();
  return next.handle().pipe(tap({next:()=>playbackMetric('request',performance.now()-start,response.statusCode),error:(error)=>{const status=typeof error?.getStatus==='function'?error.getStatus():500;playbackMetric(status===401||status===403?'authorization_failure':'failure',performance.now()-start,status);}}));
 }
}
