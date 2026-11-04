import 'react-native-url-polyfill/auto';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, NativeModules, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewNavigation, type WebViewMessageEvent } from 'react-native-webview';
import {parseCastRequest} from './castRequest';
import type {CastRequest} from './CastNativeOverlay';

// No fabricated server is supplied. Set this only after the real HTTPS deployment is verified.
function trustedUrl(value: string | undefined): string | null {
  try { const u = new URL(value || ''); if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.') || /^[\d.]+$/.test(u.hostname) || u.hostname.endsWith('.local') || u.hostname.endsWith('.localhost')) return null; return u.href; } catch { return null; }
}
const home = trustedUrl(process.env.EXPO_PUBLIC_CLOUDPLAY_URL);
const origin = home ? new URL(home).origin : '';
const nativeCastAvailable = !!NativeModules.RNGCCastContext && !!NativeModules.RNGCSessionManager && !!NativeModules.RNGCRemoteMediaClient;
// Lazy require keeps Expo Go usable when the native Cast SDK is absent.
const CastOverlay = nativeCastAvailable ? require('./CastNativeOverlay').default as typeof import('./CastNativeOverlay').default : null;
const capabilityScript = `window.__CLOUDPLAY_CAST_NATIVE__=${nativeCastAvailable ? 'true' : 'false'};window.dispatchEvent(new Event('cloudplay-cast-capabilities'));true;`;
export default function App() {
  const ref = useRef<WebView>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [castRequest, setCastRequest] = useState<CastRequest|null>(null);
  function castFinish(status:'sent'|'error'|'cancelled'|'stopped'){setCastRequest(null);ref.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('cloudplay-native-cast',{detail:{status:${JSON.stringify(status)}}}));true;`)}
  function onWebMessage(event:WebViewMessageEvent){
    if(!nativeCastAvailable)return;
    try{const msg=JSON.parse(event.nativeEvent.data) as {type?:unknown};if(new URL(event.nativeEvent.url).origin!==origin)return;
      if(msg.type==='cloudplay.cast.stop.v1'){const GoogleCast=require('react-native-google-cast').default as typeof import('react-native-google-cast').default;void GoogleCast.getSessionManager().endCurrentSession(true).then(()=>castFinish('stopped')).catch(()=>castFinish('error'));return}
      if(msg.type!=='cloudplay.cast.v1')return;
      const request=parseCastRequest(event.nativeEvent.data,event.nativeEvent.url,origin);if(request)setCastRequest(request);else castFinish('error');
    }catch{/* Untrusted or malformed messages are ignored. */}
  }
  function shouldNavigate(request: WebViewNavigation) {
    try {
      const u = new URL(request.url);
      if (u.origin === origin && u.protocol === 'https:') return true;
      // Open user-selected external HTTPS links in the system browser, never privileged schemes.
      if (request.navigationType === 'click' && u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !/^[\d.]+$/.test(u.hostname) && !u.hostname.endsWith('.local') && !u.hostname.endsWith('.localhost')) void Linking.openURL(u.href).catch(() => {});
    } catch { /* Invalid and custom schemes are not opened. */ }
    return false;
  }
  return <SafeAreaView style={styles.screen}><StatusBar style="light"/>{!home ? <View style={styles.center}><Text style={styles.title}>CLOUD PLAY</Text><Text style={styles.message}>الموقع غير مربوط بعد. اضبط رابط HTTPS الحقيقي قبل بناء التطبيق.</Text><Text style={styles.message}>The site is not configured. Set the verified HTTPS URL before building.</Text></View> : <View style={styles.fill}><WebView ref={ref} source={{uri:home}} onShouldStartLoadWithRequest={shouldNavigate} onLoadStart={()=>{setCastRequest(null);setLoading(true);setError(false)}} onLoadEnd={()=>{setLoading(false);ref.current?.injectJavaScript(capabilityScript)}} onError={()=>{setLoading(false);setError(true)}} onHttpError={e=>{if(e.nativeEvent.statusCode>=500)setError(true)}} onMessage={onWebMessage} injectedJavaScriptBeforeContentLoaded={capabilityScript} allowsInlineMediaPlayback allowsAirPlayForMediaPlayback mediaPlaybackRequiresUserAction javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}/>{loading && !error && <ActivityIndicator style={styles.loading} color="#8bafff"/>}{error && <View style={styles.error}><Text style={styles.message}>تعذّر فتح الموقع · Unable to load the site</Text><Pressable onPress={()=>{setError(false);ref.current?.reload()}} style={styles.button}><Text style={styles.buttonText}>إعادة المحاولة · Retry</Text></Pressable></View>}</View>}{CastOverlay&&<CastOverlay request={castRequest} onFinish={castFinish}/>}</SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#0b1020'},fill:{flex:1},center:{flex:1,justifyContent:'center',padding:28},title:{color:'#fff',fontSize:28,fontWeight:'700',marginBottom:18},message:{color:'#e9edfa',fontSize:16,lineHeight:26,marginBottom:10},loading:{position:'absolute',top:'50%',alignSelf:'center'},error:{position:'absolute',top:0,bottom:0,left:0,right:0,justifyContent:'center',alignItems:'center',backgroundColor:'#0b1020',padding:24},button:{backgroundColor:'rgba(126,138,148,0.26)',borderWidth:1,borderColor:'rgba(226,236,242,0.52)',paddingHorizontal:20,paddingVertical:12,borderRadius:14},buttonText:{color:'#fff',fontWeight:'700'}});
