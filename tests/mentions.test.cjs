const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {normalize,sample}=require('../core/model.cjs');
const {Audience,evaluate,fill}=require('../core/engine.cjs');
const {Twitch}=require('../core/twitch.cjs');
const event={id:'request',text:'!кусь',userId:'1',login:'alice',name:'Alice',channel:'host',channelId:'10'};

// Include names that differ from login to cover localized Twitch display names.
function audience(){
	const result=new Audience();
	result.replace([{id:'2',login:'bob',name:'Bob'},{id:'3',login:'viewer_three',name:'Зритель'}]);
	return result;
}

test('Both command author and explicit target are mentioned with or without a typed @',()=>{
	for(const text of ['!кусь Bob','!кусь @Bob'])assert.equal(evaluate(sample(),{...event,text},audience()).messages[0],'@Alice кусает @Bob!');
});
test('All random targets, not only the first participant, use valid mentions',()=>{
	let draw=0;
	const command=normalize({...sample(),steps:[{type:'target',variable:'first',mode:'random'},{type:'target',variable:'second',mode:'random'}],responses:['{user}: {first} + {second}.']});
	assert.equal(evaluate(command,event,audience(),{},()=>draw++).messages[0],'@Alice: @Bob + @viewer_three.');
});
test('Self target and localized author use account login, plain login stays available',()=>{
	const command=normalize({...sample(),steps:[{type:'target',variable:'self',mode:'self'}],responses:['{user} = {self}; https://twitch.tv/{login}']});
	assert.equal(evaluate(command,{...event,name:'Алиса'},audience()).messages[0],'@alice = @alice; https://twitch.tv/alice');
});
test('Already prefixed variables remain single mentions through intermediate text and choices',()=>{
	const command=normalize({...sample(),steps:[{type:'target',variable:'target',mode:'argument'},{type:'text',variable:'line',text:'@{target} обнимает @{user}'},{type:'choice',variable:'choice',choices:['@{line}!']}],responses:['{choice}','@@{target}, @{user}.']});
	assert.deepEqual(evaluate(command,{...event,text:'!кусь @Bob'},audience()).messages,['@Bob обнимает @Alice!','@Bob, @Alice.']);
	assert.equal(fill('{user}',{user:'{target}'}),'{target}');
	assert.equal(fill('mail@example.com; @{login}; @{amount}',{login:'alice',amount:'5'}),'mail@example.com; @alice; @5');
});
test('User text and arguments are not searched for names or rewritten',()=>{
	const command=normalize({...sample(),steps:[],responses:['{args} | {arg1} | Bob says Alice.']});
	assert.equal(evaluate(command,{...event,text:'!кусь Bob @Alice'},audience()).messages[0],'Bob @Alice | Bob | Bob says Alice.');
});
test('Fallbacks mention the author and invalid targets are still rejected',()=>{
	const command=normalize({...sample(),invalidTargetText:'@{user}, bad nickname',noTargetText:'{user}, nobody online'});
	assert.equal(evaluate(command,{...event,text:'!кусь bad/name'},audience()).messages[0],'@Alice, bad nickname');
	assert.equal(evaluate(command,{...event,text:'!кусь @@Bob'},audience()).reason,'invalidTarget');
	const empty=new Audience();empty.replace([]);
	assert.equal(evaluate(command,event,empty).messages[0],'@Alice, nobody online');
});
test('Mention prefixes count towards the 500-character limit',()=>{
	const command=normalize({...sample(),steps:[],responses:['{user}'+'x'.repeat(494)]});
	assert.equal(evaluate(command,event,audience()).messages[0].length,500);
	assert.throws(()=>evaluate({...command,responses:['{user}'+'x'.repeat(495)]},event,audience()),/messageTooLong/);
});
test('Real SDK request bodies contain both mentions for chat messages and announcements',async t=>{
	const {ApiClient}=await import('@twurple/api');
	for(const delivery of ['message','announcement']){
		const auth=new EventEmitter();auth.saved={user:{id:'10',login:'host'},token:{scope:['moderator:manage:announcements']}};
		const command=normalize({...sample(),delivery,userCooldown:0,globalCooldown:0,responses:['{user} и {target}.']});
		const saved=structuredClone(command),seen=new Set(),logs=[],meta=new Map();
		const store={meta:(key,fallback)=>meta.get(key)??fallback,setMeta:(key,value)=>meta.set(key,value),settings:()=>({excluded:[],paused:false}),commands:()=>[command],claim:id=>{if(seen.has(id))return false;seen.add(id);return true;},log:(code,data)=>logs.push({code,data})};
		const twitch=new Twitch({store,auth,test:true});t.after(()=>twitch.dispose());twitch.status='ready';
		const api=new ApiClient({authProvider:{clientId:'offline-test'}}),calls=[];
		api.callApi=async request=>{calls.push(request);return {data:[{message_id:'out',is_sent:true}]};};
		twitch.api=api;twitch.receive({...event,text:'!кусь @Bob'});await new Promise(resolve=>setImmediate(resolve));
		assert.equal(calls.length,1,JSON.stringify({delivery,logs}));assert.equal(calls[0].url,delivery==='message'?'chat/messages':'chat/announcements');
		assert.equal(calls[0].jsonBody.message,'@Alice и @Bob.');assert.deepEqual(command,saved);
		assert.ok(logs.some(row=>row.code==='sent'&&row.data.message==='@Alice и @Bob.'));
	}
});
