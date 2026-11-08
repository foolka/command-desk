const {loadSdk,CHATTERS_SCOPE}=require('./twitch-auth.cjs');
const {Engine}=require('./engine.cjs');
const {Announcements}=require('./announcements.cjs');
class Twitch{
  constructor({auth,store,sdk=loadSdk,test=false,now=Date.now}){
    Object.assign(this,{auth,store,sdk,test,now});
    this.engine=new Engine({store,now});this.generation=0;this.queue=[];this.status='offline';this.sentAt=[];this.outgoing=new Map();
    this.audienceNextAt=0;this.audienceJob=null;
    this.announcements=new Announcements(store,now);this.live=false;this.liveCheckedAt=0;
    auth.on('authorized',()=>{this.stop();if(!test)void this.tick();});
    auth.on('expired',()=>this.stop());auth.on('retry',()=>this.stop());
    if(!test){this.timer=setInterval(()=>void this.tick(),15000);this.timer.unref();}
  }
  set(status){if(this.status!==status){this.status=status;this.store.log('connection',{status});}}
  stop(){
    this.generation++;this.listener?.stop();this.listener=null;this.api=null;
    this.queue=[];clearTimeout(this.sendTimer);this.engine.reset();this.set('offline');
    this.audienceJob=null;this.audienceNextAt=0;this.engine.audience.clear('onlineOffline');
    this.live=false;this.liveCheckedAt=0;
    this.announcements.messages=0;
  }
  async tick(){
    if(this.test||this.busy||!this.auth.saved||this.auth.invalid)return;
    this.busy=true;const gen=this.generation;
    try{
      await this.auth.validate();if(gen!==this.generation)return;
      if(!this.api){
        const sdk=await this.sdk(),provider=await this.auth.getProvider();if(gen!==this.generation)return;
        const user=this.auth.saved.user;
        this.api=new sdk.ApiClient({authProvider:provider,logger:{minLevel:'error'}});
        const listener=new sdk.EventSubWsListener({apiClient:this.api,logger:{minLevel:'error'}});
        this.listener=listener;this.socketSince=Date.now();this.set('connecting');
        const current=()=>gen===this.generation;
        listener.onSubscriptionCreateSuccess(()=>{if(current()){this.set('ready');void this.refreshAudience();}});
        listener.onSubscriptionCreateFailure(()=>{if(current())this.set('error');});
        listener.onRevoke(()=>{if(current()){this.stop();this.auth.invalidate('Нужно заново войти через Twitch и разрешить доступ.');}});
        listener.onUserSocketDisconnect(()=>{if(current()){this.socketSince=Date.now();this.queue=[];this.audienceJob=null;this.audienceNextAt=0;this.engine.audience.clear('onlineOffline');this.set('reconnecting');}});
        listener.onChannelChatMessage(user.id,user.id,event=>{
          if(!current())return;
          this.receive({id:event.messageId,text:event.messageText,userId:event.chatterId,login:event.chatterName,name:event.chatterDisplayName,
            channelId:user.id,channel:user.login,badges:event.badges,foreign:!!event.sourceBroadcasterId&&event.sourceBroadcasterId!==user.id});
        });
        listener.start();
      }
      if(this.status!=='ready'&&Date.now()-this.socketSince>120000)this.stop();
      if(this.status==='ready'){
        void this.refreshAudience();
        await this.refreshLive();
        if(gen===this.generation)this.scheduleAnnouncement();
      }
    }catch{if(gen===this.generation){this.stop();this.set('error');}}
    finally{this.busy=false;}
  }
  async refreshLive(){
    if(!this.store.meta?.('announcements',[]).some(t=>t.enabled)||this.now()-this.liveCheckedAt<60000)return;
    const gen=this.generation;
    try{
      const live=!!await this.api.streams.getStreamByUserId(this.auth.saved.user.id);
      if(gen===this.generation){this.live=live;this.liveCheckedAt=this.now();}
    }catch{if(gen===this.generation){this.live=false;this.liveCheckedAt=this.now();}}
  }
  canAnnounce(){return !!this.auth.saved?.token?.scope?.includes('moderator:manage:announcements');}
  scheduleAnnouncement(){
    if(this.test||this.queue.length||this.sending||this.status!=='ready'||!this.canAnnounce())return;
    const timer=this.announcements.next(this.live&&this.now()-this.liveCheckedAt<90000);if(!timer)return;
    this.queue.push({message:timer.text,color:timer.color,delivery:'announcement',timerId:timer.id,command:timer.name,at:Date.now()});
    void this.drain();
  }
  async refreshAudience(){
    if(!this.api||this.status!=='ready')return;
    const audience=this.engine.audience;
    if(!this.auth.saved?.token?.scope?.includes(CHATTERS_SCOPE)){
      if(audience.status()!=='onlinePermission')this.store.log('onlinePermission');
      audience.clear('onlinePermission');return;
    }
    if(this.audienceJob||this.now()<this.audienceNextAt)return;
    const api=this.api,user=this.auth.saved.user.id,gen=this.generation,job={};
    this.audienceJob=job;this.audienceNextAt=this.now()+30000;
    const current=()=>this.audienceJob===job&&this.generation===gen;
    let timeout;
    try{
      // Commit only a complete snapshot: a failed later page must not bias the draw.
      const fetchAll=async()=>{
        const users=[],cursors=new Set();let after;
        for(let page=0;page<100;page++){
          if(!current())return [];
          const result=await api.chat.getChatters(user,{limit:1000,after});
          if(!current())return [];
          for(const item of result.data){
            if(!item.userId||!item.userName)throw Error('invalidChatter');
            users.push({id:item.userId,login:item.userName,name:item.userDisplayName||item.userName});
          }
          after=result.cursor;
          if(!after)return users;
          if(cursors.has(after))throw Error('repeatedCursor');
          cursors.add(after);
        }
        throw Error('incompleteChatters');
      };
      const users=await Promise.race([fetchAll(),new Promise((_,reject)=>{
        timeout=setTimeout(()=>reject(Error('chattersTimeout')),20000);timeout.unref?.();
      })]);
      if(!current())return;
      const previous=audience.status();audience.replace(users);
      if(previous!=='onlineReady')this.store.log('onlineReady',{count:audience.users.length});
    }catch(error){
      if(!current())return;
      const reason=error?.statusCode===403||error?.name==='MissingScopeError'?'onlinePermission':'onlineUnavailable';
      if(audience.status()!==reason)this.store.log(reason,{status:Number(error?.statusCode)||0});
      audience.clear(reason);
    }finally{clearTimeout(timeout);if(current())this.audienceJob=null;}
  }
  receive(event){
    try{
      const now=Date.now();
      for(const [text,until]of this.outgoing)if(until<now)this.outgoing.delete(text);
      event.echo=event.userId===event.channelId&&this.outgoing.has(event.text);
      if(!this.store.settings().paused)this.announcements.activity(event);
      const result=this.engine.receive(event);if(!result)return;
      if(!result.messages.length){this.store.log(result.reason,{command:result.command,user:result.user});return;}
      if(this.status!=='ready'||this.queue.length+result.messages.length>30){this.store.log('queueFull',{command:result.command});return;}
      if(result.delivery==='announcement'&&!this.canAnnounce()){this.store.log('announcementPermission',{command:result.command});return;}
      for(const message of result.messages)this.queue.push({message,command:result.command,user:result.user,delivery:result.delivery,color:result.color,at:Date.now()});
      void this.drain();
    }catch(e){this.store.log('commandError',{code:['messageTooLong'].includes(e.message)?e.message:'invalidCommand'});}
  }
  async drain(){
    if(this.sending||!this.queue.length)return;
    if(!this.api||this.status!=='ready'||this.store.settings().paused){this.queue=[];return;}
    const now=Date.now();this.sentAt=this.sentAt.filter(t=>now-t<30000);
    const wait=Math.max(0,(this.lastSent||0)+1200-now,this.queue[0].delivery==='announcement'?(this.lastAnnouncement||0)+2100-now:0,this.sentAt.length>=20?this.sentAt[0]+30000-now:0);
    if(wait){clearTimeout(this.sendTimer);this.sendTimer=setTimeout(()=>void this.drain(),wait+5);return;}
    const item=this.queue.shift();
    if(now-item.at>20000){this.store.log('expired',{command:item.command});return this.drain();}
    if(item.timerId&&this.announcements.next(this.live&&this.now()-this.liveCheckedAt<90000)?.id!==item.timerId)return this.drain();
    if(item.delivery==='announcement'&&this.announcements.duplicate(item.message)){this.store.log('duplicateAnnouncement',{command:item.command});return this.drain();}
    this.sending=true;const gen=this.generation;
    this.lastSent=now;this.sentAt.push(now);
    this.outgoing.set(item.message,now+60000);
    try{
      let sent={};
      if(item.delivery==='announcement'){
        if(!this.canAnnounce())throw Error('announcementPermission');
        this.lastAnnouncement=now;
        // Reserve before I/O: an ambiguous timeout must not repeat an announcement.
        this.announcements.reserve(item.message,item.timerId);
        await this.api.chat.sendAnnouncement(this.auth.saved.user.id,{message:item.message,color:item.color});
      }else sent=await this.api.chat.sendChatMessage(this.auth.saved.user.id,item.message);
      if(gen===this.generation){if(sent.id)this.store.claim(sent.id);this.store.log('sent',{command:item.command,user:item.user,message:item.message});}
    }catch(e){
      if(gen===this.generation)this.store.log('sendFailed',{command:item.command,status:Number(e.statusCode)||0});
      // A timeout may mean the message arrived. Never resend an ambiguous request.
    }finally{this.sending=false;if(gen===this.generation)void this.drain();}
  }
  dispose(){clearInterval(this.timer);this.stop();}
}
module.exports={Twitch};
