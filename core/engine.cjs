const {randomInt}=require('node:crypto');
const {BASE,BOTS,normalize}=require('./model.cjs');
const fill=(text,values)=>text.replace(/\{([a-z][a-z0-9_]*)\}/g,(_,key)=>values[key]??'');
const output=text=>String(text).replace(/[\r\n\x00-\x1f\x7f]/g,' ').trim();
class Audience {
  constructor(now=Date.now){this.now=now;this.messages=[];}
  add(event){
    const at=this.now();
    this.messages.push({id:event.userId,login:event.login,name:event.name,at});
    const keepFrom=this.messages.length-30;
    this.messages=this.messages.filter((m,i)=>at-m.at<=900000||i>=keepFrom).slice(-50000);
  }
  candidates(pool,excluded,author,allowSelf=false) {
    const now=this.now(),messages=this.messages.filter(m=>now-m.at<=900000);
    const source=pool==='messages'?this.messages.slice(-30):messages;
    return [...new Map(source.map(m=>[m.id,m])).values()].filter(m=>!excluded.has(m.login.toLowerCase())&&(allowSelf||m.id!==author));
  }
  clear(){this.messages=[];}
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
        const candidates=audience.candidates(s.pool,excluded,event.userId,s.allowSelf);
        if(!candidates.length)return {messages:command.noTargetText?[output(fill(command.noTargetText,values))]:[],trace,reason:'noTarget'};
        value=candidates[rng(candidates.length)].name;
      }
    }else if(s.type==='choice')value=fill(s.choices[rng(s.choices.length)],values);
    else if(s.type==='number')value=String(rng(s.min,s.max+1));
    else value=fill(s.text,values);
    values[s.variable]=value;trace.push({variable:s.variable,value});
  }
  const messages=command.responses.map(t=>output(fill(t,values))).filter(Boolean);
  if(messages.some(m=>Array.from(m).length>500))throw Error('messageTooLong');
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
    this.audience.add(event);
    if(config.paused||[...BOTS,...config.excluded].includes(event.login.toLowerCase()))return null;
    const trigger=event.text.trim().split(/\s+/u)[0].toLowerCase();
    if(!trigger.startsWith('!'))return null;
    const c=this.store.commands().find(c=>c.enabled&&(c.trigger===trigger||c.aliases.includes(trigger)));
    if(!c||!roleAllowed(c.role,event.badges))return null;
    const now=this.now(),global=c.id,user=c.id+':'+event.userId;
    if(now<(this.cooldowns.get(global)||0)||now<(this.cooldowns.get(user)||0))return null;
    this.cooldowns.set(global,now+c.globalCooldown*1000);this.cooldowns.set(user,now+c.userCooldown*1000);
    if(this.cooldowns.size>20000)for(const [k,v]of this.cooldowns)if(v<=now)this.cooldowns.delete(k);
    return {command:c.trigger,user:event.login,...evaluate(c,event,this.audience,config,this.rng)};
  }
  preview(input,event,names){
    const audience=new Audience(this.now);
    for(const [i,name]of names.entries())audience.add({userId:'preview-'+i,login:name.toLowerCase(),name});
    return evaluate(normalize(input),event,audience,this.store.settings(),this.rng);
  }
}
module.exports={Audience,Engine,evaluate,fill,roleAllowed,output};
