const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Twitch}=require('../core/twitch.cjs');
const {CHATTERS_SCOPE}=require('../core/twitch-auth.cjs');
const {sample}=require('../core/model.cjs');
function fixture(t){
 const auth=new EventEmitter();auth.saved={user:{id:'10',login:'host'},token:{scope:[CHATTERS_SCOPE]}};
 const logs=[],seen=new Set(),c=sample(),store={settings:()=>({excluded:[],paused:false}),commands:()=>[c],claim:id=>{if(seen.has(id))return false;seen.add(id);return true;},log:(code,data)=>logs.push({code,...data})};
 let now=100000;const twitch=new Twitch({auth,store,test:true,now:()=>now});t.after(()=>twitch.dispose());
 twitch.status='ready';return {auth,logs,store,twitch,c,advance:ms=>{now+=ms}};
}
const chatter=id=>({userId:String(id),userName:'user'+id,userDisplayName:'User'+id});
test('All pages are collected before publishing and next snapshot removes departed users',async t=>{
 const f=fixture(t),calls=[];let round=0;
 f.twitch.api={chat:{getChatters:async(user,params)=>{
  calls.push(params);assert.equal(user,'10');assert.equal(params.limit,1000);
  if(round)return{data:[chatter(2000)]};
  return params.after?{data:[chatter(999),chatter(1000)]}:{data:Array.from({length:1000},(_,i)=>chatter(i)),cursor:'next'};
 }}};
 await f.twitch.refreshAudience();assert.equal(calls.length,2);assert.equal(f.twitch.engine.audience.users.length,1001);
 await f.twitch.refreshAudience();assert.equal(calls.length,2);
 round=1;f.advance(30000);await f.twitch.refreshAudience();
 assert.deepEqual(f.twitch.engine.audience.users.map(u=>u.id),['2000']);
});
test('Partial or failed pages never become a biased target pool',async t=>{
 const f=fixture(t);f.twitch.engine.audience.replace([{id:'old',login:'old',name:'Old'}]);
 f.twitch.api={chat:{getChatters:async(_,params)=>{if(params.after)throw{statusCode:500};return{data:[chatter(1)],cursor:'more'};}}};
 await f.twitch.refreshAudience();assert.equal(f.twitch.engine.audience.status(),'onlineUnavailable');
 assert.deepEqual(f.twitch.engine.audience.users,[]);
 f.twitch.api.chat.getChatters=async()=>({data:[],cursor:'same'});f.advance(30000);
 await f.twitch.refreshAudience();assert.equal(f.twitch.engine.audience.status(),'onlineUnavailable');
});
test('Missing access never queries Twitch; restoring access allows refresh',async t=>{
 const f=fixture(t);let count=0;f.auth.saved.token.scope=[];
 f.twitch.api={chat:{getChatters:async()=>{count++;return{data:[chatter(1)]};}}};
 await f.twitch.refreshAudience();await f.twitch.refreshAudience();assert.equal(count,0);
 assert.equal(f.logs.filter(r=>r.code==='onlinePermission').length,1);
 f.auth.saved.token.scope=[CHATTERS_SCOPE];await f.twitch.refreshAudience();
 assert.equal(count,1);assert.equal(f.twitch.engine.audience.status(),'onlineReady');
});
test('Late results after logout cannot repopulate the list',async t=>{
 const f=fixture(t);let release;
 f.twitch.api={chat:{getChatters:()=>new Promise(resolve=>release=resolve)}};
 const running=f.twitch.refreshAudience();f.twitch.stop();release({data:[chatter(1)]});await running;
 assert.equal(f.twitch.engine.audience.status(),'onlineOffline');assert.deepEqual(f.twitch.engine.audience.users,[]);
});
test('Concurrent refreshes share one request; network failures recover on next interval',async t=>{
 const f=fixture(t);let release,calls=0;
 f.twitch.api={chat:{getChatters:()=>{calls++;return new Promise(resolve=>release=resolve)}}};
 const running=f.twitch.refreshAudience();await f.twitch.refreshAudience();assert.equal(calls,1);
 release({data:[chatter(1)]});await running;
 f.advance(30000);f.twitch.api.chat.getChatters=async()=>{throw{statusCode:403}};
 await f.twitch.refreshAudience();assert.equal(f.twitch.engine.audience.status(),'onlinePermission');
 f.advance(30000);f.twitch.api.chat.getChatters=async()=>({data:[chatter(2)]});
 await f.twitch.refreshAudience();assert.equal(f.twitch.engine.audience.users[0].id,'2');
});
test('Real SDK uses broadcaster permission and exposes silent participants correctly',async t=>{
 const f=fixture(t),{ApiClient}=await import('@twurple/api');
 const api=new ApiClient({authProvider:{clientId:'test'}});
 api.callApi=async request=>{
  assert.equal(request.url,'chat/chatters');assert.equal(request.userId,'10');
  assert.deepEqual(request.scopes,[CHATTERS_SCOPE]);assert.equal(request.query.broadcaster_id,'10');
  assert.equal(request.query.moderator_id,'10');assert.equal(request.query.first,'1000');
  return{data:[{user_id:'20',user_login:'silent',user_name:'Silent'}],pagination:{},total:1};
 };
 f.twitch.api=api;await f.twitch.refreshAudience();
 assert.deepEqual(f.twitch.engine.audience.users,[{id:'20',login:'silent',name:'Silent'}]);
 const result=f.twitch.engine.receive({id:'message',userId:'30',login:'speaker',name:'Speaker',text:'!кусь',channel:'host'});
 assert.equal(result.messages[0],'Speaker кусает Silent!');
});
test('A timed-out request cannot replace a newer successful snapshot',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(t);let release;
 f.twitch.api={chat:{getChatters:()=>new Promise(resolve=>release=resolve)}};
 const running=f.twitch.refreshAudience();t.mock.timers.tick(20000);await running;
 assert.equal(f.twitch.engine.audience.status(),'onlineUnavailable');
 f.advance(30000);f.twitch.api.chat.getChatters=async()=>({data:[chatter(2)]});
 await f.twitch.refreshAudience();
 release({data:[chatter(1)],cursor:'ignored'});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.twitch.engine.audience.users.map(u=>u.id),['2']);
});
