const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Engine,evaluate,Audience}=require('../core/engine.cjs');
const {normalize,settings,sample}=require('../core/model.cjs');
const {Twitch}=require('../core/twitch.cjs');
const {SpamGuard}=require('../core/spam.cjs');

// This store never reads a real profile or sends anything to Twitch.
function fixture(t,changes={}){
	let now=1000000,serial=0;
	const meta=new Map(),seen=new Set(),logs=[];
	let config=settings(changes);
	const command={...sample('choice'),globalCooldown:5,userCooldown:0,aliases:['!who']};
	const commands=[command,{...command,id:'2',trigger:'!second',aliases:[]}];
	const store={settings:()=>config,commands:()=>commands,meta:(key,fallback)=>meta.has(key)?structuredClone(meta.get(key)):fallback,setMeta:(key,value)=>meta.set(key,structuredClone(value)),
		claim:id=>{if(seen.has(id))return false;seen.add(id);return true;},log:(code,data)=>logs.push({code,...data})};
	const engine=new Engine({store,now:()=>now,rng:()=>0});
	const event=(user='1',trigger='!кто')=>({id:String(++serial),userId:user,login:'viewer'+user,name:'Viewer'+user,channelId:'host',channel:'host',text:trigger,badges:{}});
	const auth=new EventEmitter();auth.saved={user:{id:'host',login:'host'},token:{scope:['moderator:manage:announcements']}};
	const twitch=new Twitch({store,auth,test:true,now:()=>now});t.after(()=>twitch.dispose());twitch.status='ready';
	return {store,engine,command,commands,twitch,event,logs,advance:ms=>now+=ms,configure:input=>config=settings({...config,...input}),now:()=>now};
}

