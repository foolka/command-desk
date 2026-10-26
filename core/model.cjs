const {randomUUID}=require('node:crypto');
const TYPES=['target','choice','number','text'];
const BASE=['user','login','channel','args','arg1','command'];
const BOTS=['streamelements','streamlabs','nightbot','moobot','wizebot','fossabot','sery_bot'];
const clean=value=>String(value??'').normalize('NFC').trim();
const trigger=value=>{
  const s=clean(value).toLocaleLowerCase('en-US');
  if(!/^![\p{L}\p{N}_-]{1,40}$/u.test(s))throw Error('invalidTrigger');
  return s;
};
function number(value,min,max) {
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('invalidNumber');
  return n;
}
function text(value,max=500) {
  const s=clean(value);
  if(s.length>max)throw Error('tooLong');
  return s;
}
function template(value,known) {
  const s=text(value);
  for(const match of s.matchAll(/\{([^{}]+)\}/g))if(!known.has(match[1]))throw Error('unknownVariable');
  return s;
}
function normalize(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalidCommand');
  const c={id:input.id||randomUUID(),name:text(input.name||input.trigger,80),trigger:trigger(input.trigger),
    aliases:[...new Set(clean(input.aliases instanceof Array?input.aliases.join('\n'):input.aliases).split(/[\s,]+/u).filter(Boolean).map(trigger))],
    enabled:input.enabled!==false,role:input.role||'everyone',globalCooldown:number(input.globalCooldown??5,0,86400),
    userCooldown:number(input.userCooldown??15,0,86400),steps:[],responses:[]};
  if(!/^[a-f0-9-]{36}$/.test(c.id)||c.aliases.length>20||!['everyone','subscribers','vips','mods','broadcaster'].includes(c.role))throw Error('invalidCommand');
  const known=new Set(BASE);
  if(!Array.isArray(input.steps)||input.steps.length>12)throw Error('invalidSteps');
  for(const step of input.steps) {
    const s={type:step.type,variable:clean(step.variable)};
    if(!TYPES.includes(s.type)||!/^[a-z][a-z0-9_]{0,23}$/.test(s.variable)||known.has(s.variable))throw Error('invalidVariable');
    if(s.type==='target') {
      s.mode=step.mode||'argument_or_random';s.pool='online';s.allowSelf=!!step.allowSelf;
      if(!['argument_or_random','random','self','argument'].includes(s.mode))throw Error('invalidSteps');
    }else if(s.type==='choice') {
      s.choices=(Array.isArray(step.choices)?step.choices:clean(step.choices).split('\n')).map(v=>template(v,known)).filter(Boolean);
      if(!s.choices.length||s.choices.length>1000)throw Error('emptyChoices');
    }else if(s.type==='number') {
      s.min=number(step.min??1,-1000000,1000000);s.max=number(step.max??100,-1000000,1000000);
      if(s.min>s.max)throw Error('invalidNumber');
    }else s.text=template(step.text,known);
    c.steps.push(s);known.add(s.variable);
  }
  c.responses=(Array.isArray(input.responses)?input.responses:clean(input.responses).split('\n')).map(v=>template(v,known)).filter(Boolean);
  if(!c.responses.length||c.responses.length>3)throw Error('invalidResponses');
  c.noTargetText=template(input.noTargetText??'',new Set(BASE));
  c.invalidTargetText=template(input.invalidTargetText??'',new Set(BASE));
  return c;
}
function settings(input={}) {
  return {language:['ru','uk','en'].includes(input.language)?input.language:'ru',
    theme:input.theme==='dark'?'dark':'light',paused:!!input.paused,
    excluded:[...new Set((Array.isArray(input.excluded)?input.excluded:clean(input.excluded).split(/[\s,]+/)).map(v=>clean(v).replace(/^@/,'').toLowerCase()).filter(v=>/^[a-z0-9_]{1,25}$/.test(v)))].slice(0,1000)};
}
function sample(kind='target',language='ru') {
  const copy={
    ru:{target:'Укусить участника',choice:'Кто ты сегодня',t:'!кусь',c:'!кто',bite:'{user} кусает {target}!',who:'{user} сегодня {choice}.',choices:['главный по уюту','мастер случайностей','легенда этого чата'],none:'{user}, пока некого выбрать.',invalid:'{user}, укажи Twitch-ник после команды.'},
    uk:{target:'Вкусити учасника',choice:'Хто ти сьогодні',t:'!кусь',c:'!хто',bite:'{user} кусає {target}!',who:'{user} сьогодні {choice}.',choices:['головний із затишку','майстер випадковостей','легенда цього чату'],none:'{user}, поки немає кого обрати.',invalid:'{user}, вкажи Twitch-нік після команди.'},
    en:{target:'Bite a chatter',choice:'Who are you today',t:'!bite',c:'!who',bite:'{user} bites {target}!',who:'{user} is {choice} today.',choices:['the comfort captain','a master of surprises','a chat legend'],none:'{user}, nobody to choose yet.',invalid:'{user}, enter a Twitch username after the command.'}
  }[language]||null;
  const d=copy||{target:'Command',choice:'Command',t:'!command',c:'!command',bite:'{user} {target}',who:'{user} {choice}',choices:['one'],none:'',invalid:''};
  return normalize({trigger:kind==='target'?d.t:d.c,name:d[kind],steps:kind==='target'?[{type:'target',variable:'target'}]:[{type:'choice',variable:'choice',choices:d.choices}],responses:[kind==='target'?d.bite:d.who],noTargetText:d.none,invalidTargetText:d.invalid});
}
module.exports={normalize,settings,sample,BASE,BOTS,TYPES,trigger};
