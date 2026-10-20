const {loadSdk}=require('./twitch-auth.cjs');
const {Engine}=require('./engine.cjs');
class Twitch{
  constructor({auth,store,sdk=loadSdk,test=false}){
    Object.assign(this,{auth,store,sdk,test});
    this.engine=new Engine({store});this.generation=0;this.queue=[];this.status='offline';this.sentAt=[];this.outgoing=new Map();
    auth.on('authorized',()=>{this.stop();if(!test)void this.tick();});
    auth.on('expired',()=>this.stop());auth.on('retry',()=>this.stop());
    if(!test){this.timer=setInterval(()=>void this.tick(),15000);this.timer.unref();}
  }
  set(status){if(this.status!==status){this.status=status;this.store.log('connection',{status});}}
  stop(){
    this.generation++;this.listener?.stop();this.listener=null;this.api=null;
    this.queue=[];clearTimeout(this.sendTimer);this.engine.reset();this.set('offline');
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
        listener.onSubscriptionCreateSuccess(()=>{if(current())this.set('ready');});
        listener.onSubscriptionCreateFailure(()=>{if(current())this.set('error');});
        listener.onRevoke(()=>{if(current()){this.stop();this.auth.invalidate('Нужно заново войти через Twitch и разрешить доступ.');}});
        listener.onUserSocketDisconnect(()=>{if(current()){this.socketSince=Date.now();this.queue=[];this.set('reconnecting');}});
        listener.onChannelChatMessage(user.id,user.id,event=>{
          if(!current())return;
          this.receive({id:event.messageId,text:event.messageText,userId:event.chatterId,login:event.chatterName,name:event.chatterDisplayName,
            channelId:user.id,channel:user.login,badges:event.badges,foreign:!!event.sourceBroadcasterId&&event.sourceBroadcasterId!==user.id});
        });
        listener.start();
      }
      if(this.status!=='ready'&&Date.now()-this.socketSince>120000)this.stop();
    }catch{if(gen===this.generation){this.stop();this.set('error');}}
    finally{this.busy=false;}
  }
  receive(event){
    try{
      const now=Date.now();
      for(const [text,until]of this.outgoing)if(until<now)this.outgoing.delete(text);
      event.echo=event.userId===event.channelId&&this.outgoing.has(event.text);
      const result=this.engine.receive(event);if(!result)return;
      if(!result.messages.length){this.store.log(result.reason,{command:result.command,user:result.user});return;}
      if(this.status!=='ready'||this.queue.length+result.messages.length>30){this.store.log('queueFull',{command:result.command});return;}
      for(const message of result.messages)this.queue.push({message,command:result.command,user:result.user,at:Date.now()});
      void this.drain();
    }catch(e){this.store.log('commandError',{code:['messageTooLong'].includes(e.message)?e.message:'invalidCommand'});}
  }
  async drain(){
    if(this.sending||!this.queue.length)return;
    if(!this.api||this.status!=='ready'||this.store.settings().paused){this.queue=[];return;}
    const now=Date.now();this.sentAt=this.sentAt.filter(t=>now-t<30000);
    const wait=Math.max(0,(this.lastSent||0)+1200-now,this.sentAt.length>=20?this.sentAt[0]+30000-now:0);
    if(wait){clearTimeout(this.sendTimer);this.sendTimer=setTimeout(()=>void this.drain(),wait+5);return;}
    const item=this.queue.shift();
    if(now-item.at>20000){this.store.log('expired',{command:item.command});return this.drain();}
    this.sending=true;const gen=this.generation;
    this.lastSent=now;this.sentAt.push(now);
    this.outgoing.set(item.message,now+60000);
    try{
      const sent=await this.api.chat.sendChatMessage(this.auth.saved.user.id,item.message,{forSourceOnly:true});
      if(gen===this.generation){if(sent.id)this.store.claim(sent.id);this.store.log('sent',{command:item.command,user:item.user,message:item.message});}
    }catch(e){
      if(gen===this.generation)this.store.log('sendFailed',{command:item.command,status:Number(e.statusCode)||0});
      // A timeout may mean the message arrived. Never resend an ambiguous request.
    }finally{this.sending=false;if(gen===this.generation)void this.drain();}
  }
  dispose(){clearInterval(this.timer);this.stop();}
}
module.exports={Twitch};
