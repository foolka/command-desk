const reliabilityCopy = {
	ru: {
		cancelAction:'Отмена',
		pendingChanges:'Есть черновик',
		sidebarColor:'Цвет боковой полосы',clearSidebarColor:'Сбросить цвет полосы',dragCommand:'Перетащить команду',moveCommandUp:'Поднять команду в списке',moveCommandDown:'Опустить команду в списке',invalidOrder:'Список команд изменился. Обнови его и повтори перемещение.',invalidColor:'Выбери цвет полосы.',
		protection:'Защита',antiSpam:'Защита от повторов одного зрителя',spamRepeats:'Повторов до предупреждения',spamWindowSeconds:'Окно подсчёта, сек.',spamFirstBlockSeconds:'Первая блокировка, сек.',spamRepeatBlockSeconds:'Повторная за эфир, сек.',
		spamHelp:'Считаются одинаковые команды подряд от одного зрителя, включая псевдонимы и попытки во время его перезарядки. Чужие сообщения не влияют. На пороге отправляется предупреждение без выполнения команды; следующая такая попытка в этом окне блокирует все команды зрителя. Чат Twitch не блокируется. Повторное нарушение усиливает блокировку до конца этого эфира. Перезапуск приложения не сбрасывает наказание.',
		globalCooldowns:'Применять общую перезарядку команд',globalGateHelp:'По умолчанию выключено: разные зрители не мешают друг другу. Если включить в «Защите», общая перезарядка каждой команды снова действует на всех. Значения сохранены. Личная перезарядка остаётся отдельной настройкой команды.',
		byNumber:'По числу: от меньшего к большему',listSelection:'Выбор текста',listRandom:'Полный случайный выбор',numberSource:'Числовая переменная',
		orderedHelp:'Расположи строки от плохого к хорошему. Диапазон выбранного числового шага делится поровну между строками: минимум выбирает первую, максимум последнюю. Сначала случайно выпадает число, затем подходящий текст. Например, 0–100 и 5 строк: 0–20, 21–40, 41–60, 61–80, 81–100. Для независимого выбора включи случайный режим.',
		invalidNumberSource:'Выбери существующий числовой шаг. Для списка он должен стоять выше.',spamWarning:'Предупреждение за повторы',spamPenalty:'Команды зрителя временно заблокированы',spamBlocked:'Команда отклонена: личная блокировка',secondsShort:'сек.',protectionSaved:'Настройки защиты сохранены',
		responseHelp:'«Все» отправляет до 3 строк. Случайный режим и выбор по числу отправляют одну из максимум 100 строк. В режиме по числу порядок строк соответствует возрастанию результата.',invalidResponses:'Добавь ответ: до 3 строк в режиме «Все», до 100 при выборе одной строки.'
	},
	uk: {
		cancelAction:'Скасувати',
		pendingChanges:'Є чернетка',
		sidebarColor:'Колір бічної смуги',clearSidebarColor:'Скинути колір смуги',dragCommand:'Перетягнути команду',moveCommandUp:'Підняти команду у списку',moveCommandDown:'Опустити команду у списку',invalidOrder:'Список команд змінився. Онови його й повтори переміщення.',invalidColor:'Обери колір смуги.',
		protection:'Захист',antiSpam:'Захист від повторів одного глядача',spamRepeats:'Повторів до попередження',spamWindowSeconds:'Вікно підрахунку, с',spamFirstBlockSeconds:'Перше блокування, с',spamRepeatBlockSeconds:'Повторне за ефір, с',
		spamHelp:'Рахуються однакові команди поспіль від одного глядача, включно з псевдонімами й спробами під час перезарядки. Чужі повідомлення не впливають. На порозі надсилається попередження без виконання; наступна така спроба в цьому вікні блокує всі команди глядача, але не чат Twitch. Повторне порушення посилює блокування до кінця ефіру. Перезапуск не скидає покарання.',
		globalCooldowns:'Застосовувати загальну перезарядку команд',globalGateHelp:'Типово вимкнено: різні глядачі не заважають один одному. Увімкни в «Захисті», щоб загальна перезарядка кожної команди діяла на всіх. Значення збережені. Особиста перезарядка налаштовується окремо для команди.',
		byNumber:'За числом: від меншого до більшого',listSelection:'Вибір тексту',listRandom:'Повний випадковий вибір',numberSource:'Числова змінна',
		orderedHelp:'Розташуй рядки від поганого до хорошого. Діапазон числового кроку ділиться порівну між рядками: мінімум обирає перший, максимум останній. Спершу випадає число, потім відповідний текст. Наприклад, 0–100 і 5 рядків: 0–20, 21–40, 41–60, 61–80, 81–100. Для незалежного вибору ввімкни випадковий режим.',
		invalidNumberSource:'Обери наявний числовий крок. Для списку він має бути вище.',spamWarning:'Попередження за повтори',spamPenalty:'Команди глядача тимчасово заблоковано',spamBlocked:'Команду відхилено: особисте блокування',secondsShort:'с',protectionSaved:'Налаштування захисту збережено',
		responseHelp:'«Усі» надсилає до 3 рядків. Випадковий режим та вибір за числом надсилають один із максимум 100 рядків. У режимі за числом порядок рядків відповідає зростанню результату.',invalidResponses:'Додай відповідь: до 3 рядків у режимі «Усі», до 100 для вибору одного.'
	},
	en: {
		cancelAction:'Cancel',
		pendingChanges:'Draft changes',
		sidebarColor:'Sidebar stripe color',clearSidebarColor:'Reset stripe color',dragCommand:'Drag command',moveCommandUp:'Move command up',moveCommandDown:'Move command down',invalidOrder:'The command list changed. Refresh and try moving again.',invalidColor:'Choose a stripe color.',
		protection:'Protection',antiSpam:'Per-viewer repeat protection',spamRepeats:'Repeats before warning',spamWindowSeconds:'Counting window, sec.',spamFirstBlockSeconds:'First block, sec.',spamRepeatBlockSeconds:'Repeat in this stream, sec.',
		spamHelp:'Counts consecutive uses of the same command by one viewer, including aliases and attempts during a personal cooldown. Other viewers do not affect the count. At the threshold, a warning replaces the reply; the next matching attempt within this window blocks all commands for that viewer, not Twitch chat. Repeated violations escalate for this stream. Restarting the app does not clear penalties.',
		globalCooldowns:'Apply shared command cooldowns',globalGateHelp:'Off by default: different viewers do not block each other. Enable in Protection to apply each command’s shared cooldown to everyone again. Saved values are preserved. Personal cooldowns remain separate per-command settings.',
		byNumber:'By number: low to high',listSelection:'Text selection',listRandom:'Fully random',numberSource:'Number variable',
		orderedHelp:'Order lines from bad to good. The number step’s range is divided evenly between lines: the minimum picks the first, the maximum the last. The number is random; the matching text follows it. Example: 0–100 with 5 lines gives 0–20, 21–40, 41–60, 61–80, 81–100. Choose random mode for independent selection.',
		invalidNumberSource:'Choose an existing number step. For a list, it must come before the list.',spamWarning:'Repeat warning',spamPenalty:'Viewer commands temporarily blocked',spamBlocked:'Command rejected: viewer blocked',secondsShort:'sec.',protectionSaved:'Protection settings saved',
		responseHelp:'All sends up to 3 lines. Random and number-based modes send one of up to 100 lines. Number-based mode follows the order from low to high.',invalidResponses:'Add up to 3 lines for All, or up to 100 when selecting one reply.'
	}
};
for (const language of ['ru','uk','en']) Object.assign(dictionaries[language], reliabilityCopy[language]);

