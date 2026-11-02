/** Minimal Google Cast sender surface; the SDK itself is loaded only for a player. */
type MediaInfo = {metadata?: {title?: string};streamType?: string};
type LoadRequest = {currentTime?: number;autoplay?: boolean};
type CastSession = {loadMedia(request: LoadRequest): Promise<void>};
type Context = {setOptions(options: {receiverApplicationId: string;autoJoinPolicy: string}): void;requestSession(): Promise<void>;getCurrentSession(): CastSession | null;endCurrentSession(stopCasting: boolean): void};
type CastWindow = Window & {
 cast?: {framework: {CastContext: {getInstance(): Context}}};
 chrome?: {cast?: {isAvailable?: boolean;AutoJoinPolicy: {PAGE_SCOPED: string};media: {DEFAULT_MEDIA_RECEIVER_APP_ID: string;StreamType: {LIVE: string;BUFFERED: string};MediaInfo: new (url: string, contentType: string) => MediaInfo;GenericMediaMetadata: new () => {title?: string};LoadRequest: new (media: MediaInfo) => LoadRequest}}};
 __onGCastApiAvailable?: (available: boolean) => void;
};
let loading: Promise<boolean> | undefined;
let initialized = false;
function castWindow(): CastWindow {return window as CastWindow}
export function castContext(): Context | null {return castWindow().cast?.framework.CastContext.getInstance() || null}
function initialize(): boolean {
 const w=castWindow();const context=castContext();const api=w.chrome?.cast;
 if(!context||!api)return false;
 if(!initialized){context.setOptions({receiverApplicationId:api.media.DEFAULT_MEDIA_RECEIVER_APP_ID,autoJoinPolicy:api.AutoJoinPolicy.PAGE_SCOPED});initialized=true}
 return true;
}
export function loadCastSdk(): Promise<boolean> {
 if(loading)return loading;
 loading=new Promise(resolve=>{
  const w=castWindow();let done=false;
  const finish=(available:boolean)=>{if(done)return;done=true;window.clearTimeout(timer);resolve(available&&initialize())};
  const timer=window.setTimeout(()=>finish(false),10000);
  if(w.cast?.framework&&w.chrome?.cast?.isAvailable){finish(true);return}
  const previous=w.__onGCastApiAvailable;
  w.__onGCastApiAvailable=(available)=>{previous?.(available);finish(available)};
  const script=document.createElement('script');script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';script.async=true;script.onerror=()=>finish(false);document.head.appendChild(script);
 });
 return loading;
}
/** Only public, non-credentialled URLs may be shared with a chosen receiver. */
export function isShareableMedia(value:string):boolean {
 try{const u=new URL(value);const host=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&host.includes('.')&&!/^[\d.]+$/.test(host)&&!host.includes(':')&&!host.endsWith('.local')&&!host.endsWith('.localhost')}catch{return false}
}
export async function sendWebCast(url:string,kind:'hls'|'mp4',title:string,position:number):Promise<void> {
 const context=castContext();const api=castWindow().chrome?.cast;
 if(!context||!api||!isShareableMedia(url))throw new Error('unavailable');
 let session=context.getCurrentSession();
 // requestSession must run directly from the user gesture; no await before it.
 if(!session){await context.requestSession();session=context.getCurrentSession()}
 if(!session)throw new Error('cancelled');
 const media=new api.media.MediaInfo(url,kind==='mp4'?'video/mp4':'application/x-mpegURL');
 media.streamType=kind==='hls'?api.media.StreamType.LIVE:api.media.StreamType.BUFFERED;
 const metadata=new api.media.GenericMediaMetadata();metadata.title=title;media.metadata=metadata;
 const request=new api.media.LoadRequest(media);request.autoplay=true;if(kind==='mp4'&&Number.isFinite(position)&&position>0)request.currentTime=position;
 await session.loadMedia(request);
}
