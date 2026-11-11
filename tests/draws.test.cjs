const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Engine}=require('../core/engine.cjs');
const {normalize}=require('../core/model.cjs');
const {Twitch}=require('../core/twitch.cjs');

// Always choose the first eligible item to make a repeat deterministic.
const first=(low,high)=>high===undefined?0:low;
const command=(changes={})=>normalize({trigger:'!draw',steps:[],responses:['one','one','two'],
  responseMode:'random',userCooldown:0,aliases:['!alias'],...changes});
function fixture(...commands){
  const store={commands:()=>commands,settings:()=>({antiSpam:false,excluded:[]}),claim:()=>true,log:()=>{}};
  const engine=new Engine({store,rng:first});let id=0;
  const event=(text='!draw',user='alice')=>({id:String(++id),text,userId:user,login:user,name:user,channel:'host',channelId:'10'});
  const run=(...args)=>engine.receive(event(...args)).messages;
  return {engine,store,event,run};
}
// Keep Twitch IDs stable even if the list order or display name changes.
const users=(...names)=>names.map(name=>({id:name.toLowerCase(),login:name.toLowerCase(),name}));

test('Random replies skip duplicate lines per viewer and command across aliases',()=>{
  const f=fixture(command(),command({trigger:'!other',aliases:[]}));
  assert.deepEqual(f.run(),['one']);
  assert.deepEqual(f.run('!draw','bob'),['one']);
  assert.deepEqual(f.run('!other'),['one']);
  assert.deepEqual(f.run('!alias'),['two']);
  assert.deepEqual(f.run(),['one']);
});
test('Random steps and final replies maintain independent choices; rendered duplicates are avoided',()=>{
  const c=command({steps:[{type:'choice',variable:'a',choices:['{user}','@alice','A']},
    {type:'choice',variable:'b',choices:['X','X','Y']}],responses:['{a}{b}:1','{a}{b}:1','{a}{b}:2']});
  const {run}=fixture(c);
  assert.deepEqual(run(),['@aliceX:1']);assert.deepEqual(run(),['AY:2']);assert.deepEqual(run(),['@aliceX:1']);
});
test('Numeric rolls and number-mapped lines can repeat; fixed and sequential text is unchanged',()=>{
  const {run}=fixture(command({steps:[{type:'number',variable:'amount',min:9,max:100},
    {type:'choice',variable:'rank',selectionMode:'number',numberVariable:'amount',choices:['low','high']}],
    responseMode:'number',responseVariable:'amount',responses:['{rank} {amount}','top']}));
  assert.deepEqual(run(),['low 9']);assert.deepEqual(run(),['low 9']);
  for(const [mode,lines,expected] of [['random',['only','only'],['only']],['all',['a','b'],['a','b']]]){
    const f=fixture(command({responses:lines,responseMode:mode}));
    assert.deepEqual(f.run(),expected);assert.deepEqual(f.run(),expected);
  }
});
test('Implicit targets share history across commands/authors; typed nicks do not consume it',()=>{
  const opts={steps:[{type:'target',variable:'target'}],responses:['{target}']};
  const f=fixture(command(opts),command({...opts,trigger:'!hug',aliases:[]}));
  f.engine.audience.replace(users('Host','Alice','Nightbot','Bob','Ira'));
  assert.deepEqual(f.run(),['@Bob']);
  assert.deepEqual(f.run('!draw @Ira'),['@Ira']);assert.deepEqual(f.run('!draw Ira'),['@Ira']);
  f.engine.audience.replace(users('bob','Ira','Nightbot','Host'));
  assert.deepEqual(f.run('!hug','sam'),['@Ira']);
  f.engine.audience.replace(users('Ira','Host','Nightbot'));
  assert.deepEqual(f.run(),['@Ira']);assert.deepEqual(f.run(),['@Ira']);
  f.engine.audience.replace(users('Alice','Host','Nightbot'));assert.deepEqual(f.run(),[]);
});
test('Preview has separate history for unsaved commands, preview users and stable target logins',()=>{
  const c=command({steps:[{type:'target',variable:'target'}],responses:['{target} 1','{target} 2']});
  const f=fixture(c),input={...c,id:undefined};
  assert.deepEqual(f.engine.preview(input,f.event(),['Bob','Alice','Joy']).messages,['@Bob 1']);
  assert.deepEqual(f.engine.preview(input,f.event(),['Joy','Alice','Bob']).messages,['@Joy 2']);
  assert.deepEqual(f.engine.preview(input,f.event('!draw','sam'),['Bob','Joy']).messages,['@Bob 1']);
  f.engine.audience.replace(users('Bob','Joy'));assert.deepEqual(f.run(),['@Bob 1']);
});
test('A late invalid step cannot advance random choices',()=>{
  const c=command({steps:[{type:'choice',variable:'line',choices:['a','b']},{type:'target',variable:'who',mode:'argument'}],
    responses:['{line}']});
  const f=fixture(c);assert.deepEqual(f.run('!draw Ted'),['a']);assert.deepEqual(f.run('!draw bad/nick'),[]);
  assert.deepEqual(f.run('!draw Ted'),['b']);
});
test('Queue rejection does not consume the next reply; bursts reserve choices in order',t=>{
  const f=fixture(command()),twitch=new Twitch({auth:new EventEmitter(),store:f.store,test:true});
  t.after(()=>twitch.dispose());twitch.engine.rng=first;twitch.status='ready';
  twitch.receive(f.event());assert.equal(twitch.queue[0].message,'one');
  twitch.status='offline';twitch.receive(f.event());twitch.status='ready';
  twitch.receive(f.event());twitch.receive(f.event());
  assert.deepEqual(twitch.queue.map(item=>item.message),['one','two','one']);
});