// Variable names are user-defined data, not translation keys.
function numberSource(field, current, steps) {
	const numbers = steps.filter(step => step.type === 'number');
	return `<select data-field="${field}">${numbers.map(step => `<option value="${esc(step.variable)}" ${step.variable===current?'selected':''}>{${esc(step.variable)}} (${esc(step.min)}…${esc(step.max)})</option>`).join('')}</select>`;
}

// Numeric values keep native validation; saving does not alter command definitions.
function renderProtection() {
	const config = state.settings;
	$('#main').innerHTML = `
		<div class="page-scroll">
			<form id="protection-form" class="settings-page b-protection">
				<h2>${t('protection')}</h2>
				<label class="check"><input data-setting="antiSpam" type="checkbox" ${config.antiSpam?'checked':''}>${t('antiSpam')}${help('spamHelp')}</label>
				<div class="grid two">
					${[['spamRepeats',2,20],['spamWindowSeconds',5,3600],['spamFirstBlockSeconds',5,86400],['spamRepeatBlockSeconds',5,86400]].map(([key,min,max])=>label(key,`<input data-setting="${key}" type="number" value="${config[key]}" min="${min}" max="${max}" required>`)).join('\n')}
				</div>
				<label class="check"><input data-setting="globalCooldowns" type="checkbox" ${config.globalCooldowns?'checked':''}>${t('globalCooldowns')}${help('globalGateHelp')}</label>
				<button type="submit" class="primary b-action">${icon('save')}${t('save')}</button>
			</form>
		</div>`;
}
document.addEventListener('submit', event => {
	if (event.target.id !== 'protection-form') return;
	event.preventDefault();
	void guard(async () => {
		const changes = Object.fromEntries([...event.target.querySelectorAll('[data-setting]')].map(field=>[field.dataset.setting,field.type==='checkbox'?field.checked:Number(field.value)]));
		state.settings = await call('settings', {...state.settings,...changes});
		toast(t('protectionSaved'));
	});
});
document.addEventListener('change', event => {
	if (event.target.dataset.prop !== 'selectionMode') return;
	void guard(async () => {collect();await persistDraft();renderEditor();icons();});
});

