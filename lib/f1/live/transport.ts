import type {LiveSocket} from './collector';
interface UpstreamSocket {
 accept():void;send(value:string):void;close():void;
 addEventListener(type:string,callback:(event:any)=>void):void;
}
/** Cloudflare outbound WebSocket adapter. Fixed origin; no auth/paid channel fallback. */
export function connectSignalR(fetcher:typeof fetch=fetch):LiveSocket{
 let upstream:UpstreamSocket|null=null,closed=false;
 const controller=new AbortController();
 const socket:LiveSocket={onopen:null,onmessage:null,onclose:null,onerror:null,
  send(value){if(closed||!upstream)throw Error('Live transport unavailable');upstream.send(value);},
  close(){closed=true;controller.abort();try{upstream?.close();}catch{}}};
 const timeout=setTimeout(()=>controller.abort(),15000);
 void(async()=>{
  try{
   const response=await fetcher('https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1',{method:'POST',signal:controller.signal,redirect:'error'});
   if(!response.ok)throw Error('Live negotiate unavailable');
   const data=await response.json();if(typeof data.connectionToken!=='string'||!data.connectionToken)throw Error('Invalid negotiate response');
   const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
   const upgrade=await fetcher('https://livetiming.formula1.com/signalrcore?id='+encodeURIComponent(data.connectionToken),{headers:{Upgrade:'websocket',...(cookie?{Cookie:cookie}:{})},signal:controller.signal,redirect:'error'});
   const ws=(upgrade as Response&{webSocket?:UpstreamSocket}).webSocket;
   if(upgrade.status!==101||!ws)throw Error('Live upgrade unavailable');
   upstream=ws;if(closed){ws.close();return;}
   ws.addEventListener('message',event=>{if(!closed&&typeof event.data==='string')socket.onmessage?.({data:event.data});});
   ws.addEventListener('close',()=>{if(!closed)socket.onclose?.();});
   ws.addEventListener('error',()=>{if(!closed)socket.onerror?.();});
   ws.accept();socket.onopen?.();
  }catch{if(!closed)socket.onerror?.();}
  finally{clearTimeout(timeout);}
 })();
 return socket;
}
