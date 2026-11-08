const {randomUUID,createHash}=require('node:crypto');
const {BOTS}=require('./model.cjs');

// Validate editable timer blocks without changing the existing command schema.
function normalizeTimer(input){
	const integer=(value,min,max)=>{
		const n=Number(value);
		if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('invalidNumber');
		return n;
	};
	const timer={id:input.id||randomUUID(),name:String(input.name||'').trim(),text:String(input.text||'').trim(),enabled:!!input.enabled,
		intervalMinutes:integer(input.intervalMinutes??10,1,1440),minMessages:integer(input.minMessages??5,0,10000),color:input.color||'primary'};
	if(!/^[a-f0-9-]{36}$/.test(timer.id)||!timer.name||timer.name.length>80||!timer.text||timer.text.length>500||!['primary','blue','green','orange','purple'].includes(timer.color))throw Error('invalidTimer');
	return timer;
}

// Both limits must pass; one global gate prevents simultaneous timer bursts.
class Announcements{
	constructor(store,now=Date.now){
		this.store=store;this.now=now;this.started=now();this.messages=0;this.seen=new Set();
	}
	settings(){return this.store.meta('announcementSettings',{intervalMinutes:10,minMessages:5,onlyLive:true});}
	activity(event){
		if(!event.id||this.seen.has(event.id)||event.foreign||event.echo||event.userId===event.channelId||[...BOTS,...this.store.settings().excluded].includes(String(event.login).toLowerCase()))return;
		this.seen.add(event.id);if(this.seen.size>10000)this.seen.delete(this.seen.values().next().value);
		this.messages++;
	}
	state(){return this.store.meta('announcementRuntime',{lastAt:0,blocks:{},texts:{}});}
	// Timers have no invoking viewer: expose only enabled commands open to everyone.
	render(text){
		if(!text.includes('{commands}'))return text;
		const commands=this.store.commands().filter(c=>c.enabled&&c.role==='everyone').map(c=>c.trigger).join(', ');
		if(!commands)return null;
		const message=text.replaceAll('{commands}',commands);
		return [...message].length<=500?message:null;
	}
	duplicate(message){
		const key=createHash('sha256').update(message.trim().replace(/\s+/g,' ').toLowerCase()).digest('hex');
		const at=this.state().texts[key];
		return at!==undefined&&this.now()-at<this.settings().intervalMinutes*60000;
	}
	next(live){
		const config=this.settings(),state=this.state(),now=this.now();
		if(this.store.settings().paused||(config.onlyLive&&!live)||now-Math.max(this.started,state.lastAt)<config.intervalMinutes*60000||this.messages<config.minMessages)return null;
		return (this.store.meta('announcements',[])).map(timer=>({...timer,text:this.render(timer.text)})).filter(timer=>timer.enabled&&timer.text&&
			now-Math.max(this.started,state.blocks[timer.id]||0)>=timer.intervalMinutes*60000&&
			this.messages>=timer.minMessages&&!this.duplicate(timer.text))
			.sort((a,b)=>(state.blocks[a.id]||0)-(state.blocks[b.id]||0))[0]||null;
	}
	reserve(message,id){
		const state=this.state(),now=this.now();
		state.lastAt=now;if(id)state.blocks[id]=now;
		state.texts=Object.fromEntries(Object.entries(state.texts).filter(([,at])=>now-at<86400000));
		state.texts[createHash('sha256').update(message.trim().replace(/\s+/g,' ').toLowerCase()).digest('hex')]=now;
		this.store.setMeta('announcementRuntime',state);this.messages=0;
	}
}
module.exports={Announcements,normalizeTimer};
