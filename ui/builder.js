let timerDirty=false,lastTemplateField=null;

// Tooltips live outside scrolling editors, and stay inside the visible viewport.
function showHelp(target){
	hideHelp();
	const tip=document.createElement('div');tip.id='builder-tooltip';tip.className='b-tooltip';tip.role='tooltip';tip.textContent=target.dataset.help;
	document.body.append(tip);target.setAttribute('aria-describedby',tip.id);
	const r=target.getBoundingClientRect(),box=tip.getBoundingClientRect();
	tip.style.left=Math.max(12,Math.min(innerWidth-box.width-12,r.left))+'px';
	tip.style.top=Math.max(12,r.bottom+8+box.height<innerHeight-12?r.bottom+8:r.top-box.height-8)+'px';
}
function hideHelp(){
	document.getElementById('builder-tooltip')?.remove();
	document.querySelector('[data-help][aria-describedby]')?.removeAttribute('aria-describedby');
}
document.addEventListener('pointerover',event=>{const target=event.target.closest('[data-help]');if(target)showHelp(target);});
document.addEventListener('pointerout',event=>{if(event.target.closest('[data-help]'))hideHelp();});
document.addEventListener('focusin',event=>{
	if(event.target.matches('[data-help]'))showHelp(event.target);
	if(event.target.matches('textarea[data-field],textarea[data-prop],input[data-field="noTargetText"],input[data-field="invalidTargetText"]'))lastTemplateField=event.target;
});
document.addEventListener('focusout',hideHelp);
document.addEventListener('scroll',hideHelp,true);
window.addEventListener('resize',hideHelp);
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideHelp();});

// Each template is a disabled independent copy, including target phrase variants.
function openTemplates(){
	document.querySelector('.b-template-dialog')?.remove();
	const dialog=document.createElement('dialog');dialog.className='b-template-dialog';
	const keys=['target','hug','choice','number','dice','text','combined','telegram','discord','commands'];
	dialog.innerHTML=`
		<div class="section-title">
			<h2>${t('chooseTemplate')}</h2>
			${iconButton('closeTemplates','x','close')}
		</div>
		<ul class="b-template-list">
			${keys.map((key,i)=>`<li><button class="b-template-button" data-action="createTemplate" data-kind="${key}">${icon(['user-round','heart','shuffle','percent','dices','text-cursor-input','combine','megaphone','megaphone','list'][i])}${t(key+'Template')}</button></li>`).join('\n')}
		</ul>
		<button class="primary b-action" data-action="addExamples">${icon('library')}${t('addExamples')}</button>
	`;
	document.body.append(dialog);icons();dialog.showModal();
}

