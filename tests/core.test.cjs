const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store,selectProfile}=require('../core/store.cjs');
const {sample,normalize,settings}=require('../core/model.cjs');
const {Audience,Engine,evaluate,fill,roleAllowed}=require('../core/engine.cjs');
function cleanup(root){assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'command-desk-test-'));fs.rmSync(root,{recursive:true,force:true});}
function temporary(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'command-desk-test-'));t.after(()=>cleanup(root));return root;}
function store(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'command-desk-test-')),s=new Store(root);t.after(()=>{s.close();cleanup(root);});return s;}
const event=(text='!кусь',extra={})=>({id:'1',userId:'1',name:'Alice',login:'alice',text,channel:'channel',channelId:'9',...extra});
function online(names=[],now=Date.now){const a=new Audience(now);a.replace(names.map(name=>({id:name==='Alice'?'1':name,login:name.toLowerCase(),name})));return a;}
test('Unicode triggers, aliases and all editable templates',()=>{
  const c=normalize({...sample(),trigger:'!КУСЬ',aliases:'!bite !хрусь',responses:['До {user}: {target}, после.']});
  const result=evaluate(c,event('!кусь @Bob'),new Audience());
  assert.equal(c.trigger,'!кусь');assert.equal(result.messages[0],'До Alice: Bob, после.');
  assert.equal(fill('{user}',{user:'{target}'}),'{target}');
});
test('Steps can combine participant, list, number and intermediate text',()=>{
  const c=normalize({...sample(),steps:[{type:'target',variable:'who',mode:'argument'},{type:'choice',variable:'action',choices:['обнимает','приветствует']},{type:'number',variable:'count',min:2,max:2},{type:'text',variable:'result',text:'{action} {who} {count} раз'}],responses:['{user} {result}']});
  assert.equal(evaluate(c,event('!кусь Bob'),new Audience(),{},(a,b)=>b===undefined?0:a).messages[0],'Alice обнимает Bob 2 раз');
});
test('Only preceding variables are accepted, no executable expressions',()=>{
  assert.throws(()=>normalize({...sample(),responses:['{process.exit()}']}),/unknownVariable/);
  assert.throws(()=>normalize({...sample(),steps:[{type:'text',variable:'x',text:'{later}'}]}),/unknownVariable/);
  assert.throws(()=>normalize({...sample(),steps:[{type:'text',variable:'user',text:'x'}]}),/invalidVariable/);
});
test('Online snapshots include silent users, deduplicate and remove users who left',()=>{
  let now=0;const a=online(['Alice','Silent','Silent'],()=>now);
  assert.equal(a.candidates(new Set(),'').length,2);
  a.replace([{id:'silent',login:'silent',name:'Silent'}]);
  assert.deepEqual(a.candidates(new Set(),'').map(x=>x.login),['silent']);
  now=90000;assert.equal(a.status(),'onlineStale');assert.deepEqual(a.candidates(new Set(),''),[]);
});
test('Random candidates exclude bots, configured logins, channel and self',()=>{
  const a=online(['Alice','Bob','Nightbot','Hidden','Channel']);
  const result=evaluate(sample(),event(),a,{excluded:['hidden']},()=>0);
  assert.equal(result.messages[0],'Alice кусает Bob!');
});
test('Empty pool and invalid nickname have editable replies or silence',()=>{
  const c=sample();c.noTargetText='Нет цели для {user}';assert.equal(evaluate(c,event(),online()).messages[0],'Нет цели для Alice');
  c.invalidTargetText='';assert.deepEqual(evaluate(c,event('!кусь bad/nick'),new Audience()).messages,[]);
});
test('Role checks do not grant VIP subscriber-only permissions',()=>{
  assert.equal(roleAllowed('subscribers',{vip:'1'}),false);assert.equal(roleAllowed('vips',{vip:'1'}),true);
  assert.equal(roleAllowed('mods',{broadcaster:'1'}),true);assert.equal(roleAllowed('broadcaster',{moderator:'1'}),false);
});
test('Store survives restarts, preserves IDs, rejects conflicting aliases',t=>{
  const root=temporary(t);let s=new Store(root);const c=s.save(sample());const id=s.meta('id');s.close();
  s=new Store(root);assert.equal(s.meta('id'),id);assert.equal(s.commands()[0].id,c.id);
  assert.throws(()=>s.save({...sample('choice'),aliases:['!кусь']}),/duplicateTrigger/);
  assert.equal(s.commands().length,1);s.close();
});
test('Missing established database never silently becomes empty',t=>{
  const root=temporary(t),s=new Store(root);s.save(sample());s.close();fs.renameSync(path.join(root,'commands.sqlite'),path.join(root,'kept.sqlite'));
  assert.throws(()=>new Store(root),/profileMissing/);assert.equal(fs.existsSync(path.join(root,'commands.sqlite')),false);
});
test('Import is additive and rejects all of a conflicting import',t=>{
  const s=store(t);s.save(sample());assert.throws(()=>s.import({version:1,commands:[sample('choice'),sample()]}),/duplicateTrigger/);
  assert.equal(s.commands().length,1);s.import({version:1,commands:[sample('choice')]});assert.equal(s.commands().length,2);
});
test('Draft and backups preserve incomplete edits',t=>{
  const s=store(t),c=s.save(sample());s.setMeta('draft',{...c,trigger:'!',responses:['unfinished']});
  assert.equal(s.meta('draft').trigger,'!');s.save({...c,responses:['new text']});
  assert.ok(fs.readdirSync(path.join(s.root,'backups')).length>=2);
});
test('Event replay, exact command boundary and cooldowns',t=>{
  let now=100000;const s=store(t);s.save(sample('choice'));
  const e=new Engine({store:s,now:()=>now,rng:()=>0});
  assert.equal(e.receive(event('!ктото')),null);
  assert.ok(e.receive(event('!кто',{id:'2'})));
  assert.equal(e.receive(event('!кто',{id:'2'})),null);
  now+=6000;assert.equal(e.receive(event('!кто',{id:'3'})).reason,'cooldownActive');
  now+=10000;assert.ok(e.receive(event('!кто',{id:'4'})));
});
test('Fallback replies obey the same final message length limit',()=>{
  const c=sample();
  c.noTargetText='{args}';
  c.steps[0].mode='random';
  assert.throws(()=>evaluate(c,event('!кусь '+'a'.repeat(501)),online()),/messageTooLong/);
  c.steps[0].mode='argument';
  c.invalidTargetText='{args}';
  assert.throws(()=>evaluate(c,event('!кусь '+'a'.repeat(501)),new Audience()),/messageTooLong/);
});
test('Own manual commands allowed, echoes and shared chat ignored',t=>{
  const s=store(t);s.save({...sample('choice'),globalCooldown:0,userCooldown:0});const e=new Engine({store:s});
  assert.equal(e.receive(event('!кто',{id:'1',echo:true})),null);
  assert.equal(e.receive(event('!кто',{id:'2',foreign:true})),null);
  assert.ok(e.receive(event('!кто',{id:'3',userId:'9',badges:{broadcaster:'1'}})));
});
test('Pause blocks commands, preview neither sends nor consumes cooldown',t=>{
  const s=store(t);s.save(sample());s.saveSettings({...s.settings(),paused:true});const e=new Engine({store:s});
  const result=e.receive(event('!кусь Bob'));assert.equal(result.reason,'commandsPaused');assert.deepEqual(result.messages,[]);
  assert.equal(e.preview(sample(),event('!кусь Bob'),[]).messages.length,1);
});
test('Final message length and integer bounds are enforced',()=>{
  assert.throws(()=>normalize({...sample(),globalCooldown:1.5}),/invalidNumber/);
  assert.throws(()=>normalize({...sample(),steps:[{type:'number',variable:'n',min:10,max:2}]}),/invalidNumber/);
  const c=normalize({...sample('choice'),responses:['{args}']});assert.throws(()=>evaluate(c,event('!кто '+'a'.repeat(501)),new Audience()),/messageTooLong/);
});
test('Profile selection cannot point tests at production',t=>{
  const root=temporary(t);assert.throws(()=>selectProfile(root,true,path.join(root,'test')),/unsafeTestProfile/);
  assert.equal(selectProfile(root,false,'ignored'),root);assert.throws(()=>selectProfile(root,true),/testProfileRequired/);
});
test('Translations have matching keys',()=>{
  const vm=require('node:vm');const dict=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/i18n.js'),'utf8')+';dictionaries');
  for(const lang of ['uk','en'])assert.deepEqual(Object.keys(dict[lang]).sort(),Object.keys(dict.ru).sort());
});
test('Known disabled commands and aliases explain silence without consuming cooldown',t=>{
  const s=store(t),c=s.save({...sample('choice'),enabled:false,aliases:['!who']});
  const e=new Engine({store:s});
  const result=e.receive(event('!who',{id:'disabled'}));
  assert.equal(result.reason,'commandDisabled');assert.equal(result.command,'!кто');assert.deepEqual(result.messages,[]);
  assert.equal(e.cooldowns.size,0);
  s.save({...c,enabled:true});assert.equal(e.receive(event('!who',{id:'enabled'})).messages.length,1);
});
test('Role rejection is reported without exposing unrelated messages',t=>{
  const s=store(t);s.save({...sample('choice'),role:'mods'});const e=new Engine({store:s});
  assert.equal(e.receive(event('!кто',{id:'role'})).reason,'roleBlocked');
  assert.equal(e.receive(event('ordinary chat',{id:'ordinary'})),null);
  assert.equal(e.receive(event('!unknown',{id:'unknown'})),null);
  assert.equal(e.receive(event('!кто',{id:'bot',login:'nightbot'})),null);
  assert.equal(e.cooldowns.size,0);
});
test('Legacy pools normalize to online without changing editable command content',()=>{
  for(const pool of ['minutes','messages','online',undefined]){
    const original={...sample(),responses:['До {user}, цель {target}, после.']};original.steps[0].pool=pool;
    const converted=normalize(original);assert.equal(converted.steps[0].pool,'online');
    assert.deepEqual({...converted,steps:original.steps},original);
  }
});
test('Old stored commands use online snapshots and never collect targets from messages',t=>{
  const s=store(t),c=s.save(sample());c.steps[0].pool='messages';s.commands=()=>[c];
  const e=new Engine({store:s});
  e.receive(event('hello',{id:'ordinary',userId:'Bob',login:'bob',name:'Bob'}));
  assert.equal(e.receive(event('!кусь',{id:'before-list'})).reason,'onlineLoading');
  assert.equal(e.cooldowns.size,0);
  e.audience.replace([{id:'Silent',login:'silent',name:'Silent'}]);
  assert.equal(e.receive(event('!кусь',{id:'after-list'})).messages[0],'Alice кусает Silent!');
});
test('Unavailable list blocks only random targets; explicit targets and choices work',()=>{
  const a=new Audience();a.clear('onlinePermission');
  assert.equal(evaluate(sample(),event(),a).reason,'onlinePermission');
  assert.equal(evaluate(sample(),event('!кусь @Bob'),a).messages[0],'Alice кусает Bob!');
  assert.equal(evaluate(sample('choice'),event('!кто'),a).messages.length,1);
});
test('List order and stripe colors survive restart without changing commands or drafts',t=>{
  const root=temporary(t);let s=new Store(root);
  const a=s.save({...sample(),sidebarColor:'#ff3355'}),b=s.save(sample('choice'));
  s.setMeta('draft',{...a,name:'Unfinished edit'});s.log('sent',{message:'keep'});
  const identity=s.meta('id'),history=s.history(),draft=s.meta('draft');
  s.reorder([b.id,a.id]);assert.deepEqual(s.commands(),[b,a]);
  assert.throws(()=>s.reorder([a.id,a.id]),/invalidOrder/);assert.throws(()=>s.reorder([a.id]),/invalidOrder/);
  assert.throws(()=>s.save({...a,sidebarColor:'url(https://example.com)'}),/invalidColor/);
  s.close();s=new Store(root);
  assert.equal(s.meta('id'),identity);assert.deepEqual(s.commands(),[b,a]);assert.deepEqual(s.history(),history);assert.deepEqual(s.meta('draft'),draft);
  const added=s.save({...sample(),trigger:'!new'});assert.deepEqual(s.commands().map(c=>c.id),[b.id,a.id,added.id]);
  s.remove(b.id);assert.deepEqual(s.commands().map(c=>c.id),[a.id,added.id]);s.close();
});
