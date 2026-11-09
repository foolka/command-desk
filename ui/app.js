let state,selected=null,draft=null,dirty=false,view='commands',query='',testValues={user:'ViewerOne',message:'',names:'ViewerTwo\nViewerThree\nViewerFour'},testResult=null;
let selectingCommand=false,draftWrite=Promise.resolve();
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=key=>dictionaries[state?.settings.language||'ru'][key]||dictionaries.en[key]||dictionaries.en.operationFailed;
const icon=name=>`<i data-lucide="${name}"></i>`;
const iconButton=(action,name,label,extra='')=>`<button type="button" class="icon" data-action="${action}" title="${esc(t(label))}" aria-label="${esc(t(label))}" ${extra}>${icon(name)}</button>`;
const help=key=>`<span class="help" tabindex="0" role="note" data-help="${esc(t(key))}" aria-label="${esc(t(key))}">${icon('circle-help')}</span>`;
const label=(key,content,tip='')=>`<label><span>${esc(t(key))}${tip?help(tip):''}</span>${content}</label>`;
const input=(field,value,type='text',extra='')=>`<input class="b-editor-field" data-field="${field}" type="${type}" value="${esc(value)}" ${extra}>`;
const textarea=(field,value,rows=3)=>`<textarea class="b-editor-field" data-field="${field}" rows="${rows}">${esc(Array.isArray(value)?value.join('\n'):value)}</textarea>`;
const options=(values,current)=>values.map(v=>`<option value="${v}" ${v===current?'selected':''}>${esc(t(v))}</option>`).join('');
const select=(field,current,values)=>`<select data-field="${field}">${options(values,current)}</select>`;
function icons(){lucide.createIcons({attrs:{'stroke-width':1.7}});}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,5000);}
async function call(action,data){const r=await window.desk[action](data);if(!r.ok)throw Error(r.error);return r.value;}
async function guard(fn){try{await fn();}catch(e){toast(t(e.message));}}
function applyAppearance(){
  document.documentElement.dataset.theme=state.settings.theme;document.documentElement.lang=state.settings.language;
  $('#language').value=state.settings.language;$('#theme').innerHTML=icon(state.settings.theme==='dark'?'sun':'moon');$('#theme').title=t('theme');$('#theme').ariaLabel=t('theme');
  $('#tray').innerHTML=icon('panel-top-close');$('#tray').title=t('tray');$('#tray').ariaLabel=t('tray');
  $('.version').textContent='v'+state.version;updateStatus();
}
function updateStatus(){
  const status=state.auth.status==='ready'?state.connection:state.auth.status;
  $('#status').textContent=(state.auth.user?.login?state.auth.user.login+' · ':'')+t(status);
  $('#status').className=status==='ready'?'connected':'';
  $('#audience-notice').hidden=!state.auth.user||state.auth.chattersAllowed;
  $('#audience-notice span').textContent=t('onlinePermission');
  $('#audience-notice button').textContent=t('connection');
  const notice=$('.b-announcement-warning');
  if(notice)notice.hidden=!!state.auth.announcementsAllowed||(view==='commands'&&draft?.delivery!=='announcement');
  const live=$('[data-live-state]');if(live)live.textContent=t(state.live?'liveNow':'notLive');
  const activity=$('#activity');
  if(activity){
    const active=state.commands.filter(c=>c.enabled).length;
    activity.textContent=state.settings.paused?t('commandsPaused'):`${t('activeCommands')}: ${active} / ${state.commands.length}`;
    activity.classList.toggle('inactive',state.settings.paused||!active);
  }
}
function renderNav(){
  $('#nav').innerHTML=['commands','autoAnnouncements','protection','audience','history','connection'].map((key,i)=>`<button class="${view===key?'active':''}" data-view="${key}">${icon(['terminal','megaphone','shield-check','users','history','plug'][i])}${esc(t(key))}</button>`).join('')+
    `<div class="nav-spacer"></div><span id="activity" role="status"></span>${iconButton('pause',state.settings.paused?'play':'pause',state.settings.paused?'resume':'pause')}`;
  updateStatus();
}
function renderList(){
  const list=$('#command-list');if(!list)return;
  const matches=state.commands.filter(c=>(c.name+' '+c.trigger).toLowerCase().includes(query.toLowerCase()));
  list.innerHTML=matches.map(c=>`<button class="command-row b-command-row ${c.id===selected?'selected':''}" data-select="${c.id}" draggable="true"><span class="dot ${c.enabled?'on':''}"></span><span><strong>${esc(c.trigger)}</strong><small>${esc(c.name)}</small><small class="command-state ${c.enabled?'on':''}">${t(c.enabled?'commandOn':'commandOff')}</small>${state.drafts?.[c.id]?`<small class="b-command-row__draft">${t('pendingChanges')}</small>`:''}</span><span class="b-command-row__grip" title="${t('dragCommand')}">${icon('grip-vertical')}</span></button>`).join('');
  for(const row of list.children)updateCommandColor(row,state.commands.find(c=>c.id===row.dataset.select));
  icons();
  $('#command-count').textContent=state.commands.length;
}
function render(){
  applyAppearance();renderNav();
  if(view==='commands'){
    $('#main').innerHTML=`<aside class="sidebar"><div class="section-title"><h2>${t('commands')}</h2><span id="command-count"></span></div>
      <div class="b-builder-tools"><button class="primary b-action" data-action="create">${icon('plus')}${t('newCommand')}</button><button class="b-action" data-action="examples">${icon('book-open')}${t('examples')}</button></div>
      <input id="search" aria-label="${esc(t('search'))}" placeholder="${esc(t('search'))}" value="${esc(query)}">
      <div id="command-list"></div><div class="sidebar-bottom">${iconButton('import','upload','import')}${iconButton('export','download','export')}</div></aside>
      <div class="workspace"><div id="editor"></div><aside id="simulation"></aside></div>`;
    renderList();renderEditor();renderSimulation();
  }else if(view==='connection')renderConnection();
  else if(view==='protection')renderProtection();
  else if(view==='autoAnnouncements')renderAnnouncements();
  else renderTable();
  icons();
}
function renderEditor(){
  const scroll=$('.editor-scroll')?.scrollTop||0;
  if(!draft){$('#editor').innerHTML=`<div class="empty">${icon('terminal')}<h2>${t('empty')}</h2><button class="primary" data-action="create">${icon('plus')}${t('newCommand')}</button></div>`;return;}
  draft.enabled=state.commands.find(command=>command.id===draft.id)?.enabled??false;
  $('#editor').innerHTML=`<form id="command-form"><div class="editor-scroll">
    <div class="section-title"><h2>${esc(draft.name)}</h2><div class="tools">${iconButton('moveCommandUp','arrow-up','moveCommandUp',state.commands[0]?.id===selected?'disabled':'')}${iconButton('moveCommandDown','arrow-down','moveCommandDown',state.commands.at(-1)?.id===selected?'disabled':'')}${iconButton('delete','trash-2','delete')}</div></div>
    <button type="button" role="switch" aria-checked="${!!draft.enabled}" class="b-command-switch" data-action="toggleCommand" aria-label="${t(draft.enabled?'commandDisable':'commandEnable')}">
      ${icon('power')}<span>${t(draft.enabled?'commandIsOn':'commandIsOff')}</span><span class="b-command-switch__state">${t(draft.enabled?'commandDisable':'commandEnable')}</span>
    </button>
    <section><h3 class="b-stage"><span class="b-stage__number">1</span>${t('when')}${help('enabledHelp')}</h3><div class="grid two">${label('name',input('name',draft.name,'text','maxlength="80"'))}
      ${label('trigger',input('trigger',draft.trigger,'text','maxlength="41"'),'triggerHelp')}
      ${label('aliases',input('aliases',Array.isArray(draft.aliases)?draft.aliases.join(' '):draft.aliases),'aliasHelp')}
      ${label('sidebarColor',`<div class="b-color-control"><input data-sidebar-color type="color" value="${esc(draft.sidebarColor||'#117e70')}" aria-label="${t('sidebarColor')}"><input data-field="sidebarColor" type="hidden" value="${esc(draft.sidebarColor||'')}">${iconButton('clearSidebarColor','rotate-ccw','clearSidebarColor')}</div>`)}
      </div></section>
    <section><h3 class="b-stage"><span class="b-stage__number">2</span>${t('build')}</h3>
      <div class="steps">${draft.steps.map(renderStep).join('')||`<div class="notice">${t('noSteps')}</div>`}</div>
      <div class="b-steps-add">${['target','choice','number','text'].map((kind,i)=>`<button type="button" class="b-action" data-action="addStep" data-kind="${kind}">${icon(['user-round','shuffle','dices','text-cursor-input'][i])}${t(kind)}</button>`).join('')}</div></section>
    <section><h3 class="b-stage"><span class="b-stage__number">3</span>${t('send')}</h3>
      <div class="grid two">${renderDelivery()}${label('color',select('color',draft.color||'primary',['primary','blue','green','orange','purple']).replace('data-field="color"',`data-field="color" ${draft.delivery==='announcement'?'':'disabled'}`))}</div>
      <div class="b-announcement-warning" ${draft.delivery==='announcement'&&!state.auth.announcementsAllowed?'':'hidden'}>${t('announcementPermission')} <button type="button" data-view="connection">${t('connection')}</button></div>
      <div class="b-segment" role="group" aria-label="${t('responseMode')}">${['all','random','number'].map(mode=>`<button type="button" class="b-segment__button" data-action="replyMode" data-mode="${mode}" ${mode==='number'&&!draft.steps.some(s=>s.type==='number')?'disabled':''} aria-pressed="${(draft.responseMode||'all')===mode}">${icon(mode==='random'?'shuffle':mode==='number'?'chart-no-axes-combined':'list')}${t(mode==='random'?'randomReply':mode==='number'?'byNumber':'all')}</button>`).join('')}</div>
      ${draft.responseMode==='number'?label('numberSource',numberSource('responseVariable',draft.responseVariable||'amount',draft.steps),'orderedHelp'):''}
      ${label('responses',textarea('responses',draft.responses,5),'responseHelp')}
      <div class="variables"><span>${t('variables')}</span>${['user','login','channel','args','arg1','command','commands',...draft.steps.map(s=>s.variable)].map(v=>`<button type="button" class="b-variable" data-action="insertVariable" data-variable="${esc(v)}" title="${esc(dictionaries[state.settings.language]['variable_'+v]||v)}">{${esc(v)}}</button>`).join('')}</div>
      <div class="grid two fallback">${label('noTargetText',input('noTargetText',draft.noTargetText))}
      ${label('invalidTargetText',input('invalidTargetText',draft.invalidTargetText))}</div></section>
    <section class="grid three">${label('role',select('role',draft.role,['everyone','subscribers','vips','mods','broadcaster']))}
      ${label('globalCooldown',input('globalCooldown',draft.globalCooldown,'number',`min="0" max="86400" ${state.settings.globalCooldowns?'':'disabled'}`),'globalGateHelp')}
      ${label('userCooldown',input('userCooldown',draft.userCooldown,'number','min="0" max="86400"'),'cooldownHelp')}</section>
    </div><footer><span id="save-status">${t(dirty?'draft':'saved')}</span><div class="tools">${iconButton('discard','undo-2','discard')}<button type="submit" class="primary">${icon('save')}${t('save')}</button></div></footer></form>`;
  $('.editor-scroll').scrollTop=scroll;
}
function renderStep(s,index){
  const prop=(key,html)=>html.replace(/data-field=/g,'data-prop=');
  const f=(key,tip='')=>label(key,prop(key,input(key,s[key]??'')),tip);
  let content='';
  if(s.type==='target')content=`<div class="grid two">${label('mode',prop('mode',select('mode',s.mode,['argument_or_random','random','self','argument'])),'targetHelp')}
    ${label('pool',`<input value="${esc(t('onlinePool'))}" readonly>`,'poolHelp')}</div><label class="check"><input data-prop="allowSelf" type="checkbox" ${s.allowSelf?'checked':''}>${t('allowSelf')}</label>`;
  if(s.type==='choice'){
    const previous=draft.steps.slice(0,index),mode=s.selectionMode||(previous.some(p=>p.type==='number'&&p.variable==='amount')?'number':'random');
    content=`<div class="grid two">${label('listSelection',`<select data-prop="selectionMode"><option value="random" ${mode==='random'?'selected':''}>${t('listRandom')}</option><option value="number" ${mode==='number'?'selected':''} ${previous.some(p=>p.type==='number')?'':'disabled'}>${t('byNumber')}</option></select>`,'orderedHelp')}${mode==='number'?label('numberSource',prop('numberVariable',numberSource('numberVariable',s.numberVariable||'amount',previous))):''}</div>`+label('choices',prop('choices',textarea('choices',s.choices,4)),mode==='number'?'orderedHelp':'');
  }
  if(s.type==='number')content=`<div class="grid two">${label('min',prop('min',input('min',s.min,'number','min="-1000000" max="1000000"')))}${label('max',prop('max',input('max',s.max,'number','min="-1000000" max="1000000"')))}</div>`;
  if(s.type==='text')content=label('textValue',prop('text',textarea('text',s.text,2)),'variableHelp');
  return `<div class="step" data-step="${index}"><div class="step-heading"><span class="step-index">${index+1}</span>${icon({target:'user-round',choice:'shuffle',number:'dices',text:'text-cursor-input'}[s.type])}<span class="b-step-label">${t(s.type)}</span>
    <div class="tools">${iconButton('up','arrow-up','up',`data-index="${index}" ${index===0?'disabled':''}`)}${iconButton('down','arrow-down','down',`data-index="${index}" ${index===draft.steps.length-1?'disabled':''}`)}${iconButton('removeStep','x','removeStep',`data-index="${index}"`)}</div></div>
    ${f('variable','variableHelp')}${content}</div>`;
}
function collect(){
  if(!$('#command-form')||!draft)return;
  for(const el of $('#command-form').querySelectorAll('[data-field]'))draft[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;
  draft.steps=[...$('#command-form').querySelectorAll('[data-step]')].map(el=>{
    const previous=draft.steps[Number(el.dataset.step)]||{},step={...previous};
    for(const field of el.querySelectorAll('[data-prop]'))step[field.dataset.prop]=field.type==='checkbox'?field.checked:field.value;
    return step;
  });
}
async function persistDraft(){
  dirty=true;const value=structuredClone(draft);
  state.drafts??={};state.drafts[value.id]=value;
  const row=[...document.querySelectorAll('[data-select]')].find(row=>row.dataset.select===value.id);
  if(row)updateCommandColor(row,value);
  // Serialize writes so a late keystroke cannot restore the previous editor after switching.
  draftWrite=draftWrite.catch(()=>{}).then(()=>call('draft',value));await draftWrite;
  if(selected===value.id&&$('#save-status'))$('#save-status').textContent=t('draft');
}
function stepDefaults(type,variable){return {type,variable,mode:'argument_or_random',pool:'online',allowSelf:false,choices:[''],min:1,max:100,text:''};}
function renderSimulation(){
  $('#simulation').innerHTML=`<h3>${t('simulation')}${help('previewHelp')}</h3>
    ${label('testUser',`<input id="test-user" maxlength="25" value="${esc(testValues.user)}">`)}
    ${label('testMessage',`<input id="test-message" value="${esc(testValues.message||draft?.trigger||'!command')}">`)}
    ${label('testAudience',`<textarea id="test-names" rows="4">${esc(testValues.names)}</textarea>`)}
    <button data-action="test" ${draft?'':'disabled'}>${icon('play')}${t('test')}</button>
    <div class="test-notice">${t('offlineTest')}</div><h4>${t('result')}</h4><div id="test-result">${renderResult()}</div>`;
}
function renderResult(){return testResult?`<div class="trace">${testResult.trace.map(r=>`<div><code>{${esc(r.variable)}}</code><span>${esc(r.value)}</span></div>`).join('')}</div>
  ${testResult.messages.length?testResult.messages.map(m=>`<div class="chat-reply">${esc(m)}</div>`).join(''):`<div class="muted">${t(testResult.reason||'noOutput')}</div>`}`:'<div class="muted">…</div>';}
function renderConnection(){
  $('#main').innerHTML=`<div class="page-scroll"><div class="settings-page"><h2>${t('connection')}</h2><section><h3>${t('account')}</h3>
    <strong id="account-name">${esc(state.auth.user?.login||t('signed_out'))}</strong><div class="notice">${t('authNote')}</div><div class="notice">${t('announcementNote')}</div><div class="b-announcement-warning" ${state.auth.announcementsAllowed?'hidden':''}>${t('announcementPermission')}</div>
    <div id="auth-controls"></div></section><section>${label('excluded',`<textarea id="excluded" rows="6">${esc(state.settings.excluded.join('\n'))}</textarea>`,'exclusionHelp')}<button class="primary" data-action="saveExcluded">${icon('save')}${t('save')}</button></section>
    <section><h3>${t('profile')}</h3><div class="data-path">${esc(state.dataPath)}</div><div class="notice">${t('privacy')}</div><div class="tools"><button data-action="openProfile">${icon('folder-open')}${t('profile')}</button><button data-action="backup">${icon('archive')}${t('backup')}</button></div></section></div></div>`;
  $('#main .settings-page').append(document.createElement('desk-taskbar'));
  renderAuth();
}
function renderAuth(){
  if(!$('#auth-controls'))return;
  $('#account-name').textContent=state.auth.user?.login||t('signed_out');
  $('#auth-controls').innerHTML=state.auth.pending?`<div class="auth-code"><span>${t('code')}</span><strong>${esc(state.auth.pending.code)}</strong></div><div class="tools"><button class="primary" data-action="openLogin">${t('openLogin')}</button><button data-action="cancelLogin">${t('cancelLogin')}</button></div>`:
    `<div class="tools"><button class="primary" data-action="login">${icon('log-in')}${t('login')}</button>${state.auth.user?`<button data-action="logout">${t('logout')}</button>`:''}</div>`;
}
function renderTable(){
  const people=view==='audience';
  $('#main').innerHTML=`<div class="page-scroll"><div class="section-title"><h2>${t(view)}</h2>${people?`<span>${state.audience.length}</span>`:`<button data-action="clearHistory">${icon('trash-2')}${t('clearHistory')}</button>`}</div>${people?`<div class="notice">${t(state.audienceStatus)}${state.audienceUpdatedAt!==null?' · '+new Date(state.audienceUpdatedAt).toLocaleTimeString():''}${help('poolHelp')}</div>`:''}<table><thead><tr>${(people?['name','presence']:['time','event','details']).map(k=>`<th>${t(k)}</th>`).join('')}</tr></thead><tbody>${
    people?state.audience.map(p=>`<tr><td>${esc(p.name)} <span class="muted">@${esc(p.login)}</span></td><td>${t('inChat')}</td></tr>`).join(''):
      state.history.map(r=>`<tr><td>${new Date(r.at).toLocaleTimeString()}</td><td>${t(r.code)}</td><td>${r.data.user?'@'+esc(r.data.user)+' ':''}${esc(r.data.command||'')} ${esc(r.data.message||'')}${r.data.seconds?' '+esc(r.data.seconds)+' '+t('secondsShort'):''}${r.data.status?esc(typeof r.data.status==='number'?'HTTP '+r.data.status:t(r.data.status)):''}${r.data.code?esc(t(r.data.code)):''}${r.data.count!==undefined?esc(r.data.count):''}</td></tr>`).join('')
  }</tbody></table>${(people?state.audience:state.history).length?'':`<div class="empty">${t(people?'noAudience':'noHistory')}</div>`}</div>`;
}
async function refresh(){
  state=await call('state');updateStatus();
  if(view==='connection'){renderAuth();icons();}
  if(view==='history'||view==='audience'){const scroll=$('.page-scroll')?.scrollTop||0;renderTable();$('.page-scroll').scrollTop=scroll;icons();}
}
async function choose(id){
  if(selectingCommand)return;
  if(id===selected&&dirty)return;
  selectingCommand=true;
  const editor=$('#editor');if(editor)editor.inert=true;
  try{
    collect();if(dirty)await persistDraft();else await draftWrite;
    if(id)state=await call('selectCommand',id);else await refresh();
    selected=id||null;const saved=state.drafts?.[selected];
    draft=structuredClone(saved||state.commands.find(c=>c.id===selected)||null);dirty=!!saved;
    testValues.message=draft?.trigger||'';testResult=null;render();
  }finally{selectingCommand=false;if(editor?.isConnected)editor.inert=false;}
}
document.addEventListener('input',e=>{
  if(e.target.id==='search'){query=e.target.value;renderList();return;}
  if(e.target.matches('[data-sidebar-color]'))$('[data-field=sidebarColor]').value=e.target.value;
  if(e.target.closest('#command-form')){collect();void guard(persistDraft);}
  if(e.target.id==='test-user')testValues.user=e.target.value;
  if(e.target.id==='test-message')testValues.message=e.target.value;
  if(e.target.id==='test-names')testValues.names=e.target.value;
});
document.addEventListener('change',e=>void guard(async()=>{
  if(e.target.dataset.prop==='type'){
    collect();const index=Number(e.target.closest('[data-step]').dataset.step);
    draft.steps[index]=stepDefaults(e.target.value,draft.steps[index].variable);await persistDraft();renderEditor();icons();
  }
  if(e.target.id==='language'){
    if(view==='autoAnnouncements')await persistTimerDraft();
    collect();state.settings=await call('settings',{...state.settings,language:e.target.value});render();
  }
}));
document.addEventListener('submit',e=>{
  if(e.target.id!=='command-form')return;e.preventDefault();
  void guard(async()=>{collect();await draftWrite;draft=await call('save',draft);dirty=false;await refresh();renderList();renderEditor();icons();});
});
document.addEventListener('click',e=>void guard(async()=>{
  const tab=e.target.closest('[data-view]');if(tab){if(view==='autoAnnouncements')await persistTimerDraft();collect();view=tab.dataset.view;await refresh();render();return;}
  const row=e.target.closest('[data-select]');if(row){await choose(row.dataset.select);return;}
  const button=e.target.closest('button');if(!button)return;
  let action=button.dataset.action;
  if(button.id==='theme'){collect();state.settings=await call('settings',{...state.settings,theme:state.settings.theme==='dark'?'light':'dark'});applyAppearance();icons();return;}
  if(button.id==='tray'){await call('tray');return;}
  if(!action)return;
  if(action==='create'){
    collect();if(dirty)await persistDraft();
    openTemplates();return;
  }
  if(action==='pause'){state.settings=await call('settings',{...state.settings,paused:!state.settings.paused});renderNav();icons();return;}
  if(action==='delete'){if(await confirmAction('confirmDelete','delete')){await draftWrite;await call('remove',selected);dirty=false;await refresh();await choose(state.commands[0]?.id);}return;}
  if(action==='discard'){if(!dirty||await confirmAction('confirmDiscard','discard')){await draftWrite;await call('draft',null);dirty=false;await choose(selected);}return;}
  if(['addStep','removeStep','up','down'].includes(action)){
    collect();const index=Number(button.dataset.index);
    if(action==='addStep'){if(draft.steps.length>=12)return;let n=1;while(draft.steps.some(s=>s.variable==='result'+n))n++;draft.steps.push(stepDefaults(button.dataset.kind||'choice','result'+n));}
    if(action==='removeStep')draft.steps.splice(index,1);
    if(action==='up'||action==='down'){const other=index+(action==='up'?-1:1);[draft.steps[index],draft.steps[other]]=[draft.steps[other],draft.steps[index]];}
    await persistDraft();renderEditor();icons();return;
  }
  if(action==='test'){collect();testResult=await call('preview',{command:draft,user:testValues.user,message:$('#test-message').value,names:testValues.names.split('\n').map(s=>s.trim()).filter(Boolean)});$('#test-result').innerHTML=renderResult();return;}
  if(action==='saveExcluded'){state.settings=await call('settings',{...state.settings,excluded:$('#excluded').value});toast(t('saved'));return;}
  if(action==='clearHistory'&&!await confirmAction('confirmClear','clearHistory'))return;
  if(['import','export','login','logout','openLogin','cancelLogin','clearHistory','openProfile','backup'].includes(action)){
    if(action==='import'&&dirty){collect();await persistDraft();}
    await call(action);await refresh();
    if(['import','clearHistory','logout'].includes(action))render();
    if(action==='backup')toast(t('saved'));
  }
}));
void guard(async()=>{state=await call('state');selected=state.draft?.id||state.selectedCommand||state.commands[0]?.id||null;draft=structuredClone(state.drafts?.[selected]||state.draft||null);dirty=!!draft;draft=draft||structuredClone(state.commands.find(c=>c.id===selected)||null);render();setInterval(()=>void guard(refresh),3000);});
