const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../core/store.cjs'),{sample}=require('../core/model.cjs');

// Every case has its own disposable profile, never the installed application's database.
function fixture(t){
	const root=fs.mkdtempSync(path.join(os.tmpdir(),'command-desk-drafts-'));
	let store=new Store(root);
	t.after(()=>{store.close();assert.ok(root.startsWith(path.join(os.tmpdir(),'command-desk-drafts-')));fs.rmSync(root,{recursive:true,force:true});});
	return {get store(){return store;},restart(){store.close();store=new Store(root);return store;}};
}

test('Legacy startup draft can be parked without applying it or changing command identity',t=>{
	const f=fixture(t),s=f.store,a=s.save(sample()),b=s.save(sample('choice'));
	const draft={...a,trigger:'!',name:'unfinished',sidebarColor:'#ff3355'},identity=s.meta('id');
	s.setMeta('draft',draft);
	assert.deepEqual(s.drafts(),{[a.id]:draft});assert.equal(s.meta('commandDrafts'),null);
	s.selectDraft(b.id);
	assert.equal(s.meta('draft'),null);assert.equal(s.meta('selectedCommand'),b.id);
	assert.deepEqual(s.commands(),[a,b]);assert.deepEqual(s.drafts(),{[a.id]:draft});
	const restarted=f.restart();assert.equal(restarted.meta('id'),identity);assert.equal(restarted.meta('selectedCommand'),b.id);
	restarted.selectDraft(a.id);assert.deepEqual(restarted.meta('draft'),draft);
});

test('Multiple invalid drafts persist independently across switches and restart',t=>{
	const f=fixture(t),s=f.store,a=s.save(sample()),b=s.save(sample('choice'));
	const da={...a,trigger:'!',responses:[]},db={...b,name:'',sidebarColor:'#11cc44'};
	s.saveDraft(da);s.selectDraft(b.id);s.saveDraft(db);s.selectDraft(a.id);
	assert.deepEqual(s.meta('draft'),da);assert.deepEqual(s.commands(),[a,b]);
	const restarted=f.restart();assert.deepEqual(restarted.drafts(),{[a.id]:da,[b.id]:db});
	restarted.selectDraft(b.id);assert.deepEqual(restarted.meta('draft'),db);
});

test('Saving, discarding and deleting a command retain other command drafts',t=>{
	const {store:s}=fixture(t),a=s.save(sample()),b=s.save(sample('choice'));
	const da={...a,name:'Draft A'},db={...b,name:'Draft B'};
	s.saveDraft(da);s.saveDraft(db);s.selectDraft(a.id);
	s.save(da);s.clearDraft(a.id);
	assert.deepEqual(s.drafts(),{[b.id]:db});assert.equal(s.commands()[0].name,'Draft A');
	s.saveDraft({...da,name:'Discard this'});s.saveDraft(null);
	assert.deepEqual(s.drafts(),{[b.id]:db});
	s.saveDraft({...da,name:'Delete this'});s.remove(a.id);
	assert.deepEqual(s.drafts(),{[b.id]:db});assert.deepEqual(s.commands(),[b]);
});

test('Invalid saves and unknown selections cannot discard parked drafts',t=>{
	const {store:s}=fixture(t),a=s.save(sample()),draft={...a,trigger:'!'};
	s.saveDraft(draft);const before=s.drafts();
	assert.throws(()=>s.save(draft));assert.throws(()=>s.selectDraft('unknown'),/notFound/);
	assert.throws(()=>s.saveDraft({...draft,id:'unknown'}),/notFound/);
	assert.throws(()=>s.saveDraft({...draft,name:'x'.repeat(600001)}),/tooLong/);
	assert.deepEqual(s.drafts(),before);assert.deepEqual(s.commands(),[a]);
});

test('Activation updates parked drafts without overwriting their incomplete text',t=>{
	const {store:s}=fixture(t),a=s.save({...sample(),enabled:true}),b=s.save(sample('choice'));
	s.saveDraft({...a,trigger:'!'});s.selectDraft(b.id);s.setEnabled({id:a.id,enabled:false});
	assert.equal(s.meta('draft'),null);assert.equal(s.drafts()[a.id].enabled,false);assert.equal(s.drafts()[a.id].trigger,'!');
	s.selectDraft(a.id);assert.equal(s.meta('draft').enabled,false);assert.equal(s.commands()[0].trigger,a.trigger);
});

test('Backup, reorder and additive import preserve all draft content',t=>{
	const {store:s}=fixture(t),a=s.save(sample()),b=s.save(sample('choice'));
	s.saveDraft({...a,name:'A edit'});s.saveDraft({...b,name:'B edit'});const drafts=s.drafts();
	s.reorder([b.id,a.id]);s.import({version:1,commands:[{...sample(),trigger:'!extra'}]});s.backup();
	assert.deepEqual(s.drafts(),drafts);
	const backups=fs.readdirSync(path.join(s.root,'backups')).map(file=>JSON.parse(fs.readFileSync(path.join(s.root,'backups',file),'utf8')));
	assert.ok(backups.some(backup=>JSON.stringify(backup.commandDrafts)===JSON.stringify(drafts)&&backup.selectedCommand===b.id));
});

test('Draft metadata transaction rolls back completely on a write failure',t=>{
	const {store:s}=fixture(t),a=s.save(sample()),b=s.save(sample('choice'));
	s.saveDraft({...a,name:'Original draft'});const before=s.drafts(),set=s.setMeta.bind(s);
	s.setMeta=(key,value)=>{if(key==='selectedCommand')throw Error('disk failure');set(key,value);};
	assert.throws(()=>s.selectDraft(b.id),/disk failure/);s.setMeta=set;
	assert.deepEqual(s.drafts(),before);assert.equal(s.meta('selectedCommand'),a.id);assert.deepEqual(s.meta('draft'),before[a.id]);
});
