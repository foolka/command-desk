const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../core/store.cjs'),{sample}=require('../core/model.cjs');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'command-desk-controls-'));
const out=path.join(root,'test-output');fs.mkdirSync(out,{recursive:true});
const store=new Store(profile);
const first=store.save({...sample(),sidebarColor:'#e14585'}),second=store.save(sample('choice'));
store.close();
let app,page;const errors=[];

// Only synthetic, signed-out profiles are ever opened by this regression test.
async function launch(){
	const packaged=process.env.COMMAND_DESK_PACKAGE;
	app=await electron.launch({...(packaged?{executablePath:path.join(packaged,'CommandDesk.exe')}:{}),args:[...(packaged?[]:[root]),'--test-mode'],env:{...process.env,COMMAND_DESK_TEST_DATA:profile}});
	page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
	await page.locator('[data-field=responses]').waitFor();
	await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.show();win.focus();});
	await page.setViewportSize({width:1400,height:850});
}
async function select(id){
	await page.locator(`[data-select="${id}"] strong`).click();
	await page.waitForFunction(id=>selected===id&&!selectingCommand,id);
}
async function state(){return (await page.evaluate(()=>window.desk.state())).value;}
async function draftValue(id,field,value){await page.waitForFunction(async({id,field,value})=>(await window.desk.state()).value.drafts[id]?.[field]===value,{id,field,value});}

// Compare actual rasterized caret frames against the identical field with only its caret hidden.
async function caret(selector,name){
	const field=page.locator(selector);
	await field.click();await page.keyboard.press('End');await page.keyboard.type(' caret');
	assert.equal(await field.evaluate(el=>document.activeElement===el&&document.hasFocus()),true);
	assert.equal(await field.evaluate(el=>getComputedStyle(el).caretColor===getComputedStyle(el).color),true);
	await field.evaluate(el=>el.style.caretColor='transparent');
	const baseline=await field.screenshot({caret:'initial'});
	await field.evaluate(el=>el.style.removeProperty('caret-color'));
	let changed=0;
	for(let attempt=0;attempt<8&&!changed;attempt++){
		const current=await field.screenshot({caret:'initial'});
		changed=await app.evaluate(({nativeImage},{a,b})=>{
			const before=nativeImage.createFromBuffer(Buffer.from(a)).getBitmap(),after=nativeImage.createFromBuffer(Buffer.from(b)).getBitmap();
			let pixels=0;for(let i=0;i<before.length;i+=4)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])pixels++;
			return pixels;
		},{a:[...baseline],b:[...current]});
		if(changed)fs.writeFileSync(path.join(out,name+'-caret.png'),current);
		else await page.waitForTimeout(150);
	}
	assert.ok(changed>=8&&changed<150,`Expected a visible caret, got ${changed} changed pixels`);
}

(async()=>{try{
	await launch();
	for(const theme of ['light','dark']){
		if(await page.evaluate(()=>document.documentElement.dataset.theme)!==theme)await page.locator('#theme').click();
		for(const language of ['ru','uk','en']){
			await page.locator('#language').selectOption(language);
			await page.waitForFunction(language=>document.documentElement.lang===language,language);
			for(const width of [960,1400,1920]){
				await page.setViewportSize({width,height:900});await select(second.id);
				const custom=page.locator(`[data-select="${first.id}"]`);
				assert.equal(await custom.evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(225, 69, 133)');
				await custom.hover();assert.equal(await custom.evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(225, 69, 133)');
				await select(first.id);
				assert.equal(await page.locator(`[data-select="${second.id}"]`).evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb('+ (theme==='dark'?'128, 216, 191':'17, 126, 112')+')');
				await page.locator('[data-action=deliveryMode][data-mode=announcement]').click();
				await draftValue(first.id,'delivery','announcement');
				assert.equal(await page.locator('[data-field=color]').isEnabled(),true);
				await page.locator('[data-action=deliveryMode][data-mode=message]').click();
				await draftValue(first.id,'delivery','message');
				assert.equal(await page.locator('[data-field=color]').isDisabled(),true);
				assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
			}
		}
		await page.setViewportSize({width:1400,height:850});
		await caret('[data-field=responses]',theme+'-responses');
		await page.screenshot({path:path.join(out,`delivery-${theme}.png`),caret:'initial'});
		await select(second.id);await caret('[data-prop=choices]',theme+'-choices');
		await page.screenshot({path:path.join(out,`controls-${theme}.png`),caret:'initial'});
	}
	await page.locator('[data-sidebar-color]').fill('#33bbcc');await draftValue(second.id,'sidebarColor','#33bbcc');
	await select(first.id);assert.equal(await page.locator(`[data-select="${second.id}"]`).evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(51, 187, 204)');
	await select(second.id);await page.locator('[data-action=clearSidebarColor]').click();await draftValue(second.id,'sidebarColor','');
	assert.equal((await state()).commands.find(c=>c.id===second.id).sidebarColor,'');

	// Remaining native selectors still work through a real click and keyboard choice.
	await page.locator('[data-action=deliveryMode][data-mode=announcement]').click();
	await page.locator('[data-field=color]').click();await page.keyboard.press('End');await page.keyboard.press('Enter');
	assert.equal(await page.locator('[data-field=color]').inputValue(),'purple');
	await draftValue(second.id,'color','purple');
	await page.locator('[data-action=discard]').click();
	await page.screenshot({path:path.join(out,'controls-confirmation.png')});
	await page.locator('.b-confirm-dialog [value=cancel]').click();
	await page.locator('.b-confirm-dialog').waitFor({state:'detached'});
	await caret('[data-field=responses]','after-cancel');
	await page.locator('[data-action=discard]').click();await page.keyboard.press('Escape');
	await page.locator('.b-confirm-dialog').waitFor({state:'detached'});
	await page.locator('[data-action=discard]').click();await page.locator('.b-confirm-dialog [value=confirm]').click();
	await page.waitForFunction(()=>!dirty);
	await caret('[data-field=responses]','after-discard');

	// Restore from tray, then from minimization, with keyboard focus on the web editor.
	await page.locator('#tray').click();
	await app.evaluate(({app})=>app.emit('second-instance'));
	await caret('[data-field=responses]','after-tray');
	await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.minimize();});
	await app.evaluate(({app})=>app.emit('second-instance'));
	await caret('[data-field=responses]','after-restore');
	await page.locator('[data-action=deliveryMode][data-mode=announcement]').click();
	await draftValue(second.id,'delivery','announcement');
	await page.locator('#command-form button[type=submit]').click();await page.waitForFunction(()=>!dirty);
	await app.close();app=null;await launch();
	assert.equal(await page.locator('[data-action=deliveryMode][data-mode=announcement]').getAttribute('aria-pressed'),'true');
	assert.equal(await page.locator('[data-field=color]').isEnabled(),true);
	const final=await state();assert.equal(final.auth.user,null);assert.equal(final.connection,'offline');assert.deepEqual(final.history,[]);assert.deepEqual(errors,[]);
	console.log('Controls verified: delivery clicks, native selector, visible caret pixels, confirmations, tray/restore, stripes/default/hover/drafts, restart, 3 languages, 2 themes, 3 widths; no chat sends.');
}finally{
	if(app)await app.close();
	assert.ok(profile.startsWith(path.join(os.tmpdir(),'command-desk-controls-')));fs.rmSync(profile,{recursive:true,force:true});
}})().catch(error=>{console.error(error);process.exitCode=1;});
