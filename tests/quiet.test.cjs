const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Twitch}=require('../core/twitch.cjs');
const {normalize,sample,settings}=require('../core/model.cjs');

// Exercise the real inbound queue with a fake clock and no Twitch transport.
function fixture(t,overrides={}){
  let time=300000,id=0;
  const config=settings({antiSpam:false,quietMode:true,quietPerMinute:2,...overrides});
  const cmd=normalize({...sample(),aliases:['!bite'],globalCooldown:0,userCooldown:0});
  const other=normalize({...cmd,id:undefined,trigger:'!other',aliases:[],responses:['first','second'],steps:[]});
  const seen=new Set(),store={settings:()=>config,claim:key=>!seen.has(key)&&!!seen.add(key),log:()=>{},commands:()=>[cmd,other]};
  const auth=new EventEmitter();auth.saved={user:{id:'100',login:'host'}};
  const app=new Twitch({store,auth,now:()=>time,test:true});
  t.after(()=>app.dispose());app.status='ready';
  app.engine.audience.replace([{id:'target',login:'target',name:'Target'}]);
  const event=(text,user='tester')=>({text,id:String(++id),userId:user,login:user,channel:'host',channelId:'100'});
  const send=(text,user)=>app.receive(event(text,user));
  return {app,cmd,config,store,event,send,advance:n=>{time+=n;}};
}
test('Normal spaces, NBSP and trailing invisible padding work for triggers, aliases and mentions',t=>{
  const f=fixture(t,{quietMode:false});
  for(const suffix of [' ','   ','\t','\u00a0',' \u034f','\u200b',' \u2063 ',' \u{e0000}']){
    for(const prefix of [f.cmd.trigger,'!BITE','!bite @Target']){
      f.send(prefix+suffix);assert.equal(f.app.queue.at(-1)?.message,'@tester кусает @Target!');
      f.app.queue=[];
    }
  }
  f.send('!bi\u200bte ');assert.equal(f.app.queue.length,0);
  f.send('!bite bad/name ');assert.match(f.app.queue.at(-1).message,/Twitch/);
});
test('Shared sliding budget: any viewer, command or alias; multiple replies cost one; exact expiry',t=>{
  const f=fixture(t);f.send('!other','a');f.advance(10000);f.send('!bite @Bob','b');
  f.advance(49999);
  for(let i=0;i<12;i++)f.send('!other','v'+i);
  assert.equal(f.app.queue.length,4);assert.equal(f.app.queue.filter(x=>x.quietNotice).length,1);
  assert.equal(f.app.queue.at(-1).delivery,'message');
  f.advance(1);f.send('!bite Ted','z');assert.match(f.app.queue.at(-1).message,/@Ted/);
  f.send('!other','new');assert.equal(f.app.queue.length,5);
});
test('Cooldown notice needs both message distance and time; duplicates and echoes are ignored',async t=>{
  const f=fixture(t,{quietPerMinute:1}),sent=[];
  f.app.api={chat:{sendChatMessage:async(_,line)=>{sent.push(line);return {id:'sent'+sent.length};}}};
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  f.send('!other');await flush();f.send('!other');f.advance(1300);await f.app.drain();
  f.advance(1300);await f.app.drain();
  assert.equal(sent.filter(s=>s.includes('перезарядке')).length,1);
  f.advance(60000);f.send('!bite Bob');await flush();
  f.send('!other');assert.equal(f.app.queue.length,0);
  const ev=f.event('hi');f.app.receive(ev);f.app.receive(ev);
  f.app.receive({...f.event('hello'),foreign:true});
  f.app.receive({...f.event('Команды чата на перезарядке. Попробуйте чуть позже.'),id:'sent3',userId:'100'});
  f.send('!other');assert.equal(f.app.queue.length,0);
  f.send('!other');assert.equal(f.app.queue.filter(x=>x.quietNotice).length,1);
  f.advance(1300);await f.app.drain();
  for(let i=0;i<15;i++)f.send('!other','b'+i);
  assert.equal(sent.filter(s=>s.includes('перезарядке')).length,2);assert.equal(f.app.queue.length,0);
});
test('Queued notice is discarded rather than sent after recovery or disabling quiet mode',async t=>{
  for(const disable of [false,true]){
    const f=fixture(t,{quietPerMinute:1});f.send('!bite Bob');f.send('!other');assert.ok(f.app.queue[1].quietNotice);
    f.app.queue.shift();const sent=[];f.app.api={chat:{sendChatMessage:async(_,line)=>{sent.push(line);return {};}}};
    if(disable)f.config.quietMode=false;else f.advance(60000);
    await f.app.drain();assert.deepEqual(sent,[]);assert.equal(f.app.queue.length,0);
  }
});
test('Unknown, disabled, duplicate, paused and queue-rejected requests and previews consume no budget',t=>{
  const f=fixture(t,{quietPerMinute:1});f.send('hello');f.send('!unknown');
  f.cmd.enabled=false;f.send('!bite Bob');f.cmd.enabled=true;
  f.config.paused=true;f.send('!other');f.config.paused=false;
  f.app.status='offline';const ev=f.event('!other');f.app.receive(ev);f.app.status='ready';f.app.receive(ev);
  f.app.engine.preview(f.cmd,f.event('!bite Ted'),[]);f.send('!bite Bob');
  assert.equal(f.app.queue.length,1);assert.match(f.app.queue[0].message,/@Bob/);
});
test('Limit validation and opt-in default leave existing settings and anti-spam intact',t=>{
  assert.equal(settings({}).quietMode,false);assert.equal(settings({}).quietPerMinute,5);
  for(const n of [0,121,1.5])assert.throws(()=>settings({quietPerMinute:n}),/invalidNumber/);
  const f=fixture(t,{antiSpam:true,quietMode:false});f.cmd.userCooldown=15;
  const result=text=>f.app.engine.receive(f.event(text));
  assert.equal(result('!bite Bob ').reason,'ready');assert.equal(result('!bite Bob \u200b').reason,'cooldownActive');
  assert.equal(result(f.cmd.trigger+' ').reason,'spamWarning');
});
