const {_electron:electron}=require('playwright');
const {listPackage}=require('@electron/asar');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),folder=process.env.COMMAND_DESK_PACKAGE||path.join(root,'release/CommandDesk-win32-x64');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'command-desk-package-'));
let app;
async function launch(){app=await electron.launch({executablePath:path.join(folder,'CommandDesk.exe'),args:['--test-mode'],env:{...process.env,COMMAND_DESK_TEST_DATA:profile}});const page=await app.firstWindow();await page.locator('#command-list').waitFor();return page;}
(async()=>{
 try{
  const files=listPackage(path.join(folder,'resources/app.asar'));
  assert.ok(!files.some(f=>/commands\.sqlite|auth\.bin|profile-identity|test-output|\\\.git\\/.test(f)));
  let page=await launch();
  let s=await page.evaluate(()=>window.desk.state());assert.equal(s.value.test,true);assert.equal(s.value.commands.length,0);
  await page.evaluate(()=>window.desk.create('target'));
  await page.locator('[data-view=protection]').click();
  const quiet=page.locator('[data-setting=quietMode]'),limit=page.locator('[data-setting=quietPerMinute]');
  assert.equal(await quiet.isChecked(),false);assert.equal(await limit.inputValue(),'5');
  await quiet.check();await limit.fill('3');await page.locator('#protection-form button[type=submit]').click();
  await page.waitForFunction(async()=>{const s=(await window.desk.state()).value.settings;return s.quietMode&&s.quietPerMinute===3;});
  const id=JSON.parse(fs.readFileSync(path.join(profile,'profile-identity.json'),'utf8')).id;
  await app.close();app=null;page=await launch();
  s=await page.evaluate(()=>window.desk.state());assert.equal(s.value.commands.length,1);
  assert.equal(s.value.settings.quietMode,true);assert.equal(s.value.settings.quietPerMinute,3);
  const preview=await page.evaluate(command=>window.desk.preview({command,user:'ViewerOne',message:command.trigger+' @ViewerTwo',names:['ViewerTwo']}),s.value.commands[0]);
  assert.equal(preview.ok,true);assert.ok(preview.value.messages[0].includes('@ViewerOne'));assert.ok(preview.value.messages[0].includes('@ViewerTwo'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'profile-identity.json'),'utf8')).id,id);
  assert.equal(s.value.connection,'offline');assert.equal(s.value.auth.user,null);
  console.log('Packaged EXE verified: isolated profile, no packaged personal data, command and identity survive restart, preview mentions both participants.');
 }finally{if(app)await app.close();assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'command-desk-package-'));fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
