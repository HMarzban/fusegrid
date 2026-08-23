/* TRANSPORT — a transport-agnostic seam so future multiplayer can swap in a
   WebSocket without touching the sim or renderer. Phase-1 ships LocalTransport
   (in-process loopback, zero network) which is how single-player runs. */
import {encode, decode} from "./protocol.js";

/* Common interface every transport implements:
     connect()
     send(msg)
     on(type, cb) -> unsubscribe()
     close()  */
export class Transport{
 connect(){} send(){} on(){return ()=>{};} close(){}
}

/* Loopback: send() queues locally; onSnapshot/onEvent fire on the same tick.
   The client applies its own intent locally (prediction = the intent already
   in the world) and there is nothing to reconcile. This IS the single-player
   path; it also lets us test netcode end-to-end with zero latency. */
export class LocalTransport extends Transport{
  constructor(server){
    super();
    this._server=server || null;            // a function(world, inputMsg) or null
    this._subs={};                          // type -> [cb]
    this._queue=[];
     }
 connect(){ /* synchronous loopback */ }
 send(msg){
    // If a server is wired, run it now (authoritative). Otherwise no-op.
    if(this._server){
      this._server(msg, this);
       } else {
      this._queue.push(msg);
      }
     }
 on(type, cb){
    this._subs[type]=this._subs[type]||[];
    this._subs[type].push(cb);
    return ()=>{ this._subs[type]=this._subs[type].filter(c=>c!==cb); };
     }
 _emit(type, payload){
    const list=this._subs[type];
    if(list) for(const cb of list.slice()) cb(payload);
      }
 close(){ this._subs={}; this._queue=[]; }
}

/* WebSocketTransport — the network seam. Wired in Phase 2. The interface is
   identical to LocalTransport; swapping is a one-liner in main.js.
   NOT used today (no server), so it stays a clean, unused seam. */
export class WebSocketTransport extends Transport{
  constructor(url){
    super();
    this._url=url; this._ws=null; this._subs={};
    }
  connect(){
    if(typeof WebSocket==="undefined") return;
    this._ws=new WebSocket(this._url);
    this._ws.onmessage=(e)=>{
      const msg=decode(e.data);
      const list=this._subs[msg.type];
      if(list) for(const cb of list.slice()) cb(msg);
       };
     }
  send(msg){ if(this._ws && this._ws.readyState===1) this._ws.send(encode(msg)); }
  on(type, cb){
    this._subs[type]=this._subs[type]||[];
    this._subs[type].push(cb);
    return ()=>{ this._subs[type]=this._subs[type].filter(c=>c!==cb); };
     }
  close(){ if(this._ws){ this._ws.close(); this._ws=null; } this._subs={}; }
}
