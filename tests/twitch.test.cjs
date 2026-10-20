const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Twitch}=require('../core/twitch.cjs');
const {sample}=require('../core/model.cjs');
function fixture(t){
 const auth=new EventEmitter();auth.saved={user:{id:'10',login:'host'}};auth.invalid=false;
 auth.validate=async()=>{};auth.getProvider=async()=>({});
 const logs=[],seen=new Set(),c={...sample('choice'),globalCooldown:0,userCooldown:0};
 const store={settings:()=>({excluded:[],paused:false}),commands:()=>[c],claim:id=>{if(seen.has(id))return false;seen.add(id);return true;},log:(code,data)=>logs.push({code,...data})};
 const twitch=new Twitch({auth,store,test:true});t.after(()=>twitch.dispose());
 twitch.status='ready';return {auth,logs,store,twitch,c,seen};
}
const event=(id='m1',more={})=>({id,text:'!кто',userId:'1',login:'viewer',name:'Viewer',channelId:'10',channel:'host',badges:{},...more});
test('Sends as broadcaster via official API, isolates shared chat',async t=>{
 const f=fixture(t),calls=[];f.twitch.api={chat:{sendChatMessage:async(...args)=>{calls.push(args);return{id:'out1'};}}};
 f.twitch.receive(event());await new Promise(r=>setImmediate(r));
 assert.equal(calls.length,1);assert.equal(calls[0][0],'10');assert.equal(calls[0][2].forSourceOnly,true);
 assert.ok(f.seen.has('out1'));f.twitch.receive(event('foreign',{foreign:true}));assert.equal(calls.length,1);
});
test('Echo before send acknowledgement is suppressed',async t=>{
 const f=fixture(t);f.c.responses=['!кто'];let release,count=0;
 f.twitch.api={chat:{sendChatMessage:async()=>{count++;await new Promise(r=>release=r);return{id:'echo'};}}};
 f.twitch.receive(event());f.twitch.receive(event('echo',{userId:'10',login:'host'}));
 assert.equal(count,1);assert.equal(f.twitch.queue.length,0);release();await new Promise(r=>setImmediate(r));
});
test('Ambiguous failures are logged without retry or raw errors',async t=>{
 const f=fixture(t);let count=0;f.twitch.api={chat:{sendChatMessage:async()=>{count++;throw Error('sensitive network message');}}};
 f.twitch.receive(event());await new Promise(r=>setImmediate(r));
 assert.equal(count,1);assert.equal(f.twitch.queue.length,0);assert.ok(f.logs.some(x=>x.code==='sendFailed'));assert.ok(!JSON.stringify(f.logs).includes('sensitive'));
});
test('Queue expires and pause clears pending messages',async t=>{
 const f=fixture(t);let count=0;f.twitch.api={chat:{sendChatMessage:async()=>{count++;return{id:'x'};}}};
 f.twitch.queue=[{message:'old',at:Date.now()-30000,command:'!old'}];await f.twitch.drain();
 assert.equal(count,0);assert.ok(f.logs.some(x=>x.code==='expired'));
 f.store.settings=()=>({paused:true});f.twitch.queue=[{message:'new',at:Date.now()}];await f.twitch.drain();assert.equal(f.twitch.queue.length,0);
});
test('SDK event adapter receives channel, user, badges and source',async t=>{
 const f=fixture(t);let callback;
 class Listener{
  onSubscriptionCreateSuccess(fn){this.ready=fn;}onSubscriptionCreateFailure(){}onRevoke(){}onUserSocketDisconnect(){}
  onChannelChatMessage(channel,user,cb){assert.equal(channel,'10');assert.equal(user,'10');callback=cb;}
  start(){this.ready();}stop(){}
 }
 f.twitch.sdk=async()=>({ApiClient:class {},EventSubWsListener:Listener});f.twitch.test=false;
 let received;f.twitch.receive=e=>received=e;await f.twitch.tick();
 callback({messageId:'id',messageText:'!кто',chatterId:'1',chatterName:'viewer',chatterDisplayName:'Viewer',badges:{vip:'1'},sourceBroadcasterId:'99'});
 assert.equal(received.foreign,true);assert.equal(received.badges.vip,'1');assert.equal(f.twitch.status,'ready');
});
