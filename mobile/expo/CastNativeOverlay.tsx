import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {CastButton, MediaStreamType, useRemoteMediaClient} from 'react-native-google-cast';

export type CastRequest={url:string;kind:'hls'|'mp4';title:string;position:number};
type Props={request:CastRequest|null;onFinish:(status:'sent'|'error'|'cancelled')=>void};

/** A request is loaded only after an explicit user action and device selection. */
export default function CastNativeOverlay({request,onFinish}:Props){
 const client=useRemoteMediaClient();const loading=useRef(false);const [attempt,setAttempt]=useState(0);const onFinishRef=useRef(onFinish);onFinishRef.current=onFinish;
 useEffect(()=>{
  if(!client||!request||loading.current)return;
  loading.current=true;let active=true;
  void client.loadMedia({autoplay:true,startTime:request.kind==='mp4'?request.position:undefined,mediaInfo:{contentUrl:request.url,contentType:request.kind==='mp4'?'video/mp4':'application/x-mpegURL',streamType:request.kind==='mp4'?MediaStreamType.BUFFERED:MediaStreamType.LIVE,metadata:{type:'generic',title:request.title}}}).then(()=>{if(active)onFinishRef.current('sent')}).catch(()=>{if(active)onFinishRef.current('error')}).finally(()=>{loading.current=false;setAttempt(n=>n+1)});
  return()=>{active=false};
 },[client,request,attempt]);
 return <Modal visible={!!request} transparent animationType="fade" onRequestClose={()=>onFinish('cancelled')}><View style={styles.backdrop}><View style={styles.panel}><Text style={styles.heading}>المشاهدة على التلفزيون · Watch on TV</Text><Text style={styles.copy}>اضغط رمز Cast واختر تلفزيوناً متوافقاً على الشبكة نفسها. · Tap Cast and choose a compatible TV on the same network.</Text><View style={styles.row}><CastButton style={styles.castButton} tintColor="#fff"/><Text style={styles.copy}>Google Cast</Text></View>{loading.current&&<ActivityIndicator color="#b9d9ff"/>}<Text style={styles.note}>يتطلب التشغيل وصول التلفزيون إلى مصدر الفيديو. · The TV must be able to access the media source.</Text><Pressable accessibilityRole="button" onPress={()=>onFinish('cancelled')} style={styles.cancel}><Text style={styles.cancelText}>إلغاء · Cancel</Text></Pressable></View></View></Modal>;
}
const styles=StyleSheet.create({backdrop:{flex:1,backgroundColor:'#000a',justifyContent:'center',padding:24},panel:{backgroundColor:'#121b28',borderRadius:20,padding:24,borderWidth:1,borderColor:'#c0d8f85c'},heading:{color:'#fff',fontSize:19,fontWeight:'700',marginBottom:12},copy:{color:'#e2ecf9',fontSize:14,lineHeight:23},row:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:18},castButton:{width:48,height:48,tintColor:'#fff'},note:{color:'#aebfd3',fontSize:12,lineHeight:20},cancel:{alignSelf:'flex-start',marginTop:18,paddingVertical:10,paddingHorizontal:16,borderRadius:12,backgroundColor:'#2a3d56'},cancelText:{color:'#fff',fontWeight:'600'}});
