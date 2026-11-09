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
  await launch();await act('create');await page.locator('[data-action=createTemplate][data-kind=target]').click();await page.locator('[data-field=trigger]').waitFor();
  assert.equal(await page.locator('[data-action=toggleCommand]').getAttribute('aria-checked'),'false');
  assert.equal(await page.locator('.command-state').textContent(),'Выключена');
  assert.match(await page.locator('#activity').textContent(),/0 \/ 1/);
  await act('toggleCommand');
  await page.waitForFunction(()=>document.querySelector('[data-action=toggleCommand]')?.getAttribute('aria-checked')==='true');
  assert.equal(await page.locator('.command-state').textContent(),'Включена');
  assert.match(await page.locator('#activity').textContent(),/1 \/ 1/);
  await act('pause');assert.equal(await page.locator('#activity').textContent(),'Команды на паузе');
  await act('pause');assert.match(await page.locator('#activity').textContent(),/1 \/ 1/);
  assert.equal(await page.locator('[data-prop=pool]').count(),0);
  assert.equal(await page.locator('input[readonly]').inputValue(),'Подключённые к чату Twitch');
  await page.locator('[data-action=addStep][data-kind=number]').click();
  await page.locator('[data-step="1"] [data-prop=variable]').fill('amount');
  await page.locator('[data-step="1"] [data-prop=min]').fill('7');
  await page.locator('[data-step="1"] [data-prop=max]').fill('7');
  await page.locator('[data-field=responses]').fill('{user} кусает {target} {amount} раз!');
  await save();
  await page.locator('#test-message').fill('!кусь @ViewerTwo');await act('test');
  await page.waitForFunction(()=>document.querySelector('#test-result')?.textContent.includes('ViewerOne кусает ViewerTwo 7 раз!'));
  assert.equal(await page.locator('[data-prop=pool]').count(),0);
  await page.screenshot({path:path.join(root,'docs/screenshots/editor-light.png')});
  await page.locator('#theme').click();await page.screenshot({path:path.join(root,'docs/screenshots/editor-dark.png')});
  for(const lang of ['uk','en','ru']){
    await page.locator('#language').selectOption(lang);
    await page.waitForFunction(l=>document.documentElement.lang===l,lang);
    assert.equal(await page.locator('[data-field=responses]').inputValue(),'{user} кусает {target} {amount} раз!');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await act('create');await page.locator('[data-action=createTemplate][data-kind=choice]').click();
  await page.locator('[data-prop=choices]').fill('мастер побед\nлегенда чата\nлюбитель приключений');
  await save();await act('test');
  await page.screenshot({path:path.join(root,'docs/screenshots/random-reply.png')});
  await page.locator('[data-field=name]').fill('Черновик после перезапуска');
  await page.locator('[data-field=trigger]').fill('!');
  await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Черновик сохранён');
  await app.close();app=null;await launch();
  const persisted=await page.evaluate(()=>window.desk.state());
  assert.equal(persisted.value.commands.find(c=>c.trigger==='!кусь').enabled,true);
  assert.equal(persisted.value.commands.find(c=>c.trigger==='!кто').enabled,false);
  assert.match(await page.locator('#activity').textContent(),/1 \/ 2/);
  assert.equal(await page.locator('[data-field=name]').inputValue(),'Черновик после перезапуска');
  assert.equal(await page.locator('[data-field=trigger]').inputValue(),'!');
  assert.equal(await page.locator('.command-row').count(),2);
  await page.locator('[data-field=trigger]').fill('!кто');await save();
  await page.locator('#nav [data-view=connection]').click();
  await page.screenshot({path:path.join(root,'docs/screenshots/connection.png')});
  await page.locator('[data-view=audience]').click();
  assert.equal(await page.locator('th').nth(1).textContent(),'Присутствие');
  assert.ok((await page.locator('#main').textContent()).includes('Получаем список участников'));
  await page.locator('[data-view=commands]').click();
  await page.setViewportSize({width:960,height:720});
  const headerY=await page.locator('header').evaluate(e=>e.getBoundingClientRect().y);
  await page.locator('.workspace').evaluate(e=>e.scrollTop=1000);
  assert.equal(await page.locator('header').evaluate(e=>e.getBoundingClientRect().y),headerY);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'compact.png')});
  assert.equal(await page.locator('#audience-notice').isVisible(),false);
  await page.evaluate(()=>{state.auth={...state.auth,user:{login:'TestChannel'},chattersAllowed:false};updateStatus();});
  assert.equal(await page.locator('#audience-notice').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'online-permission.png')});
  await page.locator('#audience-notice button').click();
  await page.locator('#auth-controls').waitFor();
  await page.locator('[data-view=commands]').click();
  await act('examples');await act('addExamples');
  await page.waitForFunction(()=>document.querySelectorAll('.command-row').length===12);
  await act('examples');await act('addExamples');
  assert.equal(await page.locator('.command-row').count(),12);
  const seeded=await page.evaluate(()=>window.desk.state());
  assert.equal(seeded.value.commands.filter(c=>c.enabled).length,1);
  const tooltip=page.locator('[data-step="0"] [data-help]').first();
  await tooltip.hover();await page.locator('#builder-tooltip').waitFor();
  assert.equal(await page.locator('#builder-tooltip').evaluate(el=>{
    const r=el.getBoundingClientRect();return el.parentElement===document.body&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;
  }),true);
  await page.screenshot({path:path.join(out,'tooltip-compact.png')});
  await page.mouse.move(2,2);
  await page.locator('[data-view=autoAnnouncements]').click();
  await act('newTimer');
  const form=page.locator('[data-timer]').last();
  await form.locator('[data-field=name]').fill('Затишок');
  await form.locator('[data-field=text]').fill('Будьте добры друг к другу.');
  await form.locator('[data-field=minMessages]').fill('0');
  await form.locator('[data-field=intervalMinutes]').fill('12');
  await form.locator('button[type=submit]').click();
  await page.waitForFunction(()=>!!document.querySelector('[data-timer]')?.dataset.timer);
  await form.locator('[data-action=toggleTimer]').click();
  await page.waitForFunction(()=>document.querySelector('[data-action=toggleTimer]')?.getAttribute('aria-checked')==='true');
  for(const lang of ['uk','en','ru']){
    await page.locator('#language').selectOption(lang);await page.waitForFunction(l=>document.documentElement.lang===l,lang);
    assert.equal(await page.locator('[data-timer] [data-field=text]').inputValue(),'Будьте добры друг к другу.');
    assert.equal(await page.locator('[data-timer] [data-field=minMessages]').inputValue(),'0');
  }
  await page.setViewportSize({width:1400,height:850});
  await page.screenshot({path:path.join(root,'docs/screenshots/announcements.png')});
  const final=await page.evaluate(()=>window.desk.state());
  assert.equal(final.value.announcements[0].enabled,true);assert.equal(final.value.announcements[0].minMessages,0);
  assert.equal(final.value.announcementSettings.intervalMinutes,10);assert.equal(final.value.announcementSettings.onlyLive,true);
  assert.equal(final.value.connection,'offline');assert.equal(final.value.history.length,0);
  await page.locator('[data-timer] [data-field=text]').fill('');
  await page.locator('[data-timer] [data-action=toggleTimer]').click();
  await page.waitForFunction(()=>document.querySelector('[data-action=toggleTimer]')?.getAttribute('aria-checked')==='false');
  const incomplete=await page.evaluate(()=>window.desk.state());
  assert.equal(incomplete.value.announcements[0].text,'Будьте добры друг к другу.');
  assert.equal(incomplete.value.announcements[0].enabled,false);
  assert.equal(incomplete.value.timerDraft.timers[0].text,'');
  await app.close();app=null;await launch();await page.locator('[data-view=autoAnnouncements]').click();
  assert.equal(await page.locator('[data-timer] [data-field=text]').inputValue(),'');
  await page.locator('[data-timer] [data-field=text]').fill('Будьте добры друг к другу.');
  await page.locator('[data-timer] button[type=submit]').click();
  await page.waitForFunction(async()=>!(await window.desk.state()).value.timerDraft);
  await page.locator('[data-view=protection]').click();
  assert.equal(await page.locator('[data-setting=antiSpam]').isChecked(),true);
  assert.equal(await page.locator('[data-setting=globalCooldowns]').isChecked(),false);
  for(const [key,value]of Object.entries({spamRepeats:'4',spamWindowSeconds:'45',spamFirstBlockSeconds:'120',spamRepeatBlockSeconds:'900'}))await page.locator(`[data-setting=${key}]`).fill(value);
  await page.locator('#protection-form button[type=submit]').click();
  await page.waitForFunction(async()=>(await window.desk.state()).value.settings.spamRepeatBlockSeconds===900);
  for(const language of ['ru','en','uk']){
    await page.locator('#language').selectOption(language);
    for(const width of [1400,960]){
      await page.setViewportSize({width,height:850});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(out,`protection-${language}-${width}.png`)});
    }
  }
  await page.locator('#language').selectOption('ru');
  await page.locator('[data-view=commands]').click();await act('create');
  await page.locator('[data-action=createTemplate][data-kind=combined]').click();
  assert.equal(await page.locator('[data-prop=selectionMode]').inputValue(),'number');
  assert.equal(await page.locator('[data-prop=numberVariable]').inputValue(),'amount');
  await page.locator('[data-prop=selectionMode]').selectOption('random');
  assert.equal(await page.locator('[data-prop=numberVariable]').count(),0);
  await save();
  await page.locator('[data-prop=selectionMode]').selectOption('number');
  await page.locator('[data-prop=choices]').fill('Низкий результат\nСредний результат\nВысокий результат');
  await page.locator('[data-action=replyMode][data-mode=number]').click();
  await page.locator('[data-field=responses]').fill('{user} {amount}: мало\n{user} {amount}: много');
  await save();await page.locator('#test-message').fill('!химия @ViewerTwo');await act('test');
  const result=await page.evaluate(()=>testResult);
  const amount=Number(result.trace.find(step=>step.variable==='amount').value);
  const choice=result.trace.find(step=>step.variable==='choice').value;
  assert.equal(choice,amount<=33?'Низкий результат':amount<=67?'Средний результат':'Высокий результат');
  assert.equal(result.messages[0],`ViewerOne ${amount}: ${amount<=50?'мало':'много'}`);
  await page.setViewportSize({width:1400,height:850});
  await page.screenshot({path:path.join(out,'ordered-replies.png')});
  const changed=await page.evaluate(()=>window.desk.state());const last=changed.value.commands.at(-1);
  assert.equal(last.responseMode,'number');assert.equal(last.steps[2].selectionMode,'number');
  assert.equal(changed.value.settings.spamWindowSeconds,45);
  await page.locator('[data-sidebar-color]').fill('#ff3355');await save();
  assert.equal(await page.locator('.command-row.selected').evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(255, 51, 85)');
  const rowIds=await page.locator('.command-row').evaluateAll(rows=>rows.map(row=>row.dataset.select));
  const lastId=rowIds.at(-1),firstId=rowIds[0];
  // Keep both drag endpoints visible so Playwright does not scroll the source away before pressing.
  await page.setViewportSize({width:1400,height:2200});
  await page.locator('.command-row').last().dragTo(page.locator('.command-row').first(),{targetPosition:{x:30,y:2}});
  await page.waitForFunction(id=>document.querySelector('.command-row')?.dataset.select===id,lastId);
  assert.equal(await page.locator('.command-row').first().evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(255, 51, 85)');
  await act('moveCommandDown');await page.waitForFunction(id=>document.querySelector('.command-row')?.dataset.select===id,firstId);
  const sorted=await page.evaluate(()=>window.desk.state());assert.equal(sorted.value.commands[1].id,lastId);
  await page.setViewportSize({width:1400,height:850});
  for(const theme of ['light','dark']){
    if(await page.evaluate(()=>document.documentElement.dataset.theme)!==theme)await page.locator('#theme').click();
    await page.screenshot({path:path.join(out,`sidebar-color-${theme}.png`)});
  }
  await app.close();app=null;await launch();await page.locator('[data-view=protection]').click();
  assert.equal(await page.locator('[data-setting=spamWindowSeconds]').inputValue(),'45');
  const restarted=await page.evaluate(()=>window.desk.state());assert.equal(restarted.value.commands[1].id,lastId);assert.equal(restarted.value.commands[1].sidebarColor,'#ff3355');
  assert.deepEqual(errors,[]);console.log('UI verified: workflows, protection options, ordered responses, 3 languages, 2 themes, persistence and compact layout.');
 }finally{
  if(app)await app.close();
  assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'command-desk-ui-'));
  fs.rmSync(profile,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
