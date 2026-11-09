const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../core/store.cjs'),{sample}=require('../core/model.cjs');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'command-desk-selection-'));
const out=path.join(root,'test-output');fs.mkdirSync(out,{recursive:true});
let app,page;const errors=[];
const store=new Store(profile),a=store.save({...sample(),enabled:true}),b=store.save(sample('choice'));
const legacy={...a,trigger:'!',name:'Legacy unfinished draft',sidebarColor:'#ff3355'};
store.setMeta('draft',legacy);const identity=store.meta('id');store.close();

// Launch only an offline test profile, optionally using the packaged executable.
async function launch(){
	const packaged=process.env.COMMAND_DESK_PACKAGE;
	app=await electron.launch({...(packaged?{executablePath:path.join(packaged,'CommandDesk.exe')}:{ }),args:[...(packaged?[]:[root]),'--test-mode'],env:{...process.env,COMMAND_DESK_TEST_DATA:profile}});
	page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
	await page.locator('#command-list').waitFor();await page.setViewportSize({width:1400,height:850});
}
// Exercise actual sidebar clicks, including text inside the button.
async function select(id){
	await page.locator(`[data-select="${id}"] strong`).click();
	await page.waitForFunction(id=>selected===id&&!selectingCommand,id);
}
async function state(){const result=await page.evaluate(()=>window.desk.state());assert.equal(result.ok,true);return result.value;}
async function savedDraft(id,field,value){await page.waitForFunction(async({id,field,value})=>(await window.desk.state()).value.drafts[id]?.[field]===value,{id,field,value});}
async function save(){await page.locator('#command-form button[type=submit]').click();await page.waitForFunction(()=>!dirty);}

(async()=>{
	try{
		await launch();assert.equal(await page.locator('[data-field=trigger]').inputValue(),'!');
		await select(b.id);assert.equal(await page.locator('[data-field=trigger]').inputValue(),b.trigger);
		let s=await state();assert.deepEqual(s.commands,[a,b]);assert.equal(s.drafts[a.id].trigger,'!');
		await page.locator('[data-field=name]').fill('Second unfinished draft');
		await page.locator('[data-sidebar-color]').fill('#11cc44');
		await savedDraft(b.id,'sidebarColor','#11cc44');
		await select(a.id);assert.equal(await page.locator('[data-field=name]').inputValue(),legacy.name);
		assert.equal(await page.locator('[data-field=trigger]').inputValue(),'!');
		await page.locator('[data-field=responses]').fill('Still a draft, not sent');
		await select(b.id);assert.equal(await page.locator('[data-field=name]').inputValue(),'Second unfinished draft');
		assert.equal(await page.locator('[data-sidebar-color]').inputValue(),'#11cc44');
		s=await state();assert.deepEqual(s.commands,[a,b]);assert.equal(Object.keys(s.drafts).length,2);
		await app.close();app=null;await launch();
		assert.equal(await page.locator('[data-field=name]').inputValue(),'Second unfinished draft');
		await select(a.id);assert.equal(await page.locator('[data-field=responses]').inputValue(),'Still a draft, not sent');
		await page.locator('#command-form button[type=submit]').click();
		await page.locator('#toast').waitFor();assert.equal((await state()).drafts[a.id].trigger,'!');
		await select(b.id);await save();
		s=await state();assert.equal(s.drafts[b.id],undefined);assert.equal(s.drafts[a.id].trigger,'!');
		assert.equal(s.commands.find(c=>c.id===b.id).name,'Second unfinished draft');
		assert.equal(s.commands.find(c=>c.id===b.id).sidebarColor,'#11cc44');
		await app.close();app=null;await launch();
		assert.equal(await page.evaluate(()=>selected),b.id);assert.equal(await page.evaluate(()=>dirty),false);
		await select(a.id);assert.equal(await page.locator('[data-field=trigger]').inputValue(),'!');
		await page.locator('[data-action=discard]').click();await page.locator('.b-confirm-dialog [value=confirm]').click();
		await page.waitForFunction(()=>!dirty);assert.equal(await page.locator('[data-field=trigger]').inputValue(),a.trigger);
		assert.equal(Object.keys((await state()).drafts).length,0);
		await page.locator('[data-field=name]').fill('Keep while adding another command');
		await page.locator('[data-action=create]').click();await page.locator('[data-action=createTemplate][data-kind=dice]').click();
		await page.waitForFunction(id=>selected!==id&&!selectingCommand,a.id);const created=await page.evaluate(()=>selected);
		assert.equal((await state()).drafts[a.id].name,'Keep while adding another command');
		await page.locator('[data-field=name]').fill('Delete just this draft');
		await page.locator('[data-action=delete]').click();await page.locator('.b-confirm-dialog [value=confirm]').click();
		await page.waitForFunction(id=>!state.commands.some(c=>c.id===id),created);
		s=await state();assert.equal(s.drafts[created],undefined);assert.equal(s.drafts[a.id].name,'Keep while adding another command');
		for(const lang of ['ru','uk','en']){
			await page.locator('#language').selectOption(lang);
			for(const width of [960,1400]){
				await page.setViewportSize({width,height:850});
				await select(b.id);await select(a.id);
				assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
			}
		}
		for(const theme of ['light','dark']){
			if(await page.evaluate(()=>document.documentElement.dataset.theme)!==theme)await page.locator('#theme').click();
			await page.screenshot({path:path.join(out,`selection-${theme}.png`)});
		}
		s=await state();assert.equal(s.connection,'offline');assert.equal(s.auth.user,null);assert.deepEqual(s.history,[]);
		assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'profile-identity.json'),'utf8')).id,identity);
		assert.deepEqual(errors,[]);
		console.log('Selection verified: restored legacy draft, independent edits/colors, restart, save/discard/delete/create, 3 languages, 2 themes, no chat sends.');
	}finally{
		if(app)await app.close();
		assert.ok(profile.startsWith(path.join(os.tmpdir(),'command-desk-selection-')));fs.rmSync(profile,{recursive:true,force:true});
	}
})().catch(error=>{console.error(error);process.exitCode=1;});
