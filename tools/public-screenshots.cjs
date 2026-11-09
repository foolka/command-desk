const { _electron:electron }=require('playwright');
const {Store}=require('../core/store.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
// Local demo profiles contain only shipped examples; Twitch stays disconnected.
(async()=>{
	for(const language of ['ru','uk','en']){
		const profile=fs.mkdtempSync(path.join(os.tmpdir(),'command-public-demo-'));
		const store=new Store(profile,Date.now,{starter:true,language});
		store.saveSettings({...store.settings(),language,theme:'dark'});store.close();
		let app;
		try{
			app=await electron.launch({args:[root,'--test-mode'],env:{...process.env,COMMAND_DESK_TEST_DATA:profile}});
			const page=await app.firstWindow();await page.setViewportSize({width:1400,height:900});
			await page.locator('.command-row').first().waitFor();
			const state=(await page.evaluate(()=>window.desk.state())).value;
			assert.equal(state.commands.length,10);assert.ok(state.commands.every(c=>!c.enabled));assert.equal(state.auth.user,null);
			const folder=path.join(root,'docs/screenshots',language);fs.mkdirSync(folder,{recursive:true});
			await page.locator('.command-row').first().click();
			await page.screenshot({path:path.join(folder,'builder.png')});
			await page.locator('.editor-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
			await page.waitForFunction(()=>document.querySelector('.editor-scroll').scrollTop>0);
			await page.screenshot({path:path.join(folder,'replies.png')});
			assert.notDeepEqual(fs.readFileSync(path.join(folder,'builder.png')),fs.readFileSync(path.join(folder,'replies.png')));
			await page.locator('[data-view=autoAnnouncements]').click();
			assert.equal(await page.locator('[data-action=toggleTimer]').getAttribute('aria-checked'),'false');
			await page.screenshot({path:path.join(folder,'announcements.png')});
			await page.locator('#nav [data-view=connection]').click();await page.screenshot({path:path.join(folder,'connection.png')});
			await page.locator('[data-view=protection]').click();await page.screenshot({path:path.join(folder,'protection.png')});
		}finally{await app?.close();fs.rmSync(profile,{recursive:true,force:true});}
	}
	console.log('Public screenshots: 15 localized images; ten disabled defaults and one disabled timer verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
