const {contextBridge,ipcRenderer}=require('electron');
const actions=['state','save','draft','create','remove','settings','preview','login','openLogin','cancelLogin','logout','export','import','clearHistory','openProfile','backup','tray'];
actions.push('taskbarStatus','taskbarPin');
actions.push('examples','enabled','saveTimer','removeTimer','announcementSettings','timerDraft','timerEnabled','reorder');
contextBridge.exposeInMainWorld('desk',Object.fromEntries(actions.map(name=>[name,data=>ipcRenderer.invoke('desk:'+name,data)])));