let draggedCommandId = null, reorderingCommands = false;

// Reorder the complete list even while search hides some rows; never change a command ID.
async function moveCommand(id, targetId, after = false) {
	if (id === targetId || reorderingCommands) return;
	const ids = state.commands.map(command=>command.id);
	if (!ids.includes(id) || !ids.includes(targetId)) return;
	reorderingCommands = true;
	try {
		collect();
		ids.splice(ids.indexOf(id),1);
		ids.splice(ids.indexOf(targetId)+(after?1:0),0,id);
		state.commands = await call('reorder',ids);
		renderList();renderEditor();icons();
	} finally { reorderingCommands = false; }
}
function clearDropMarker() {
	document.querySelectorAll('.b-command-row--before,.b-command-row--after').forEach(row=>row.classList.remove('b-command-row--before','b-command-row--after'));
}
document.addEventListener('dragstart',event=>{
	const row=event.target.closest('.b-command-row');if(!row)return;
	draggedCommandId=row.dataset.select;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',draggedCommandId);
});
document.addEventListener('dragover',event=>{
	const row=event.target.closest('.b-command-row');if(!row||!draggedCommandId)return;
	event.preventDefault();event.dataTransfer.dropEffect='move';clearDropMarker();
	const rect=row.getBoundingClientRect();row.classList.add(event.clientY>rect.top+rect.height/2?'b-command-row--after':'b-command-row--before');
	const list=row.parentElement,box=list.getBoundingClientRect();
	if(event.clientY<box.top+30)list.scrollTop-=15;
	if(event.clientY>box.bottom-30)list.scrollTop+=15;
});
document.addEventListener('drop',event=>{
	const row=event.target.closest('.b-command-row');if(!row||!draggedCommandId)return;
	event.preventDefault();const id=draggedCommandId,after=row.classList.contains('b-command-row--after');
	draggedCommandId=null;clearDropMarker();void guard(()=>moveCommand(id,row.dataset.select,after));
});
document.addEventListener('dragend',()=>{draggedCommandId=null;clearDropMarker();});
document.addEventListener('click',event=>{
	const action=event.target.closest('button')?.dataset.action;
	if(action==='clearSidebarColor')void guard(async()=>{collect();draft.sidebarColor='';await persistDraft();renderEditor();icons();});
	if(action==='moveCommandUp'||action==='moveCommandDown'){
		const index=state.commands.findIndex(command=>command.id===selected),down=action==='moveCommandDown';
		const target=state.commands[index+(down?1:-1)];if(target)void guard(()=>moveCommand(selected,target.id,down));
	}
});
