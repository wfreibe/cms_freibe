'use strict';
const fs=require('fs'), path=require('path'), os=require('os'), crypto=require('crypto'), net=require('net');
const {execFileSync,spawn}=require('child_process');
const {zipEntries}=require('../scripts/isolation_guard');
const root=path.resolve(__dirname,'..');
const baseEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('CMS_')));
function run(command,args=[], options={}) { return execFileSync(command,args,{cwd:root,env:baseEnv,stdio:'pipe',timeout:120000,...options}); }
function php(code,env={}) { return run('php',['-r',code],{env:{...baseEnv,...env}}).toString().trim(); }
function temp() {return fs.mkdtempSync(path.join(os.tmpdir(),'cms_sfreibe_test_'));}
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function snapshot(dir){ const out={}; if(!fs.existsSync(dir)) return out; function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name); if(e.isDirectory())walk(f);else out[path.relative(dir,f)]=hash(f);}} walk(dir);return out;}
function extract(zip,dest){for(const {name,data} of zipEntries(fs.readFileSync(zip))){const file=path.resolve(dest,name);if(!file.startsWith(path.resolve(dest)+path.sep))throw new Error('Unsafe ZIP path'); if(name.endsWith('/'))fs.mkdirSync(file,{recursive:true});else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}}}
async function server(router,env={},documentRoot=path.dirname(router)){
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const child=spawn('php',['-d','display_errors=0','-S',`127.0.0.1:${port}`,'-t',documentRoot,router],{env:{...baseEnv,...env},stdio:'ignore'});
 const url=`http://127.0.0.1:${port}`;
 try{
  for(let i=0;i<50;i++){
   try{
    const response=await fetch(url+'/api/auth/session',{signal:AbortSignal.timeout(1000)});
    const body=await response.json();
    if(response.ok && body && typeof body.authenticated==='boolean')return {child,url,port};
   }catch{}
   if(child.exitCode!==null)break;
   await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('PHP API test server did not return a valid session response');
 }catch(e){child.kill();throw e;}
}
async function stop(s){if(s&&s.child.exitCode===null){const exited=new Promise(r=>s.child.once('exit',r));s.child.kill();await exited;}}
module.exports={fs,path,os,crypto,root,baseEnv,run,php,temp,hash,snapshot,extract,server,stop};
