const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {Store}=require('../core/store.cjs');
const {normalize,sample}=require('../core/model.cjs');
const {examples}=require('../core/examples.cjs');
const {Engine}=require('../core/engine.cjs');
const {Announcements,normalizeTimer}=require('../core/announcements.cjs');
const {Twitch}=require('../core/twitch.cjs');

function fixture(t){
	const root=fs.mkdtempSync(path.join(os.tmpdir(),'command-builder-test-')),store=new Store(root);
	t.after(()=>{store.beforeClose?.();store.close();assert.ok(root.startsWith(path.join(os.tmpdir(),'command-builder-test-')));fs.rmSync(root,{recursive:true,force:true});});
	return store;
}
const event={id:'a',text:'!кусь @Friend',userId:'1',login:'viewer',name:'Viewer',channelId:'10',channel:'host',badges:{}};

test('Examples cover every type in three languages; one random reply per target invocation',t=>{
	const store=fixture(t),engine=new Engine({store,rng:(min,max)=>max===undefined?min-1:min});
	for(const lang of ['ru','uk','en']){
		const catalogue=examples(lang);assert.equal(catalogue.length,10);
		assert.deepEqual(new Set(catalogue.flatMap(x=>x.command.steps.map(s=>s.type))),new Set(['target','number','choice','text']));
		for(const {command} of catalogue){
			assert.equal(command.enabled,false);
			const result=engine.preview(command,{...event,text:command.trigger+' @Friend'},['Friend']);
			assert.equal(result.messages.length,1);assert.ok(!/\{\w+\}/.test(result.messages[0]));
		}
		assert.ok(catalogue[0].command.responses.length>3);
	}
	const old=sample();assert.equal(normalize({...old,responseMode:undefined}).responseMode,'all');
	assert.equal(engine.preview({...old,steps:[],responses:['one','two']},event,[]).messages.length,2);
	assert.throws(()=>normalize({...old,responseMode:'all',responses:Array(4).fill('x')}),/invalidResponses/);
  const legacy=normalize({...old,steps:[{type:'text',variable:'commands',text:'legacy text'}],responses:['{commands}']});
  assert.equal(engine.preview(legacy,event,[]).messages[0],'legacy text');
});
test('Additive idempotent library preserves originals, history, identity, draft and settings',t=>{
	const store=fixture(t),old=store.save({...sample(),enabled:true,aliases:['!bite']});
	store.setMeta('draft',{...old,name:'unfinished',trigger:'!'});store.log('sent',{message:'keep'});
	const before={id:store.meta('id'),draft:store.meta('draft'),history:store.history(),settings:store.settings()};
	const added=store.addExamples();assert.equal(added.length,10);assert.equal(store.commands().length,11);
	assert.equal(added[0].trigger,'!кусь2');assert.ok(added.every(c=>!c.enabled));
	assert.equal(store.addExamples().length,0);assert.deepEqual(store.commands()[0],old);
	assert.deepEqual({id:store.meta('id'),draft:store.meta('draft'),history:store.history(),settings:store.settings()},before);
	store.setEnabled({id:old.id,enabled:false});assert.equal(store.meta('draft').trigger,'!');assert.equal(store.meta('draft').enabled,false);
});
test('Auto announcements require time AND messages, ignore bots, echoes and replays, rotate fairly',t=>{
	const store=fixture(t);let now=1000000;const scheduler=new Announcements(store,()=>now);
	const first=store.saveTimer({name:'one',text:'one',enabled:true}),second=store.saveTimer({name:'two',text:'two',enabled:true});
	for(let i=0;i<5;i++)scheduler.activity({...event,id:String(i)});
	scheduler.activity({...event,id:'0'});scheduler.activity({...event,id:'bot',login:'nightbot'});scheduler.activity({...event,id:'echo',echo:true});
	scheduler.activity({...event,id:'foreign',foreign:true});scheduler.activity({...event,id:'own',userId:'10'});
	assert.equal(scheduler.messages,5);assert.equal(scheduler.next(true),null);now+=600000;
	assert.equal(scheduler.next(false),null);assert.equal(scheduler.next(true).id,first.id);
	scheduler.reserve(first.text,first.id);assert.equal(scheduler.next(true),null);assert.equal(scheduler.messages,0);
	now+=600000;assert.equal(scheduler.next(true),null);
	for(let i=0;i<5;i++)scheduler.activity({...event,id:'b'+i});
	assert.equal(scheduler.next(true).id,second.id);
	store.saveSettings({...store.settings(),paused:true});assert.equal(scheduler.next(true),null);
});
test('Restart and duplicate texts never burst; manual announcements also reset timer gates',t=>{
	const store=fixture(t);let now=1000000;const a=new Announcements(store,()=>now);
	store.saveTimer({name:'one',text:'Same text',enabled:true,minMessages:0});
	store.saveTimer({name:'two',text:'  same   TEXT ',enabled:true,minMessages:0});
	store.saveAnnouncementSettings({intervalMinutes:10,minMessages:0,onlyLive:false});
	now+=600000;a.reserve('Same text');assert.equal(a.next(false),null);assert.equal(a.duplicate('same TEXT'),true);
	const b=new Announcements(store,()=>now);assert.equal(b.next(true),null);now+=599999;assert.equal(b.next(true),null);now++;
	assert.ok(b.next(false));
	assert.equal(normalizeTimer({name:'zero',text:'text',minMessages:0}).minMessages,0);
	assert.throws(()=>store.saveAnnouncementSettings({intervalMinutes:0,minMessages:0}),/invalidNumber/);
});
test('Announcement commands use real SDK endpoint and scope, not /announce in chat; no retry on timeout',async t=>{
	const store=fixture(t),auth=new EventEmitter();auth.saved={user:{id:'10',login:'host'},token:{scope:['moderator:manage:announcements']}};
	const c=store.save({...examples().find(e=>e.key==='telegram').command,enabled:true,globalCooldown:0,userCooldown:0});
	const twitch=new Twitch({store,auth,test:true});store.beforeClose=()=>twitch.dispose();twitch.status='ready';
	const {ApiClient}=await import('@twurple/api');const api=new ApiClient({authProvider:{clientId:'offline-test'}});let calls=0;
	api.callApi=async request=>{
		calls++;assert.equal(request.url,'chat/announcements');assert.deepEqual(request.scopes,['moderator:manage:announcements']);
		assert.equal(request.query.broadcaster_id,'10');assert.equal(request.query.moderator_id,'10');assert.equal(request.jsonBody.color,'blue');
		throw Error('ambiguous timeout');
	};
	twitch.api=api;twitch.receive({...event,text:c.trigger});await new Promise(r=>setImmediate(r));
 assert.equal(calls,1);twitch.lastSent=0;twitch.lastAnnouncement=0;
 twitch.receive({...event,id:'b',text:c.trigger});await new Promise(r=>setImmediate(r));assert.equal(calls,2);
 assert.ok(!store.history().some(row=>row.code==='duplicateAnnouncement'));
 auth.saved.token.scope=[];twitch.receive({...event,id:'c',userId:'other',text:c.trigger});assert.ok(store.history().some(row=>row.code==='announcementPermission'));
});
test('Automatic dispatch is disabled in test mode and fresh live status is required',t=>{
	const store=fixture(t),auth=new EventEmitter();auth.saved={token:{scope:['moderator:manage:announcements']}};
	const twitch=new Twitch({store,auth,test:true});store.beforeClose=()=>twitch.dispose();twitch.status='ready';
	store.saveTimer({name:'one',text:'hello',enabled:true,minMessages:0});store.saveAnnouncementSettings({intervalMinutes:1,minMessages:0,onlyLive:true});
	twitch.announcements.started=0;twitch.scheduleAnnouncement();assert.equal(twitch.queue.length,0);
	twitch.test=false;twitch.live=true;twitch.liveCheckedAt=0;twitch.scheduleAnnouncement();assert.equal(twitch.queue.length,0);
});
