const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {normalize,settings}=require('./model.cjs');
function atomic(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,value,{flush:true});fs.renameSync(tmp,file);}
function selectProfile(production,test,override){
  if(!test)return production;
  if(!override)throw Error('testProfileRequired');
  const actual=p=>fs.existsSync(p)?fs.realpathSync.native(p):path.resolve(p);
  const rel=path.relative(actual(production),actual(override));
  if(!rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))throw Error('unsafeTestProfile');
  return path.resolve(override);
}
class Store{
  constructor(root,now=Date.now,options={}){
    this.root=root;this.now=now;this.claims=0;
    fs.mkdirSync(root,{recursive:true});
    const file=path.join(root,'commands.sqlite'),marker=path.join(root,'profile-identity.json');
    const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
    const probe=path.join(root,'.probe-'+randomUUID());
    fs.writeFileSync(probe,'check',{flag:'wx'});
    try{
      for(const f of [root,probe,file,marker,path.join(root,'auth.bin')]){
        if(fs.existsSync(f)&&!same(fs.realpathSync.native(f),f))throw Error('profileRedirected');
      }
    }finally{fs.unlinkSync(probe);}
    const exists=fs.existsSync(file);
    if(!exists&&['profile-identity.json','auth.bin','pending-auth.bin','backups','commands.sqlite-wal'].some(n=>fs.existsSync(path.join(root,n))))throw Error('profileMissing');
    this.db=new DatabaseSync(file);
    try {
      if(exists){
        if(this.db.prepare('PRAGMA user_version').get().user_version>1)throw Error('profileNewer');
        const check=this.db.prepare('PRAGMA quick_check').all();
        if(check.length!==1||Object.values(check[0])[0]!=='ok')throw Error('profileDamaged');
        const id=JSON.parse(this.db.prepare("SELECT value FROM meta WHERE key='id'").get()?.value||'null');
        if(!id)throw Error('profileDamaged');
        if(fs.existsSync(marker)&&JSON.parse(fs.readFileSync(marker,'utf8')).id!==id)throw Error('profileMissing');
      }
      this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,at INTEGER,code TEXT,data TEXT);
        CREATE TABLE IF NOT EXISTS seen(id TEXT PRIMARY KEY,at INTEGER);`);
      this.db.exec('PRAGMA user_version=1');
      if(!exists){
        this.db.exec('BEGIN IMMEDIATE');
        try{
          this.setMeta('id',randomUUID());this.setMeta('settings',settings());
          if(options.starter){
            const catalog=require('./examples.cjs').examples(options.language||this.settings().language);
            for(const {command} of catalog)this.db.prepare('INSERT INTO commands VALUES(?,?)').run(command.id,JSON.stringify(command));
            this.setMeta('exampleCatalogV1',Object.fromEntries(catalog.map(({key,command})=>[key,command.id])));
            this.setMeta('announcements',[require('./examples.cjs').starterAnnouncement(options.language||this.settings().language)]);
            this.setMeta('starterCatalogV1',true);
          }
          this.db.exec('COMMIT');
        }catch(error){this.db.exec('ROLLBACK');throw error;}
      }
      if(!fs.existsSync(marker))atomic(marker,JSON.stringify({version:1,id:this.meta('id')}));
      this.db.prepare('DELETE FROM seen WHERE at<?').run(now()-86400000);
    }catch(e){this.db.close();throw e;}
  }
  meta(key,fallback=null){const row=this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);return row?JSON.parse(row.value):fallback;}
  setMeta(key,value){this.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
  settings(){return settings(this.meta('settings',{}));}
  saveSettings(value){this.setMeta('settings',settings(value));}
  commands(){return this.db.prepare('SELECT data FROM commands ORDER BY rowid').all().map(r=>JSON.parse(r.data));}
  validateNames(commands){
    const used=new Set();
    for(const c of commands)for(const t of new Set([c.trigger,...c.aliases])){
      if(used.has(t))throw Error('duplicateTrigger');used.add(t);
    }
  }
  backup(){
    const folder=path.join(this.root,'backups');fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,`${this.now()}-${randomUUID()}.json`);
    atomic(file,JSON.stringify({version:1,commands:this.commands(),settings:this.settings(),announcements:this.meta('announcements',[]),announcementSettings:this.meta('announcementSettings'),draft:this.meta('draft'),timerDraft:this.meta('timerDraft')},null,2));
    const files=fs.readdirSync(folder).filter(n=>/^\d+-[a-f0-9-]+\.json$/.test(n)).sort();
    for(const old of files.slice(0,-20))fs.unlinkSync(path.join(folder,old));
  }
  save(input){
    const c=normalize(input),others=this.commands().filter(v=>v.id!==c.id);
    this.validateNames([...others,c]);this.backup();
    this.db.prepare('INSERT INTO commands VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(c.id,JSON.stringify(c));
    return c;
  }
  remove(id){if(!this.commands().some(c=>c.id===id))throw Error('notFound');this.backup();this.db.prepare('DELETE FROM commands WHERE id=?').run(id);}
  setEnabled({id,enabled}){
    const command=this.commands().find(c=>c.id===id);if(!command)throw Error('notFound');
    this.backup();command.enabled=!!enabled;
    this.db.prepare('UPDATE commands SET data=? WHERE id=?').run(JSON.stringify(command),id);
    const draft=this.meta('draft');if(draft?.id===id)this.setMeta('draft',{...draft,enabled:!!enabled});
    return command;
  }
  addExamples(language=this.settings().language){
    const ids=this.meta('exampleCatalogV1',{}),added=[],existing=this.commands();
    for(const {key,command} of require('./examples.cjs').examples(language)){
      if(ids[key])continue;
      const base=command.trigger;let n=2;
      while([...existing,...added].some(c=>[c.trigger,...c.aliases].includes(command.trigger)))command.trigger=base+n++;
      ids[key]=command.id;added.push(command);
    }
    if(!added.length)return added;
    this.validateNames([...existing,...added]);this.backup();this.db.exec('BEGIN IMMEDIATE');
    try{
      for(const command of added)this.db.prepare('INSERT INTO commands VALUES(?,?)').run(command.id,JSON.stringify(command));
      this.setMeta('exampleCatalogV1',ids);this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return added;
  }
  saveTimer(input){
    const timer=require('./announcements.cjs').normalizeTimer(input),all=this.meta('announcements',[]);
    const index=all.findIndex(t=>t.id===timer.id);if(index<0&&all.length>=100)throw Error('tooLong');
    this.backup();if(index<0)all.push(timer);else all[index]=timer;
    this.setMeta('announcements',all);return timer;
  }
  removeTimer(id){this.backup();this.setMeta('announcements',this.meta('announcements',[]).filter(t=>t.id!==id));}
  saveAnnouncementSettings(input){
    const value={intervalMinutes:Number(input.intervalMinutes),minMessages:Number(input.minMessages),onlyLive:!!input.onlyLive};
    if(!Number.isInteger(value.intervalMinutes)||value.intervalMinutes<1||value.intervalMinutes>1440||!Number.isInteger(value.minMessages)||value.minMessages<0||value.minMessages>10000)throw Error('invalidNumber');
    this.backup();this.setMeta('announcementSettings',value);return value;
  }
  import(data){
    if(data?.version!==1||!Array.isArray(data.commands)||data.commands.length>1000)throw Error('invalidImport');
    const incoming=data.commands.map(c=>normalize({...c,id:randomUUID()}));
    this.validateNames([...this.commands(),...incoming]);this.backup();
    this.db.exec('BEGIN IMMEDIATE');
    try{for(const c of incoming)this.db.prepare('INSERT INTO commands VALUES(?,?)').run(c.id,JSON.stringify(c));this.db.exec('COMMIT');}
    catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  claim(id){
    const result=this.db.prepare('INSERT OR IGNORE INTO seen VALUES(?,?)').run(String(id).slice(0,200),this.now());
    if(++this.claims%1000===0)this.db.exec('DELETE FROM seen WHERE rowid NOT IN (SELECT rowid FROM seen ORDER BY rowid DESC LIMIT 10000)');
    return Number(result.changes)>0;
  }
  log(code,data={}){
    this.db.prepare('INSERT INTO history(at,code,data) VALUES(?,?,?)').run(this.now(),code,JSON.stringify(data));
    this.db.exec('DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 200)');
  }
  history(){return this.db.prepare('SELECT * FROM history ORDER BY id DESC').all().map(r=>({...r,data:JSON.parse(r.data)}));}
  clearHistory(){this.db.exec('DELETE FROM history');}
  close(){this.db.close();}
}
module.exports={Store,selectProfile,atomic};
