const {app,BrowserWindow,ipcMain,dialog,shell,safeStorage,Tray,Menu,nativeTheme}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Store,selectProfile,atomic}=require('./core/store.cjs');
const {TwitchAuth}=require('./core/twitch-auth.cjs');
const {Twitch}=require('./core/twitch.cjs');
const {BOTS}=require('./core/model.cjs');
const {examples}=require('./core/examples.cjs');
const test=process.argv.includes('--test-mode'),startTray=process.argv.includes('--start-tray');
let startupError;
try{app.setPath('userData',selectProfile(path.join(app.getPath('appData'),'CommandDesk'),test,process.env.COMMAND_DESK_TEST_DATA));}catch(e){startupError=e;}
app.setAppUserModelId('com.fermionaplay.commanddesk');
const primary=startupError?true:app.requestSingleInstanceLock();if(!primary)app.quit();
const root=app.getPath('userData'),uiUrl=pathToFileURL(path.join(__dirname,'ui/index.html')).href;
let win,tray,store,auth,twitch,closing=false;
function secretSave(name,value){
  if(!safeStorage.isEncryptionAvailable())throw Error('secureStorage');
  atomic(path.join(root,name),safeStorage.encryptString(JSON.stringify(value)));
}
function secretLoad(name){const file=path.join(root,name);if(!fs.existsSync(file))return null;try{return JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));}catch{throw Error('secureStorage');}}
function state(){return {version:app.getVersion(),settings:store.settings(),commands:store.commands(),draft:store.meta('draft'),drafts:store.drafts(),selectedCommand:store.meta('selectedCommand'),history:store.history(),
  announcements:store.meta('announcements',[]),announcementSettings:twitch.announcements.settings(),timerDraft:store.meta('timerDraft'),live:twitch.live,
  auth:{...auth.view(),message:undefined},connection:twitch.status,
  audience:twitch.engine.audience.candidates(new Set([...BOTS,...store.settings().excluded,auth.saved?.user.login||'']),'',true),
  audienceStatus:twitch.engine.audience.status(),audienceUpdatedAt:twitch.engine.audience.updatedAt,
  queue:twitch.queue.length,dataPath:root,test};}
function show(){if(win&&!win.isDestroyed()){win.show();if(win.isMinimized())win.restore();win.focus();win.webContents.focus();}}
function theme(){nativeTheme.themeSource=store.settings().theme;win?.setBackgroundColor(store.settings().theme==='dark'?'#191c20':'#f5f7f8');}
app.on('second-instance',show);
app.whenReady().then(async()=>{
  if(!primary)return;if(startupError)throw startupError;
  store=new Store(root,Date.now,{starter:!test});store.backup();
  auth=new TwitchAuth({saved:secretLoad('auth.bin'),pending:secretLoad('pending-auth.bin'),save:v=>secretSave('auth.bin',v),savePending:v=>secretSave('pending-auth.bin',v)});
  twitch=new Twitch({auth,store,test});
  win=new BrowserWindow({width:1400,height:920,minWidth:940,minHeight:680,title:'Command Desk',icon:path.join(__dirname,'assets/icon.ico'),show:false,autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.on('focus',()=>win.webContents.focus());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  require('./core/taskbar.cjs').attachTaskbar({app,shell,ipcMain,win,test,name:'Command Desk',appId:'com.fermionaplay.commanddesk'});
  win.webContents.on('will-navigate',(e,url)=>{if(url!==uiUrl)e.preventDefault();});
  win.webContents.session.setPermissionRequestHandler((_,__,cb)=>cb(false));
  const actions={
    state:()=>state(),
    save:input=>{const result=store.save(input);store.clearDraft(result.id);return result;},
    reorder:ids=>store.reorder(ids),
    draft:input=>store.saveDraft(input),
    selectCommand:id=>{store.selectDraft(id);return state();},
    create:kind=>{const c=(examples(store.settings().language).find(e=>e.key===kind)||examples(store.settings().language)[0]).command;c.enabled=false;const base=c.trigger;let n=2;while(store.commands().some(x=>[x.trigger,...x.aliases].includes(c.trigger)))c.trigger=base+n++;return store.save(c);},
    examples:()=>store.addExamples(),
    enabled:input=>{const c=store.setEnabled(input);if(!c.enabled)twitch.queue=twitch.queue.filter(item=>item.command!==c.trigger);return c;},
    saveTimer:input=>store.saveTimer(input),
    timerDraft:input=>{
      if(input&&(JSON.stringify(input).length>200000||!Array.isArray(input.timers)||input.timers.length>100))throw Error('tooLong');
      store.setMeta('timerDraft',input);
    },
    timerEnabled:({id,enabled})=>{
      const timer=store.meta('announcements',[]).find(value=>value.id===id);if(!timer)throw Error('notFound');
      return store.saveTimer({...timer,enabled:!!enabled});
    },
    removeTimer:id=>store.removeTimer(id),
    announcementSettings:input=>store.saveAnnouncementSettings(input),
    remove:id=>store.remove(id),
    settings:input=>{store.saveSettings(input);if(input.paused)twitch.queue=[];theme();return store.settings();},
    preview:({command,message,user,names})=>{
      if(typeof message!=='string'||message.length>1000||typeof user!=='string'||user.length>25||!Array.isArray(names)||names.length>100)throw Error('invalidPreview');
      return twitch.engine.preview(command,{text:message,userId:'preview-author',login:user.toLowerCase(),name:user,channel:'my_channel'},names.map(n=>String(n).slice(0,25)));
    },
    login:async()=>{await auth.start(require('./twitch-client.json').clientId);return auth.view();},
    openLogin:()=>{const url=auth.view().pending?.url;if(url)return shell.openExternal(url);},
    cancelLogin:()=>auth.cancel(),
    logout:()=>{twitch.stop();auth.logout();},
    export:async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'Command-Desk-commands.json',filters:[{name:'JSON',extensions:['json']}]});if(!r.canceled)atomic(r.filePath,JSON.stringify({version:1,commands:store.commands()},null,2));},
    import:async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(r.canceled)return;if(fs.statSync(r.filePaths[0]).size>5000000)throw Error('tooLong');store.import(JSON.parse(fs.readFileSync(r.filePaths[0],'utf8')));},
    clearHistory:()=>store.clearHistory(),
    openProfile:()=>shell.openPath(root),
    backup:()=>store.backup(),
    tray:()=>win.hide()
  };
  for(const [name,fn]of Object.entries(actions))ipcMain.handle('desk:'+name,async(event,data)=>{
    if(closing||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==uiUrl)throw Error('Untrusted frame');
    try{return {ok:true,value:await fn(data)};}catch(e){return {ok:false,error:e.publicMessage?'authError':e.message||'operationFailed'};}
  });
  tray=new Tray(path.join(__dirname,'assets/icon.png'));tray.setToolTip('Command Desk');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Command Desk',click:show},{label:'Exit / Выход / Вийти',click:()=>app.quit()}]));tray.on('double-click',show);
  await win.loadURL(uiUrl);theme();if(!startTray&&!test)win.show();auth.resume();if(!test)void twitch.tick();
}).catch(async e=>{await dialog.showMessageBox({type:'info',title:'Command Desk',message:'Command Desk: '+e.message,detail:'Your saved data has not been replaced. / Сохранённые данные не заменены.',buttons:['OK']});app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(closing)return;closing=true;twitch?.dispose();auth?.dispose();try{store?.close();}finally{tray?.destroy();}});