// Timer fields remain editable until explicitly saved; navigation protects edits.
function renderAnnouncements(){
  const config=state.timerDraft?.settings||state.announcementSettings;
  timerDirty=!!state.timerDraft;
	$('#main').innerHTML=`
		<div class="page-scroll">
			<div class="b-timer-page">
				<div class="section-title"><h2>${t('autoAnnouncements')}</h2><button class="primary b-action" data-action="newTimer">${icon('plus')}${t('newTimer')}</button></div>
				<div class="b-announcement-warning" ${state.auth.announcementsAllowed?'hidden':''}>${t('announcementPermission')} <button data-view="connection">${t('connection')}</button></div>
				<section>
					<form id="announcement-rules" class="b-timer-form" data-dirty="${!!state.timerDraft?.settingsDirty}">
						<h3>${t('globalRules')}${help('timerRulesHelp')}</h3>
						<div class="grid three">
							${label('intervalMinutes',input('intervalMinutes',config.intervalMinutes,'number','min="1" max="1440"'),'timerIntervalHelp')}
							${label('minMessages',input('minMessages',config.minMessages,'number','min="0" max="10000"'),'timerRulesHelp')}
							<label class="check"><input data-field="onlyLive" type="checkbox" ${config.onlyLive?'checked':''}>${t('onlyLive')}</label>
						</div>
						<div class="section-title"><span class="notice" data-live-state>${t(state.live?'liveNow':'notLive')}</span><button class="b-action" type="submit">${icon('save')}${t('save')}</button></div>
					</form>
				</section>
				<ul class="b-timer-list">${(state.timerDraft?.timers||state.announcements).map(renderTimer).join('\n')}</ul>
				<div class="notice">${t('announcementNote')}</div>
			</div>
		</div>
	`;
}
function renderTimer(timer){
	timer={...timer,enabled:state.announcements.find(saved=>saved.id===timer.id)?.enabled??false};
	return `<li class="b-timer">
		<form class="b-timer-form" data-timer="${esc(timer.id||'')}" data-dirty="${!!timer.dirty}">
			<div class="section-title">
				<button type="button" class="b-timer-switch" role="switch" aria-checked="${!!timer.enabled}" data-action="toggleTimer">${icon('power')}${t(timer.enabled?'commandOn':'commandOff')}</button>
				${iconButton('removeTimer','trash-2','delete')}
			</div>
			<div class="grid two">${label('timerName',input('name',timer.name,'text','maxlength="80" required'))}${label('color',select('color',timer.color,['primary','blue','green','orange','purple']))}</div>
			${label('timerText',`<textarea data-field="text" rows="3" maxlength="500" required placeholder="${t('timerPlaceholder')}">${esc(timer.text)}</textarea>`,'timerTextHelp')}
			<div class="grid two">${label('intervalMinutes',input('intervalMinutes',timer.intervalMinutes,'number','min="1" max="1440"'),'timerIntervalHelp')}${label('minMessages',input('minMessages',timer.minMessages,'number','min="0" max="10000"'),'timerRulesHelp')}</div>
			<div class="tools"><button type="submit" class="primary b-action">${icon('save')}${t('save')}</button><span class="notice" data-timer-status>${t(timer.id&&!timer.dirty?'saved':'draft')}</span></div>
		</form>
	</li>`;
}
function timerFields(form){
	return Object.fromEntries([...form.querySelectorAll('[data-field]')].map(field=>[field.dataset.field,field.type==='checkbox'?field.checked:field.value]));
}
// Preserve incomplete timer edits just like command drafts, without activating them.
async function persistTimerDraft(){
	const rules=$('#announcement-rules');if(!rules)return;
	timerDirty=!!document.querySelector('[data-dirty="true"]');
	const value=timerDirty?{
		settings:timerFields(rules),settingsDirty:rules.dataset.dirty==='true',
		timers:[...document.querySelectorAll('[data-timer]')].map(form=>({...timerFields(form),id:form.dataset.timer||undefined,dirty:form.dataset.dirty==='true',enabled:form.querySelector('[role="switch"]').getAttribute('aria-checked')==='true'}))
	}:null;
	state.timerDraft=value;await call('timerDraft',value);
}
async function saveTimerForm(form,toggle=false){
	const enabled=form.querySelector('[role="switch"]').getAttribute('aria-checked')==='true';
	if(toggle&&enabled&&form.dataset.timer){
		await call('timerEnabled',{id:form.dataset.timer,enabled:false});
		const button=form.querySelector('[role="switch"]');button.setAttribute('aria-checked','false');button.innerHTML=icon('power')+t('commandOff');
		await persistTimerDraft();await refresh();icons();return;
	}
	if(!form.reportValidity())return;
	const saved=await call('saveTimer',{...timerFields(form),id:form.dataset.timer||undefined,enabled:toggle?!enabled:enabled});
	form.dataset.timer=saved.id;form.querySelector('[data-timer-status]').textContent=t('saved');form.dataset.dirty='';
	const button=form.querySelector('[role="switch"]');button.setAttribute('aria-checked',saved.enabled);button.innerHTML=icon('power')+t(saved.enabled?'commandOn':'commandOff');
	await persistTimerDraft();await refresh();icons();toast(t('timerSaved'));
}
document.addEventListener('input',event=>{
	const form=event.target.closest('.b-timer-form');if(form){form.dataset.dirty='true';timerDirty=true;const status=form.querySelector('[data-timer-status]');if(status)status.textContent=t('draft');void guard(persistTimerDraft);}
});
document.addEventListener('submit',event=>{
	const form=event.target;
	if(!form.matches('.b-timer-form'))return;
	event.preventDefault();
	void guard(async()=>{
		if(form.id==='announcement-rules'){
			state.announcementSettings=await call('announcementSettings',timerFields(form));form.dataset.dirty='';await persistTimerDraft();toast(t('saved'));
		}else await saveTimerForm(form);
	});
});
document.addEventListener('click',event=>void guard(async()=>{
	const button=event.target.closest('button');if(!button)return;
	const action=button.dataset.action;
	if(action==='examples'){collect();if(dirty)await persistDraft();openTemplates();}
	if(action==='closeTemplates')button.closest('dialog').close();
	if(action==='createTemplate'){
		const command=await call('create',button.dataset.kind);button.closest('dialog').close();await refresh();await choose(command.id);
	}
	if(action==='addExamples'){
		const added=await call('examples');button.closest('dialog').close();await refresh();await choose(added[0]?.id||selected);toast(t('examplesAdded'));
	}
	if(action==='toggleCommand'){
		button.disabled=true;collect();
		try{
			const saved=await call('enabled',{id:draft.id,enabled:!draft.enabled});draft.enabled=saved.enabled;
			if(dirty)await persistDraft();await refresh();renderList();renderEditor();icons();
		}finally{button.disabled=false;}
	}
	if(action==='replyMode'){
		collect();draft.responseMode=button.dataset.mode;
		if(draft.responseMode==='number'&&!draft.steps.some(s=>s.type==='number'&&s.variable===draft.responseVariable))draft.responseVariable=draft.steps.find(s=>s.type==='number')?.variable;
		await persistDraft();renderEditor();icons();
	}
	if(action==='insertVariable'){
		const field=lastTemplateField?.isConnected?lastTemplateField:document.querySelector('[data-field="responses"]');
		if(field){field.setRangeText('{'+button.dataset.variable+'}',field.selectionStart,field.selectionEnd,'end');field.focus();collect();await persistDraft();}
	}
	if(action==='newTimer'){
		const list=$('.b-timer-list');list.insertAdjacentHTML('beforeend',renderTimer({name:t('timerDefault'),text:'',enabled:false,color:'primary',intervalMinutes:10,minMessages:5}));
		list.lastElementChild.querySelector('[data-field="name"]').focus();timerDirty=true;list.lastElementChild.querySelector('form').dataset.dirty='true';await persistTimerDraft();icons();
	}
	if(action==='toggleTimer')await saveTimerForm(button.closest('form'),true);
	if(action==='removeTimer'&&await confirmAction('confirmDelete','delete')){
		const form=button.closest('form');if(form.dataset.timer)await call('removeTimer',form.dataset.timer);form.closest('li').remove();await persistTimerDraft();await refresh();
	}
}));
