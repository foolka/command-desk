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
  const id=JSON.parse(fs.readFileSync(path.join(profile,'profile-identity.json'),'utf8')).id;
  await app.close();app=null;page=await launch();
  s=await page.evaluate(()=>window.desk.state());assert.equal(s.value.commands.length,1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'profile-identity.json'),'utf8')).id,id);
  assert.equal(s.value.connection,'offline');assert.equal(s.value.auth.user,null);
  console.log('Packaged EXE verified: isolated profile, no packaged personal data, command and identity survive restart.');
 }finally{if(app)await app.close();assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'command-desk-package-'));fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
