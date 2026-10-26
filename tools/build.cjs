const {packager}=require('@electron/packager');const fs=require('node:fs'),path=require('node:path');
(async()=>{ require('./build-taskbar.cjs').buildTaskbar();const root=path.resolve(__dirname,'..');const [built]=await packager({dir:root,name:'CommandDesk',executableName:'CommandDesk',platform:'win32',arch:'x64',out:path.join(root,'release'),overwrite:true,asar: { unpack: '**/*.node' },prune:true,icon:path.join(root,'assets/icon.ico'),appVersion:require('../package.json').version,
ignore:file=>{const first=file.replace(/\\/g,'/').replace(/^\//,'').split('/')[0];return !!first&&!['assets','core','ui','overlay','node_modules','main.cjs','preload.cjs','package.json','package-lock.json','twitch-client.json'].includes(first);},
win32metadata:{CompanyName:'FermionaPlay',FileDescription:'Command Desk',ProductName:'Command Desk'}});
for(const name of ['README.md','LICENSE','THIRD_PARTY_NOTICES.md','CHANGELOG.md'])fs.copyFileSync(path.join(root,name),path.join(built,name));
fs.copyFileSync(path.join(root,'assets/icon.ico'),path.join(built,'resources/app.ico'));console.log(built);
fs.cpSync(path.join(root,'docs'),path.join(built,'docs'),{recursive:true});
})().catch(e=>{console.error(e);process.exitCode=1;});
