// Keep confirmations inside the editor instead of opening a blocking native dialog.
function confirmAction(messageKey, actionKey) {
	if (document.querySelector('.b-confirm-dialog')) return Promise.resolve(false);
	const previous = document.activeElement;
	const dialog = document.createElement('dialog');
	dialog.className = 'b-confirm-dialog';
	dialog.setAttribute('aria-labelledby', 'confirm-message');
	dialog.innerHTML = `
		<div id="confirm-message" class="b-confirm-dialog__message">${esc(t(messageKey))}</div>
		<form method="dialog" class="b-confirm-dialog__actions">
			<button class="b-action" value="cancel" autofocus>${t('cancelAction')}</button>
			<button class="b-action primary" value="confirm">${t(actionKey)}</button>
		</form>`;
	return new Promise(resolve => {
		dialog.addEventListener('close', () => {
			const accepted = dialog.returnValue === 'confirm';
			dialog.remove();
			if (previous?.isConnected) previous.focus({preventScroll:true});
			resolve(accepted);
		}, {once:true});
		document.body.append(dialog);
		dialog.showModal();
	});
}

// Preview a draft's stripe without applying command changes or replacing focused fields.
function updateCommandColor(row, command) {
	const color = state.drafts?.[command.id]?.sidebarColor ?? command.sidebarColor;
	if (color) row.style.setProperty('--command-color', color);
	else row.style.removeProperty('--command-color');
}

// The two delivery modes stay directly clickable without a native popup.
function renderDelivery() {
	const delivery = draft.delivery === 'announcement' ? 'announcement' : 'message';
	return `
		<div class="b-delivery">
			<div id="delivery-label" class="b-delivery__label">${t('delivery')}</div>
			<input data-field="delivery" type="hidden" value="${delivery}">
			<div class="b-delivery__options" role="group" aria-labelledby="delivery-label">
				${['message','announcement'].map(mode => `<button type="button" class="b-delivery__button" data-action="deliveryMode" data-mode="${mode}" aria-pressed="${delivery===mode}">${icon(mode==='message'?'message-square':'megaphone')}${t(mode)}</button>`).join('\n')}
			</div>
		</div>`;
}

document.addEventListener('click', event => {
	const button = event.target.closest('[data-action="deliveryMode"]');
	if (!button) return;
	void guard(async () => {
		collect();
		draft.delivery = button.dataset.mode;
		document.querySelector('[data-field="delivery"]').value = draft.delivery;
		for (const option of document.querySelectorAll('[data-action="deliveryMode"]')) option.setAttribute('aria-pressed', option === button);
		document.querySelector('[data-field="color"]').disabled = draft.delivery !== 'announcement';
		updateStatus();
		await persistDraft();
	});
});
