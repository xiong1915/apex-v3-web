// Private diagnostic only: no complete timing tables, credentials or raw frames are saved.
require('tsx/cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const WS=require('next/dist/compiled/ws');
const {HttpsProxyAgent}=require('next/dist/compiled/https-proxy-agent');
const {LIVE_TOPICS}=require('../lib/f1/live/types.ts');
const {SignalRFrames,subscriptionFrame,handshakeFrame}=require('../lib/f1/live/protocol.ts');
const {LiveState}=require('../lib/f1/live/state.ts');
if(!process.argv.includes('--observe-public-channels'))throw Error('Explicit --observe-public-channels required');
const arg=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const duration=Math.max(600,Math.min(1800,Number(arg('--seconds')||600)))*1000;
const output=path.resolve(arg('--output')||path.join(require('node:os').tmpdir(),'apex-live-observation'));
fs.mkdirSync(output,{recursive:true});
const start=Date.now(),report={startedAt:new Date(start).toISOString(),endedAt:null,authenticated:false,publicRedistributionAuthorized:false,connections:0,reconnections:0,heartbeats:0,businessChanges:0,initialSnapshots:0,session:null,channels:Object.fromEntries(LIVE_TOPICS.map(topic=>[topic,{initial:false,messages:0,businessChanges:0,firstSourceTimestamp:null,lastSourceTimestamp:null}])),errors:[],interruption:null};
let socket=null,closed=false,handshaken=false,attempt=0,state=null,frames=null,lastBusiness='',firstSubscribed=null,lastLog=0;
const delays=[],timers=new Set();
const log=(kind,data={})=>{const row={kind,receivedAt:new Date().toISOString(),...data};fs.appendFileSync(path.join(output,'events.jsonl'),JSON.stringify(row)+'\n');};
const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);return t;};
const finish=()=>{if(closed)return;closed=true;socket?.terminate();for(const t of timers)clearTimeout(t);clearInterval(heartbeat);clearInterval(progress);report.endedAt=new Date().toISOString();report.observedSeconds=firstSubscribed?(Date.now()-firstSubscribed)/1000:0;const sorted=delays.slice().sort((a,b)=>a-b);report.receiveMinusSourceMs={samples:sorted.length,median:sorted.length?sorted[Math.floor(sorted.length/2)]:null,p95:sorted.length?sorted[Math.floor(sorted.length*.95)]:null,min:sorted[0]??null,max:sorted.at(-1)??null};report.businessThresholdMet=report.observedSeconds>=600&&report.businessChanges>=3;fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(report,null,2));log('finished',{observedSeconds:report.observedSeconds,businessChanges:report.businessChanges});console.log(JSON.stringify(report,null,2));};
function consume(frame,initial=false){
 if(initial){const info=frame.result?.SessionInfo;if(info){const key=String(info.Key||'unknown');report.session={key,name:info.Name,type:info.Type,start:info.StartDate,utcOffset:info.GmtOffset};if(!state||state.snapshot().sessionKey!==key){state=new LiveState(key);frames=new SignalRFrames(key);lastBusiness='';}}}
 if(!state||!frames)return;
 const batch=frames.push(JSON.stringify(frame)+'\x1e',Date.now());
 for(const event of batch.events){const row=report.channels[event.topic];if(event.initial){row.initial=true;report.initialSnapshots++;}else{row.messages++;if(event.timestamp&&Number.isFinite(Date.parse(event.timestamp))){row.firstSourceTimestamp ||= event.timestamp;row.lastSourceTimestamp=event.timestamp;}}
  if(!state.apply(event,Date.now()))continue;
  const snapshot=state.snapshot();const business={phase:snapshot.phase,lap:snapshot.currentLap,total:snapshot.totalLaps,flag:snapshot.flag,weather:snapshot.weather,messages:snapshot.messages.map(m=>m.id),drivers:snapshot.drivers.map(d=>({number:d.number,position:d.position,lastLap:d.lastLap,bestLap:d.bestLap,sectors:d.sectors,laps:d.completedLaps,gap:d.gapLeader,ahead:d.gapAhead,compound:d.compound,age:d.tyreAge,pit:d.inPit,retired:d.retired}))};
  const hash=crypto.createHash('sha256').update(JSON.stringify(business)).digest('hex');const changed=hash!==lastBusiness;lastBusiness=hash;
  if(!event.initial&&changed&&event.timestamp){report.businessChanges++;row.businessChanges++;const latency=Date.now()-Date.parse(event.timestamp);if(Number.isFinite(latency)){delays.push(latency);if(delays.length>4096)delays.shift();}if(Date.now()-lastLog>=5000){lastLog=Date.now();const leader=snapshot.drivers.find(d=>d.position===1);log('business_change',{topic:event.topic,sourceTimestamp:event.timestamp,receiveMinusSourceMs:latency,changeCount:report.businessChanges,lap:snapshot.currentLap,totalLaps:snapshot.totalLaps,phase:snapshot.phase,leader:leader?{number:leader.number,position:leader.position}:null,stateDigest:hash});}}
 }
}
async function connect(){
 if(closed)return;
 try{const r=await fetch('https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1',{method:'POST',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('negotiate_http_'+r.status);const data=await r.json();if(!data.connectionToken)throw Error('missing_connection_token');const cookie=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');if(closed)return;const proxy=process.env.HTTPS_PROXY||process.env.https_proxy;const current=new WS('wss://livetiming.formula1.com/signalrcore?id='+encodeURIComponent(data.connectionToken),{headers:cookie?{Cookie:cookie}:{},...(proxy?{agent:new HttpsProxyAgent(proxy)}:{}),handshakeTimeout:15000,maxPayload:2000000});socket=current;handshaken=false;let buffer='',subscribed=false;
 current.on('open',()=>{if(closed)return current.terminate();report.connections++;if(report.connections>1)report.reconnections++;current.send(handshakeFrame());log('connected',{connection:report.connections});});
 current.on('message',value=>{if(closed||socket!==current)return;buffer+=value.toString();if(buffer.length>2000000){report.errors.push('frame_size_limit');return current.terminate();}const parts=buffer.split('\x1e');buffer=parts.pop();for(const part of parts){let frame;try{frame=JSON.parse(part);}catch{continue;}if(frame.type===6){report.heartbeats++;continue;}if(!frame.type&&!frame.error&&!subscribed){handshaken=true;subscribed=true;current.send(subscriptionFrame());}else if(frame.type===3){if(frame.error){report.errors.push('subscription_rejected');current.terminate();break;}if(!firstSubscribed){firstSubscribed=Date.now();later(finish,duration);later(()=>{if(!closed&&socket){report.interruption={at:new Date().toISOString(),reason:'controlled_disconnect_for_recovery_test'};log('controlled_disconnect');socket.terminate();}},Math.floor(duration/2));}attempt=0;consume(frame,true);log('subscribed',{session:report.session});}else if(frame.type===1)consume(frame);else if(frame.type===7)current.terminate();}});
 current.on('error',()=>{if(!closed)report.errors.push('websocket_error');});current.on('unexpected-response',(_req,res)=>{report.errors.push('upgrade_http_'+res.statusCode);res.resume();current.terminate();});current.on('close',()=>{if(socket===current){socket=null;handshaken=false;}if(!closed){log('disconnected');later(connect,Math.min(30000,1000*2**Math.min(attempt++,5))*(.75+Math.random()*.5));}});
 }catch(error){report.errors.push(error.message);log('connection_failed',{error:error.message});if(!closed)later(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));}
}
const heartbeat=setInterval(()=>{if(socket?.readyState===WS.OPEN&&handshaken){try{socket.send('{"type":6}\x1e');}catch{socket.terminate();}}},10000);
const progress=setInterval(()=>console.log(JSON.stringify({observedSeconds:firstSubscribed?Math.floor((Date.now()-firstSubscribed)/1000):0,businessChanges:report.businessChanges,connections:report.connections,session:report.session})),30000);
process.on('SIGINT',finish);process.on('SIGTERM',finish);later(finish,duration+120000);log('starting');connect();
