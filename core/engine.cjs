const {randomInt}=require('node:crypto');
const {BASE,BOTS,normalize,settings}=require('./model.cjs');
const {SpamGuard,QuietWindow,quietMessage}=require('./spam.cjs');
// Ignore trailing chat padding, never remove characters inside names or text.
const chatText=text=>text.trimStart().replace(/[\s\u034f\u200b\u2060\u2063\u{e0000}]+$/u,'');
const words=text=>chatText(text).split(/\s+/u);
// Existing templates may already prefix a participant variable with @.
const fill=(text,values)=>text.replace(/(@*)\{([a-z][a-z0-9_]*)\}/g,(_,prefix,key)=>{
  const value=String(values[key]??'');return prefix&&value.startsWith('@')?value:prefix+value;
});
// A localized display name may not be a usable Twitch login.
function mention(login,name=login){
  const nick=String(login??'').replace(/^@+/,''),display=String(name??'');
  if(!/^[a-z0-9_]{1,25}$/i.test(nick))return display||nick;
  return '@'+(display.toLowerCase()===nick.toLowerCase()?display:nick);
}
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
// Equal integer ranges map low values to the first line and the maximum to the last.
function scaledChoice(choices,value,step){
  const span=step.max-step.min+1;
  const index=step.max>step.min&&Number(value)>=step.max?choices.length-1:Math.min(choices.length-1,Math.max(0,Math.floor((Number(value)-step.min)*choices.length/span)));
  return choices[index];
}
// Prefer a different template and visible line, even when the list contains duplicates.
function randomLine(lines,values,previous,rng){
  if(!previous)return lines[rng(lines.length)];
  let best=-1,pool=[];
  for(const line of lines){
    const rank=(line!==previous.template?1:0)+(fill(line,values)!==previous.text?2:0);
    if(rank>best){best=rank;pool=[];}
    if(rank===best)pool.push(line);
  }
  return pool[rng(pool.length)];
}
function evaluate(command,event,audience,config={},rng=randomInt,memory,remember=commit=>commit()) {
  const parts=words(event.text);
  const values=Object.assign(Object.create(null),{user:mention(event.login,event.name),login:event.login,channel:event.channel||'',args:parts.slice(1).join(' '),arg1:parts[1]||'',command:parts[0],commands:config.commandList||''});
  const excluded=new Set([...BOTS,...(config.excluded||[]),event.channel||''].map(s=>s.toLowerCase()));
  const trace=[],numbers=new Map();
  const channel=event.channelId||event.channel||'',pending=new Map();
  // A rejected or incomplete command must not consume the next draw.
  const drawLine=(lines,slot)=>{
    const key=JSON.stringify([channel,command.id,event.userId,slot]);
    const template=randomLine(lines,values,memory?.get(key),rng);
    pending.set(key,{template,text:fill(template,values)});
    return template;
  };
  for(const s of command.steps) {
    let value;
    if(s.type==='target') {
      const explicit=s.mode==='argument'||(s.mode==='argument_or_random'&&values.arg1);
      if(s.mode==='self')value=values.user;
      else if(explicit) {
        const nick=values.arg1.replace(/^@/,'');
        if(!/^[a-z0-9_]{1,25}$/i.test(nick))return {messages:command.invalidTargetText?[output(fill(command.invalidTargetText,values))]:[],trace,reason:'invalidTarget'};
        value=mention(nick);
      }else{
        if(audience.status()!=='onlineReady')return {messages:[],trace,reason:audience.status()};
        const candidates=audience.candidates(excluded,event.userId,s.allowSelf);
        if(!candidates.length)return {messages:command.noTargetText?[output(fill(command.noTargetText,values))]:[],trace,reason:'noTarget'};
        const key=JSON.stringify([channel,'target']),previous=pending.get(key)??memory?.get(key);
        const others=previous!==undefined?candidates.filter(p=>p.id!==previous):candidates;
        const pool=others.length?others:candidates;
        const participant=pool.length===1?pool[0]:pool[rng(pool.length)];
        pending.set(key,participant.id);
        value=mention(participant.login,participant.name);
      }
    }else if(s.type==='choice'){
      const mode=s.selectionMode||(numbers.has('amount')?'number':'random');
      const source=numbers.get(s.numberVariable||'amount');
      if(mode==='number'&&!source)throw Error('invalidNumberSource');
      value=fill(mode==='number'?scaledChoice(s.choices,values[source.variable],source):drawLine(s.choices,'step:'+s.variable),values);
    }
    else if(s.type==='number'){value=String(rng(s.min,s.max+1));numbers.set(s.variable,s);}
    else value=fill(s.text,values);
    values[s.variable]=value;trace.push({variable:s.variable,value});
  }
  let replies=command.responseMode==='random'?[drawLine(command.responses,'response')]:command.responses;
  if(command.responseMode==='number'){
    const source=numbers.get(command.responseVariable||'amount');
    if(!source)throw Error('invalidNumberSource');
    replies=[scaledChoice(command.responses,values[source.variable],source)];
  }
  const messages=replies.map(t=>output(fill(t,values))).filter(Boolean);
  if(memory&&messages.length&&pending.size)remember(()=>{
    for(const [key,value] of pending){memory.delete(key);memory.set(key,value);}
    while(memory.size>20000)memory.delete(memory.keys().next().value);
  });
  return {messages,trace,reason:'ready'};
}
class Engine {
  constructor({store,now=Date.now,rng=randomInt}){Object.assign(this,{store,now,rng});this.audience=new Audience(now);this.cooldowns=new Map();this.spam=new SpamGuard(store,now);this.quiet=new QuietWindow(now);this.draws=new Map();this.previewDraws=new Map();}
  reset(){this.audience.clear();this.cooldowns.clear();}
  receive(event,remember){
    if(!event.id||!event.userId||!event.login||typeof event.text!=='string')return null;
    if(!this.store.claim(event.id))return null;
    const config=settings(this.store.settings());
    // Ignore shared-chat neighbours and messages emitted by this application.
    if(event.foreign||event.echo)return null;
    if([...BOTS,...config.excluded].includes(event.login.toLowerCase()))return null;
    this.quiet.observe(event.channelId||event.channel||'');
    const trigger=words(event.text)[0].toLowerCase();
    if(!trigger.startsWith('!'))return null;
    const c=this.store.commands().find(c=>c.trigger===trigger||c.aliases.includes(trigger));
    if(!c)return null;
    const skipped=reason=>({command:c.trigger,user:event.login,messages:[],trace:[],reason});
    if(config.paused)return skipped('commandsPaused');
    if(!c.enabled)return skipped('commandDisabled');
    if(!roleAllowed(c.role,event.badges))return skipped('roleBlocked');
    if(this.quiet.full(config))return {...skipped('quietCooldown'),delivery:'message',
      messages:this.quiet.canNotify()?[quietMessage[config.language]]:[]};
    const spam=this.spam.check(event,c,config);
    if(spam)return {...skipped(spam.reason),delivery:'message',...spam};
    const now=this.now(),global=c.id,user=c.id+':'+event.userId;
    if((config.globalCooldowns&&now<(this.cooldowns.get(global)||0))||now<(this.cooldowns.get(user)||0))return skipped('cooldownActive');
    config.commandList=this.store.commands().filter(item=>item.enabled&&roleAllowed(item.role,event.badges)).map(item=>item.trigger).join(', ');
    let draw;
    const result={command:c.trigger,user:event.login,delivery:c.delivery||'message',color:c.color||'primary',...evaluate(c,event,this.audience,config,this.rng,this.draws,commit=>{draw=commit;})};
    if(result.messages.length&&(draw||config.quietMode)){
      const accepted=()=>{draw?.();if(config.quietMode)this.quiet.record();};
      if(remember)remember(accepted);else accepted();
    }
    if(result.reason.startsWith('online'))return result;
    this.cooldowns.set(global,now+c.globalCooldown*1000);this.cooldowns.set(user,now+c.userCooldown*1000);
    if(this.cooldowns.size>20000)for(const [k,v]of this.cooldowns)if(v<=now)this.cooldowns.delete(k);
    return result;
  }
  preview(input,event,names){
    const audience=new Audience(this.now);
    const previewEvent={...event,userId:event.login.toLowerCase()};
    audience.replace(names.map(name=>({id:name.toLowerCase(),login:name.toLowerCase(),name})));
    const command=normalize(input);
    // Unsaved previews have no permanent command ID yet.
    if(!input.id)command.id=command.trigger;
    return evaluate(command,previewEvent,audience,{...this.store.settings(),commandList:this.store.commands().filter(c=>c.enabled).map(c=>c.trigger).join(', ')},this.rng,this.previewDraws);
  }
}
module.exports={Audience,Engine,evaluate,fill,roleAllowed,output,chatText};
