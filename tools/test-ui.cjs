const { _electron:electron }=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'command-desk-ui-'));
const out=path.join(root,'test-output');fs.mkdirSync(out,{recursive:true});
let app,page;const errors=[];
async function launch(){
  app=await electron.launch({args:[root,'--test-mode'],env:{...process.env,COMMAND_DESK_TEST_DATA:profile}});
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.locator('#command-list').waitFor();await page.setViewportSize({width:1400,height:850});
}
async function act(action){await page.locator(`[data-action="${action}"]`).first().click();}
async function save(){await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Сохранено');}
(async()=>{
 try{
  await launch();await act('create');await page.locator('[data-field=trigger]').waitFor();
  await page.locator('[data-prop=pool]').selectOption('messages');
  await act('addStep');
  await page.locator('[data-step="1"] [data-prop=type]').selectOption('number');
  await page.locator('[data-step="1"] [data-prop=variable]').fill('amount');
  await page.locator('[data-step="1"] [data-prop=min]').fill('7');
  await page.locator('[data-step="1"] [data-prop=max]').fill('7');
  await page.locator('[data-field=responses]').fill('{user} кусает {target} {amount} раз!');
  await save();
  await page.locator('#test-message').fill('!кусь @ViewerTwo');await act('test');
  await page.waitForFunction(()=>document.querySelector('#test-result')?.textContent.includes('ViewerOne кусает ViewerTwo 7 раз!'));
  assert.equal(await page.locator('[data-prop=pool]').inputValue(),'messages');
  await page.screenshot({path:path.join(root,'docs/screenshots/editor-light.png')});
  await page.locator('#theme').click();await page.screenshot({path:path.join(root,'docs/screenshots/editor-dark.png')});
  for(const lang of ['uk','en','ru']){
    await page.locator('#language').selectOption(lang);
    await page.waitForFunction(l=>document.documentElement.lang===l,lang);
    assert.equal(await page.locator('[data-field=responses]').inputValue(),'{user} кусает {target} {amount} раз!');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.locator('#new-kind').selectOption('choiceExample');await act('create');
  await page.locator('[data-prop=choices]').fill('мастер побед\nлегенда чата\nлюбитель приключений');
  await save();await act('test');
  await page.screenshot({path:path.join(root,'docs/screenshots/random-reply.png')});
  await page.locator('[data-field=name]').fill('Черновик после перезапуска');
  await page.locator('[data-field=trigger]').fill('!');
  await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Черновик сохранён');
  await app.close();app=null;await launch();
  assert.equal(await page.locator('[data-field=name]').inputValue(),'Черновик после перезапуска');
  assert.equal(await page.locator('[data-field=trigger]').inputValue(),'!');
  assert.equal(await page.locator('.command-row').count(),2);
  await page.locator('[data-field=trigger]').fill('!кто');await save();
  await page.locator('[data-view=connection]').click();
  await page.screenshot({path:path.join(root,'docs/screenshots/connection.png')});
  await page.locator('[data-view=commands]').click();
  await page.setViewportSize({width:960,height:720});
  const headerY=await page.locator('header').evaluate(e=>e.getBoundingClientRect().y);
  await page.locator('.workspace').evaluate(e=>e.scrollTop=1000);
  assert.equal(await page.locator('header').evaluate(e=>e.getBoundingClientRect().y),headerY);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'compact.png')});
  assert.deepEqual(errors,[]);console.log('UI verified: workflows, 3 languages, 2 themes, draft recovery, fixed header, compact layout.');
 }finally{
  if(app)await app.close();
  assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'command-desk-ui-'));
  fs.rmSync(profile,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
