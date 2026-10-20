const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function xml(node){const[tag,attrs,children=[]]=node;return `<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${v}"`).join(' ')}>${children.map(xml).join('')}</${tag}>`;}
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true});try{
    const p=await b.newPage({viewport:{width:256,height:256}});
    await p.setContent(`<style>body{margin:0}div{height:256px;width:256px;display:flex;align-items:center;justify-content:center;background:#167b70;border-radius:48px;color:white}svg{width:162px;height:162px;stroke-width:1.7}</style><div>${xml(require('lucide').icons.MessagesSquare)}</div>`);
    const png=await p.screenshot({path:path.join(root,'assets/icon.png'),omitBackground:true});const h=Buffer.alloc(22);h.writeUInt16LE(1,2);h.writeUInt16LE(1,4);h.writeUInt16LE(1,10);h.writeUInt16LE(32,12);h.writeUInt32LE(png.length,14);h.writeUInt32LE(22,18);fs.writeFileSync(path.join(root,'assets/icon.ico'),Buffer.concat([h,png]));
    await p.setContent(`<style>body{margin:0;background:#266c62}div{height:256px;display:flex;align-items:center;justify-content:center;color:#fff}svg{width:176px;height:176px;stroke-width:1.4}</style><div>${xml(require('lucide').icons.UserRound)}</div>`);
    await p.screenshot({path:path.join(root,'assets/demo-avatar.png')});
    const lucide=path.resolve(path.dirname(require.resolve('lucide')),'../umd/lucide.js');fs.copyFileSync(lucide,path.join(root,'assets/lucide.js'));
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