test('Ten different viewers pass together, shared cooldowns are opt-in',t=>{
	const f=fixture(t);
	for(let i=0;i<10;i++)assert.equal(f.engine.receive(f.event(String(i))).reason,'ready');
	f.configure({globalCooldowns:true});assert.equal(f.engine.receive(f.event('other')).reason,'cooldownActive');
});
test('Third repeat warns, fourth blocks all commands for 90 seconds, no Twitch timeout',t=>{
	const f=fixture(t);
	assert.equal(f.engine.receive(f.event()).reason,'ready');
	assert.equal(f.engine.receive(f.event('1','!who @Other')).reason,'ready');
	assert.equal(f.engine.receive(f.event('2')).reason,'ready');
	assert.equal(f.engine.receive(f.event('1','!КТО')).reason,'spamWarning');
	const blocked=f.engine.receive(f.event());assert.equal(blocked.reason,'spamPenalty');assert.equal(blocked.seconds,90);assert.equal(blocked.delivery,'message');
	assert.deepEqual(f.engine.receive(f.event('1','!second')).messages,[]);
	assert.equal(f.engine.receive(f.event('3')).reason,'ready');
	f.advance(90000);assert.equal(f.engine.receive(f.event()).reason,'ready');
});
test('Repeated abuse escalates within a stream across restart and reconnect',t=>{
	const f=fixture(t);f.engine.spam.session('host','stream1');
	for(let i=0;i<4;i++)f.engine.receive(f.event());
	f.engine.reset();assert.equal(f.engine.receive(f.event()).reason,'spamBlocked');
	const restarted=new Engine({store:f.store,now:f.now});
	assert.equal(restarted.receive(f.event()).reason,'spamBlocked');
	f.advance(90000);
	for(let i=0;i<3;i++)restarted.receive(f.event());
	assert.equal(restarted.receive(f.event()).seconds,600);
	restarted.spam.session('host',null);assert.equal(restarted.receive(f.event()).reason,'spamBlocked');
	restarted.spam.session('host','stream2');assert.equal(restarted.receive(f.event()).reason,'ready');
});
test('Only one viewer sequence counts; switching commands, expiry, duplicates and excluded events',t=>{
	const f=fixture(t);
	const first=f.event();f.engine.receive(first);assert.equal(f.engine.receive(first),null);
	f.engine.receive(f.event());f.engine.receive(f.event('1','!second'));
	assert.equal(f.engine.receive(f.event()).reason,'ready');
	f.advance(60000);assert.equal(f.engine.receive(f.event()).reason,'ready');
	assert.equal(f.engine.receive({...f.event(),foreign:true}),null);
	assert.equal(f.engine.receive({...f.event(),echo:true}),null);
	assert.equal(f.engine.receive(f.event()).reason,'ready');
	assert.equal(f.engine.receive(f.event()).reason,'spamWarning');
});
test('Personal cooldown attempts count, configurable limits and disabled protection',t=>{
	const f=fixture(t,{spamRepeats:2,spamWindowSeconds:10,spamFirstBlockSeconds:20,spamRepeatBlockSeconds:40});f.command.userCooldown=15;
	f.engine.receive(f.event());assert.equal(f.engine.receive(f.event()).reason,'spamWarning');assert.equal(f.engine.receive(f.event()).seconds,20);
	f.advance(20000);f.engine.receive(f.event());f.engine.receive(f.event());assert.equal(f.engine.receive(f.event()).seconds,40);
	f.configure({antiSpam:false});f.command.userCooldown=0;f.advance(15000);
	for(let i=0;i<10;i++)assert.equal(f.engine.receive(f.event()).reason,'ready');
	assert.throws(()=>settings({spamRepeats:1}),/invalidNumber/);assert.throws(()=>settings({spamFirstBlockSeconds:0}),/invalidNumber/);
});
test('Stream detection runs without timers and does not reset escalation on an API error',async t=>{
	const f=fixture(t);let stream='s1';
	f.twitch.api={streams:{getStreamByUserId:async()=>{if(stream==='fail')throw Error('network');return stream?{id:stream}:null;}}};
	await f.twitch.refreshLive();assert.equal(f.twitch.engine.spam.state.stream,'s1');
	f.twitch.engine.spam.state.viewers['1']={strikes:1};f.twitch.engine.spam.save();
	f.advance(60000);stream='fail';await f.twitch.refreshLive();assert.equal(f.twitch.engine.spam.state.viewers['1'].strikes,1);
	f.advance(60000);stream='s2';await f.twitch.refreshLive();assert.deepEqual(f.twitch.engine.spam.state.viewers,{});
});
test('Thirty replies from ten viewers drain with rate limits and no old 20s expiry',async t=>{
	const f=fixture(t);f.command.responses=['{user} 1','{user} 2','{user} 3'];f.command.responseMode='all';
	const calls=[];f.twitch.api={chat:{sendChatMessage:async(channel,message)=>{calls.push({message,at:f.now()});return {id:'out'+calls.length};}}};
	for(let i=0;i<10;i++)f.twitch.receive(f.event(String(i)));
	await new Promise(resolve=>setImmediate(resolve));assert.equal(f.twitch.queue.length,29);
	for(let tick=0;tick<120&&f.twitch.queue.length;tick++){
		f.advance(1200);clearTimeout(f.twitch.sendTimer);await f.twitch.drain();
	}
	assert.equal(calls.length,30);assert.ok(!f.logs.some(row=>['expired','queueFull','cooldownActive'].includes(row.code)));
	for(const call of calls)assert.ok(calls.filter(other=>other.at<=call.at&&other.at>call.at-30000).length<=20);
	assert.deepEqual(calls.map(call=>call.message),Array.from({length:10},(_,i)=>[1,2,3].map(n=>`@Viewer${i} ${n}`)).flat());
});
test('Manual command list is not suppressed by an automatic announcement with the same text',async t=>{
	const f=fixture(t);f.command.delivery='announcement';f.command.responses=['Available commands'];
	f.twitch.announcements.reserve('Available commands','timer');
	const sent=[];f.twitch.api={chat:{sendAnnouncement:async(channel,value)=>sent.push(value.message)}};
	for(let i=0;i<10;i++)f.twitch.receive(f.event(String(i)));
	await new Promise(resolve=>setImmediate(resolve));
	for(let i=0;i<10;i++){f.advance(2100);clearTimeout(f.twitch.sendTimer);await f.twitch.drain();}
	assert.equal(sent.length,10);assert.ok(!f.logs.some(row=>['duplicateAnnouncement','expired'].includes(row.code)));
});
test('Pending replies survive a socket reconnect, and viewers precede waiting timers',async t=>{
	const f=fixture(t);const sent=[];f.twitch.api={chat:{sendChatMessage:async(channel,message)=>{sent.push(message);return {id:'out'};}}};
	f.twitch.status='reconnecting';f.twitch.queue=[{message:'timer',timerId:'x',at:f.now()}];
	f.twitch.receive(f.event());await f.twitch.drain();assert.equal(f.twitch.queue.length,2);assert.equal(f.twitch.queue[0].user,'viewer1');
	f.twitch.status='ready';await f.twitch.drain();assert.equal(sent.length,1);
});
test('Ordered choices use amount bounds, retain explicit randomness and reject forward sources',()=>{
	const base={...sample('choice'),steps:[{type:'number',variable:'amount',min:0,max:100},{type:'choice',variable:'choice',choices:['bad','poor','okay','good','great']}],responses:['{amount}: {choice}']};
	const c=normalize(base),a=new Audience(),event={text:'!кто',login:'viewer'};
	for(const [n,word]of [[0,'bad'],[20,'bad'],[21,'poor'],[40,'poor'],[41,'okay'],[60,'okay'],[61,'good'],[80,'good'],[81,'great'],[100,'great']]){
		assert.deepEqual(evaluate(c,event,a,{},()=>n).messages,[`${n}: ${word}`]);
		assert.deepEqual(evaluate(base,event,a,{},()=>n).messages,[`${n}: ${word}`]);
	}
	c.steps[1].selectionMode='random';assert.equal(evaluate(c,event,a,{},(a,b)=>b?100:0).messages[0],'100: bad');
	assert.throws(()=>normalize({...base,steps:[base.steps[1],base.steps[0]].map(s=>s.type==='choice'?{...s,selectionMode:'number',numberVariable:'amount'}:s)}),/invalidNumberSource/);
	const negative=normalize({...base,steps:[{type:'number',variable:'amount',min:-10,max:10},base.steps[1]]});
	assert.equal(evaluate(negative,event,a,{},()=>-10).messages[0],'-10: bad');assert.equal(evaluate(negative,event,a,{},()=>10).messages[0],'10: great');
	const replies=normalize({...base,responseMode:'number',responseVariable:'amount',responses:['bad {amount}','great {amount}']});
	assert.deepEqual(evaluate(replies,event,a,{},()=>100).messages,['great 100']);
});
test('New defaults do not mutate stored commands, texts, settings or drafts',t=>{
	const f=fixture(t),before=structuredClone(f.commands);f.store.setMeta('draft',{text:'unfinished'});
	f.engine.receive(f.event());assert.deepEqual(f.commands,before);assert.deepEqual(f.store.meta('draft'),{text:'unfinished'});
	assert.equal(settings({}).globalCooldowns,false);assert.equal(settings({}).spamFirstBlockSeconds,90);
	const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
	const copy=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/i18n.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../ui/reliability.js'),'utf8')+';reliabilityCopy',{document:{addEventListener(){}}});
	for(const language of ['uk','en'])assert.deepEqual(Object.keys(copy[language]).sort(),Object.keys(copy.ru).sort());
});
