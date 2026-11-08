const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../core/store.cjs');
const {Announcements}=require('../core/announcements.cjs');

// Use fresh isolated databases, never a Windows user's profile.
function profile(t){
	const root=fs.mkdtempSync(path.join(os.tmpdir(),'command-starter-'));
	t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;
}
test('Fresh profiles include ten disabled commands and a disabled timer in all languages',t=>{
	for(const language of ['ru','uk','en']){
		const root=profile(t);let store=new Store(root,Date.now,{starter:true,language});
		assert.equal(store.commands().length,10);assert.ok(store.commands().every(c=>!c.enabled));
		assert.equal(store.addExamples(language).length,0);
		const timers=store.meta('announcements');assert.equal(timers.length,1);assert.equal(timers[0].enabled,false);
		assert.ok(timers[0].text.includes('{commands}'));assert.equal(timers[0].intervalMinutes,10);assert.equal(timers[0].minMessages,5);
		const id=store.meta('id'),before=store.commands();store.close();
		store=new Store(root,Date.now,{starter:true,language});
		assert.equal(store.meta('id'),id);assert.deepEqual(store.commands(),before);assert.deepEqual(store.meta('announcements'),timers);
		for(const command of before)store.remove(command.id);store.removeTimer(timers[0].id);store.close();
		store=new Store(root,Date.now,{starter:true,language});assert.equal(store.commands().length,0);assert.equal(store.meta('announcements').length,0);store.close();
	}
});
test('Upgrades do not seed, reset or replace an existing profile, even an empty one',t=>{
	const root=profile(t);let store=new Store(root);const id=store.meta('id');store.log('keep',{message:'existing history'});
	store.setMeta('draft',{trigger:'!unfinished'});store.saveSettings({...store.settings(),theme:'dark'});
	const before={history:store.history(),draft:store.meta('draft'),settings:store.settings()};store.close();
	store=new Store(root,Date.now,{starter:true});assert.equal(store.meta('id'),id);assert.equal(store.commands().length,0);assert.equal(store.meta('announcements'),null);
	assert.deepEqual({history:store.history(),draft:store.meta('draft'),settings:store.settings()},before);store.close();
});
test('Timer list follows enabled public commands and deduplicates the rendered message',t=>{
	const root=profile(t),store=new Store(root,Date.now,{starter:true});
	try{
	let now=1000000;const scheduler=new Announcements(store,()=>now);
	assert.equal(scheduler.render('Commands: {commands}'),null);
	const [first,second]=store.commands();store.setEnabled({id:first.id,enabled:true});store.save({...second,enabled:true,role:'mods'});
	assert.equal(scheduler.render('Commands: {commands}'),'Commands: '+first.trigger);
	const timer=store.meta('announcements')[0];store.saveTimer({...timer,enabled:true,minMessages:0});
	store.saveAnnouncementSettings({intervalMinutes:10,minMessages:0,onlyLive:false});now+=600000;
	const selected=scheduler.next(false);assert.ok(selected);assert.ok(!selected.text.includes('{commands}'));
	scheduler.reserve(selected.text,selected.id);assert.equal(scheduler.duplicate(selected.text),true);
	store.setEnabled({id:first.id,enabled:false});now+=600000;assert.equal(scheduler.next(false),null);
	assert.equal(scheduler.render('x'.repeat(499)+'{commands}'),null);
	}finally{store.close();}
});
