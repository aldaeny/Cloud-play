import {useEffect,useState,type RefObject} from 'react';
import {castContext,isShareableMedia,loadCastSdk,sendWebCast} from './castWeb';
type Language='ar'|'en';
type Props={language:Language;title:string;url:string;kind:'hls'|'mp4'|'dash';videoRef:RefObject<HTMLVideoElement>};
type AirPlayVideo=HTMLVideoElement & {webkitShowPlaybackTargetPicker?:()=>void};
type NativeBridge={postMessage:(data:string)=>void};
type NativeWindow=Window & {ReactNativeWebView?:NativeBridge;__CLOUDPLAY_CAST_NATIVE__?:boolean};
export default function CastControls({language,title,url,kind,videoRef}:Props){
 const ar=language==='ar';const [airplay,setAirplay]=useState(false);const [native,setNative]=useState(false);const [webCast,setWebCast]=useState(false);const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);const [notice,setNotice]=useState('');
 const safe=isShareableMedia(url);
 useEffect(()=>{
  let active=true;const video=videoRef.current as AirPlayVideo|null;const bridge=(window as NativeWindow).ReactNativeWebView;
  video?.setAttribute('x-webkit-airplay','allow');
  const canAir=typeof video?.webkitShowPlaybackTargetPicker==='function';
  Promise.resolve().then(()=>{if(active){setAirplay(canAir);setNative(!!bridge && (window as NativeWindow).__CLOUDPLAY_CAST_NATIVE__===true)}});
  if(!bridge&&/Chrome|Chromium|Edg\//.test(navigator.userAgent)&&!/iPhone|iPad|iPod/.test(navigator.userAgent))void loadCastSdk().then(available=>{if(active)setWebCast(available)});
  const onMessage=(event:Event)=>{
   const detail=(event as CustomEvent<{status?:string}>).detail;
   if(!detail?.status)return;
   if(detail.status==='sent'){video?.pause();setNotice(ar?'أُرسل طلب تشغيل الفيديو إلى التلفزيون.':'Video playback was requested on the TV.');setSent(true)}
   if(detail.status==='error'){setNotice(ar?'تعذر إرسال الفيديو. تحقق من التلفزيون والمصدر.':'Could not send video. Check the TV and media source.');setSent(false)}
   if(detail.status==='cancelled'){setNotice(ar?'أُلغي اختيار التلفزيون.':'TV selection cancelled.');setSent(false)}
   if(detail.status==='stopped'){setNotice(ar?'تم إيقاف جلسة Cast.':'Cast session ended.');setSent(false)}
  };
  const onCapabilities=()=>setNative(!!(window as NativeWindow).ReactNativeWebView && (window as NativeWindow).__CLOUDPLAY_CAST_NATIVE__===true);
  window.addEventListener('cloudplay-cast-capabilities',onCapabilities);
  window.addEventListener('cloudplay-native-cast',onMessage);
  return()=>{active=false;window.removeEventListener('cloudplay-native-cast',onMessage);window.removeEventListener('cloudplay-cast-capabilities',onCapabilities)};
 },[videoRef,ar]);
 function airplayNow(){try{(videoRef.current as AirPlayVideo|null)?.webkitShowPlaybackTargetPicker?.()}catch{setNotice(ar?'تعذر فتح AirPlay على هذا الجهاز.':'Could not open AirPlay on this device.')}}
 function nativeCast(){
  if(!safe){setNotice(ar?'لا يمكن إرسال هذا الرابط؛ يجب أن يكون عاماً وآمناً وبدون بيانات سرية.':'This source cannot be shared; it must be public, secure and contain no credentials.');return}
  const bridge=(window as NativeWindow).ReactNativeWebView;if(!bridge)return;
  const position=kind==='mp4'&&Number.isFinite(videoRef.current?.currentTime)?videoRef.current?.currentTime||0:0;
  bridge.postMessage(JSON.stringify({type:'cloudplay.cast.v1',url,kind,title,position}));
  setNotice(ar?'اختر جهاز Google Cast من التطبيق.':'Choose a Google Cast device in the app.');
 }
 function webCastNow(){
  if(!safe){setNotice(ar?'لا يمكن إرسال هذا الرابط؛ يجب أن يكون عاماً وآمناً وبدون بيانات سرية.':'This source cannot be shared; it must be public, secure and contain no credentials.');return}
  setBusy(true);setNotice('');
  const position=kind==='mp4'&&Number.isFinite(videoRef.current?.currentTime)?videoRef.current?.currentTime||0:0;
  void sendWebCast(url,kind,title,position).then(()=>{videoRef.current?.pause();setSent(true);setNotice(ar?'أُرسل طلب تشغيل الفيديو إلى التلفزيون.':'Video playback was requested on the TV.')}).catch(()=>{setNotice(ar?'لم يبدأ البث. ربما أُلغي الاختيار أو تعذر الوصول إلى التلفزيون أو المصدر.':'Casting did not start. Selection may have been cancelled or the device or source is unavailable.')}).finally(()=>setBusy(false));
 }
 return <div className="media-cast" aria-label={ar?'المشاهدة على التلفزيون':'Watch on TV'}>
  <div className="media-cast-buttons">
   {airplay&&<button type="button" className="media-cast-button" onClick={airplayNow}>▣ AirPlay</button>}
   {native&&<button type="button" className="media-cast-button" onClick={nativeCast} disabled={!safe}>▣ Google Cast</button>}
   {!native&&webCast&&<button type="button" className="media-cast-button" onClick={webCastNow} disabled={busy||!safe}>▣ Google Cast</button>}
   {native&&sent&&<button type="button" className="media-cast-button" onClick={()=>{(window as NativeWindow).ReactNativeWebView?.postMessage(JSON.stringify({type:'cloudplay.cast.stop.v1'}))}}>{ar?'إيقاف البث':'Stop casting'}</button>}
   {!native&&webCast&&sent&&<button type="button" className="media-cast-button" onClick={()=>{castContext()?.endCurrentSession(true);setSent(false);setNotice(ar?'تم طلب إيقاف جلسة Cast.':'Cast session ended.')}}>{ar?'إيقاف البث':'Stop casting'}</button>}
  </div>
  <p className="media-cast-hint">{ar?'للمشاهدة على التلفزيون استخدم AirPlay أو Google Cast على جهاز متوافق ومتصل بالشبكة نفسها. يعتمد التشغيل على دعم المصدر والجهاز.':'To watch on a TV, use AirPlay or Google Cast on compatible devices on the same network. Playback depends on the media source and receiver.'}</p>
  {!airplay&&!native&&!webCast&&<p className="media-cast-hint">{ar?'البث المباشر من المتصفح غير متاح هنا؛ جرّب Safari لـ AirPlay أو Chrome على جهاز يدعم Cast.':'Casting is not available in this browser; try Safari for AirPlay or Chrome on a Cast-supported device.'}</p>}
  {!safe&&<p className="media-cast-hint">{ar?'لا يمكن إرسال رابط خاص أو غير آمن.':'Private or insecure media URLs cannot be shared.'}</p>}
  {notice&&<p className="media-cast-hint" role="status">{notice}</p>}
 </div>;
}
