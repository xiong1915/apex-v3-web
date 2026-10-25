// Explicit, bounded, unauthenticated diagnostic. Never used by the website.
// Records field names and counts only; does not store or republish timing values.
const WS = require('next/dist/compiled/ws');
const { HttpsProxyAgent } = require('next/dist/compiled/https-proxy-agent');
const topics = ['TimingData','TimingStats','TimingAppData','DriverList','SessionInfo','SessionData','TrackStatus','RaceControlMessages','LapCount','WeatherData'];
if (!process.argv.includes('--public-channel-probe')) throw Error('Pass --public-channel-probe to run this network diagnostic');
const report = { observedAt: new Date().toISOString(), authenticated: false, publicRedistributionAuthorized: false, transport: 'not_connected', channels: Object.fromEntries(topics.map(name => [name,{initialReceived:false,updates:0,fields:[],firstTimestamp:null,lastTimestamp:null}])) };
(async () => {
 const negotiation = await fetch('https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1', {method:'POST', signal:AbortSignal.timeout(12000)});
 report.negotiationStatus = negotiation.status;
 if (!negotiation.ok) { report.transport='negotiation_denied'; return; }
 const data = await negotiation.json();
 if (!data.connectionToken) {report.transport='no_connection_token';return;}
 const cookie = negotiation.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
 await new Promise(resolve => {
  let finished=false,buffer='',subscribed=false;
  const socket=new WS('wss://livetiming.formula1.com/signalrcore?id='+encodeURIComponent(data.connectionToken),{headers:cookie?{Cookie:cookie}:{},...(proxy?{agent:new HttpsProxyAgent(proxy)}:{}),handshakeTimeout:12000,maxPayload:1024*1024});
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);socket.terminate();resolve();};
  const timer=setTimeout(finish,12000);
  const observe=(topic,payload,timestamp,initial)=>{const row=report.channels[topic];if(!row)return;if(initial)row.initialReceived=true;else row.updates++;if(payload&&typeof payload==='object'){row.withheld=payload.Withheld===true;const lines=payload.Lines||payload.Messages||payload.StatusSeries;row.entries=lines&&typeof lines==='object'?Object.keys(lines).filter(k=>k!=='_kf').length:null;const sample=lines&&typeof lines==='object'?Object.values(lines).find(v=>v&&typeof v==='object'):null;if(sample)row.entryFields=Object.keys(sample).slice(0,35);}if(payload&&typeof payload==='object')row.fields=[...new Set([...row.fields,...Object.keys(payload)])].slice(0,35);if(typeof timestamp==='string'&&Number.isFinite(Date.parse(timestamp))){row.firstTimestamp ||= timestamp;row.lastTimestamp=timestamp;}};
  socket.on('open',()=>{report.transport='connected';socket.send(JSON.stringify({protocol:'json',version:1})+'\x1e');});
  socket.on('message',chunk=>{buffer+=chunk.toString();if(buffer.length>1024*1024){report.transport='payload_limit';return finish();}const frames=buffer.split('\x1e');buffer=frames.pop();for(const raw of frames){let frame;try{frame=JSON.parse(raw);}catch{continue;}if(!subscribed&&!frame.type&&!frame.error){subscribed=true;socket.send(JSON.stringify({type:1,invocationId:'1',target:'Subscribe',arguments:[topics]})+'\x1e');}if(frame.type===1&&Array.isArray(frame.arguments))observe(frame.arguments[0],frame.arguments[1],frame.arguments[2],false);if(frame.type===3){if(frame.error)report.subscription='rejected';else{report.subscription='completed';for(const [topic,payload]of Object.entries(frame.result||{}))observe(topic,payload,null,true);}}if(frame.type===7){report.transport='server_closed';finish();}}});
  socket.on('unexpected-response',(_req,res)=>{report.transport='upgrade_denied';report.upgradeStatus=res.statusCode;res.resume();finish();});
  socket.on('error',()=>{report.transport='connection_error';finish();});
  socket.on('close',()=>{if(report.transport==='connected')report.transport='closed';finish();});
 });
})().catch(error=>{report.transport='probe_failed';report.errorType=error.name;}).finally(()=>console.log(JSON.stringify(report,null,2)));
