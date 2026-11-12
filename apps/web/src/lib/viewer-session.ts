/** Bind cleanup to the session's original principal, never a later account's
 * cookie/token. Best effort: the server's lease timeout is still authoritative.
 */
export function viewerSessionEnd(sessionId:string,accessToken:string,send:typeof fetch=fetch){
  let ended=false;
  return ()=>{
    if(ended)return;ended=true;
    void send('/api/vod/end',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({sessionId}),keepalive:true}).catch(()=>{});
  };
}
