const {randomInt}=require('node:crypto');
const {BASE,BOTS,normalize}=require('./model.cjs');
const fill=(text,values)=>text.replace(/\{([a-z][a-z0-9_]*)\}/g,(_,key)=>values[key]??'');
const output=text=>{
  const message=String(text).replace(/[\r\n\x00-\x1f\x7f]/g,' ').trim();
  if(Array.from(message).length>500)throw Error('messageTooLong');
  return message;
};
class Audience {
  constructor(now=Date.now){this.now=now;this.clear();}
  replace(users){
    this.users=[...new Map(users.map(u=>[u.id,u])).values()];
    this.updatedAt=this.now();this.reason='onlineReady';
  }
  status(){return this.reason==='onlineReady'&&this.now()-this.updatedAt>=90000?'onlineStale':this.reason;}
  candidates(excluded,author,allowSelf=false) {
    if(this.status()!=='onlineReady')return [];
    return this.users.filter(m=>!excluded.has(m.login.toLowerCase())&&(allowSelf||m.id!==author));
  }
  clear(reason='onlineLoading'){this.users=[];this.updatedAt=null;this.reason=reason;}
}
function roleAllowed(role,badges={}) {
  const has=key=>Object.hasOwn(badges,key);
  if(has('broadcaster')||role==='everyone')return true;
  if(role==='broadcaster')return false;
  if(has('moderator'))return true;
  if(role==='mods')return false;
  return role==='vips'?has('vip'):has('subscriber')||has('founder');
}
function evaluate(command,event,audience,config={},rng=randomInt) {
  const parts=event.text.trim().split(/\s+/u);
  const values=Object.assign(Object.create(null),{user:event.name||event.login,login:event.login,channel:event.channel||'',args:parts.slice(1).join(' '),arg1:parts[1]||'',command:parts[0]});
  const excluded=new Set([...BOTS,...(config.excluded||[]),event.channel||''].map(s=>s.toLowerCase()));
  const trace=[];
  for(const s of command.steps) {
    let value;
    if(s.type==='target') {
      const explicit=s.mode==='argument'||(s.mode==='argument_or_random'&&values.arg1);
      if(s.mode==='self')value=values.user;
      else if(explicit) {
        const nick=values.arg1.replace(/^@/,'');
        if(!/^[a-z0-9_]{1,25}$/i.test(nick))return {messages:command.invalidTargetText?[output(fill(command.invalidTargetText,values))]:[],trace,reason:'invalidTarget'};
        value=nick;
      }else{
        if(audience.status()!=='onlineReady')return {messages:[],trace,reason:audience.status()};
        const candidates=audience.candidates(excluded,event.userId,s.allowSelf);
        if(!candidates.length)return {messages:command.noTargetText?[output(fill(command.noTargetText,values))]:[],trace,reason:'noTarget'};
        value=candidates[rng(candidates.length)].name;
      }
    }else if(s.type==='choice')value=fill(s.choices[rng(s.choices.length)],values);
    else if(s.type==='number')value=String(rng(s.min,s.max+1));
    else value=fill(s.text,values);
    values[s.variable]=value;trace.push({variable:s.variable,value});
  }
  const messages=command.responses.map(t=>output(fill(t,values))).filter(Boolean);
  return {messages,trace,reason:'ready'};
}
class Engine {
  constructor({store,now=Date.now,rng=randomInt}){Object.assign(this,{store,now,rng});this.audience=new Audience(now);this.cooldowns=new Map();}
  reset(){this.audience.clear();this.cooldowns.clear();}
  receive(event){
    if(!event.id||!event.userId||!event.login||typeof event.text!=='string')return null;
    if(!this.store.claim(event.id))return null;
    const config=this.store.settings();
    // Ignore shared-chat neighbours and messages emitted by this application.
    if(event.foreign||event.echo)return null;
    if([...BOTS,...config.excluded].includes(event.login.toLowerCase()))return null;
    const trigger=event.text.trim().split(/\s+/u)[0].toLowerCase();
    if(!trigger.startsWith('!'))return null;
    const c=this.store.commands().find(c=>c.trigger===trigger||c.aliases.includes(trigger));
    if(!c)return null;
    const skipped=reason=>({command:c.trigger,user:event.login,messages:[],trace:[],reason});
    if(config.paused)return skipped('commandsPaused');
    if(!c.enabled)return skipped('commandDisabled');
    if(!roleAllowed(c.role,event.badges))return skipped('roleBlocked');
    const now=this.now(),global=c.id,user=c.id+':'+event.userId;
    if(now<(this.cooldowns.get(global)||0)||now<(this.cooldowns.get(user)||0))return skipped('cooldownActive');
    const result={command:c.trigger,user:event.login,...evaluate(c,event,this.audience,config,this.rng)};
    if(result.reason.startsWith('online'))return result;
    this.cooldowns.set(global,now+c.globalCooldown*1000);this.cooldowns.set(user,now+c.userCooldown*1000);
    if(this.cooldowns.size>20000)for(const [k,v]of this.cooldowns)if(v<=now)this.cooldowns.delete(k);
    return result;
  }
  preview(input,event,names){
    const audience=new Audience(this.now);
    audience.replace(names.map((name,i)=>({id:'preview-'+i,login:name.toLowerCase(),name})));
    return evaluate(normalize(input),event,audience,this.store.settings(),this.rng);
  }
}
module.exports={Audience,Engine,evaluate,fill,roleAllowed,output};
