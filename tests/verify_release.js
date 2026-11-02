'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const {extract}=require('./helpers');
const {audit,expected}=require('../scripts/release_audit');
const {snapshot,assertUnchanged,assertManifest}=require('../scripts/git_release_gate');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist-packages');
const isWindows=process.platform==='win32',npm=isWindows?'npm.cmd':'npm';
const sourceZip=path.join(output,'cms_sfreibe-source.zip'),deployZip=path.join(output,'cms_sfreibe-deploy.zip');
const results=[];
let releaseOutputStarted=false;
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function sourceHash(){const h=crypto.createHash('sha256');for(const [name,file] of [...expected('source')].sort(([a],[b])=>a.localeCompare(b,'en'))){h.update(name+'\0');h.update(fs.readFileSync(file));h.update('\0');}return h.digest('hex');}
function inside(p,base){const a=path.resolve(p),b=path.resolve(base);if(a===b||!a.startsWith(b+path.sep))throw new Error('Unsafe generated path: '+a);return a;}
function command(label,program,args,options={}){
  console.log('RUN '+label);
  const started=Date.now();
  const result=spawnSync(program,args,{cwd:options.cwd||root,encoding:'utf8',timeout:options.timeout||300000,maxBuffer:12*1024*1024,shell:isWindows&&['npm.cmd','composer'].includes(program),env:process.env});
  const entry={command:label,exitCode:result.status,elapsedMs:Date.now()-started};
  if(result.error)entry.error=result.error.code||result.error.message;
  results.push(entry);
  if(result.status!==0){
    const detail=((result.stdout||'')+'\n'+(result.stderr||'')).slice(-3000).replace(/\$2[ayb]\$\d{2}\$[A-Za-z0-9./]{53}/g,'[REDACTED_HASH]');
    throw new Error(label+' failed (exit '+result.status+'): '+detail);
  }
  return (result.stdout||'').trim();
}
function archiveGenerated(relative,archiveRoot){
  const source=inside(path.join(root,relative),root);
  if(!fs.existsSync(source))return;
  const target=inside(path.join(archiveRoot,relative.replaceAll('/','_')),archiveRoot);
  if(fs.existsSync(target))throw new Error('Release archive collision.');
  fs.renameSync(source,target);
}
function version(program,args){
  const result=spawnSync(program,args,{cwd:root,encoding:'utf8',timeout:10000,shell:isWindows&&['npm.cmd','composer'].includes(program)});
  if(result.status!==0)throw new Error('Cannot read tool version: '+program);
  return ((result.stdout||result.stderr||'').split(/\r?\n/)[0]||'').trim();
}
function recordAudit(label,callback){const started=Date.now();try{callback();results.push({command:label,exitCode:0,elapsedMs:Date.now()-started});}catch(e){results.push({command:label,exitCode:1,elapsedMs:Date.now()-started});throw e;}}
try{
  if(process.platform!=='linux')throw new Error('Full release verification requires Linux (Ubuntu CI); run npm test and build checks locally.');
  const initialGit=snapshot(root);
  const initialHash=sourceHash();
  command('node scripts/isolation_guard.js','node',['scripts/isolation_guard.js']);
  command('node scripts/repository_audit.js','node',['scripts/repository_audit.js']);
  const archiveRoot=path.join(root,'backups','release_artifacts_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(archiveRoot,{recursive:true});
  archiveGenerated('frontend/dist',archiveRoot);
  archiveGenerated('dist-packages',archiveRoot);
  fs.mkdirSync(output,{recursive:true});
  releaseOutputStarted=true;
  command('npm ci',npm,['ci']);
  command('npm ci --prefix frontend',npm,['ci','--prefix','frontend']);
  command('composer install --no-dev --prefer-dist --no-interaction','composer',['install','--no-dev','--prefer-dist','--no-interaction']);
  command('npm audit --omit=dev',npm,['audit','--omit=dev']);
  command('npm audit --omit=dev --prefix frontend',npm,['audit','--omit=dev','--prefix','frontend']);
  command('composer audit --locked --no-dev','composer',['audit','--locked','--no-dev']);
  command('node tests/test_syntax.js','node',['tests/test_syntax.js']);
  command('npm test',npm,['test']);
  command('npm run build',npm,['run','build']);
  command('npm run verify-build',npm,['run','verify-build']);
  command('php scripts/packager.php source','php',['scripts/packager.php','source']);
  command('php scripts/packager.php deploy','php',['scripts/packager.php','deploy']);
  recordAudit('source ZIP entry/security/byte audit',()=>audit(sourceZip,'source'));
  recordAudit('deploy ZIP entry/security/byte audit',()=>audit(deployZip,'deploy'));
  command('node tests/test_package_rejections.js','node',['tests/test_package_rejections.js']);
  const extracted=fs.mkdtempSync(path.join(os.tmpdir(),'cms_sfreibe_release_'));
  try{
    extract(sourceZip,extracted);
    command('source ZIP: node tests/test_isolation_guard.js','node',['tests/test_isolation_guard.js'],{cwd:extracted});
    command('source ZIP: node tests/test_repository_audit.js','node',['tests/test_repository_audit.js'],{cwd:extracted});
    command('source ZIP: node tests/test_git_release_gate.js','node',['tests/test_git_release_gate.js'],{cwd:extracted});
    command('source ZIP: node tests/test_syntax.js','node',['tests/test_syntax.js'],{cwd:extracted});
  }finally{inside(extracted,os.tmpdir());fs.rmSync(extracted,{recursive:true,force:true});}
  command('node tests/test_deploy_package_execution.js','node',['tests/test_deploy_package_execution.js']);
  command('node tests/test_redeploy.js','node',['tests/test_redeploy.js']);
  recordAudit('final source/build unchanged',()=>{if(sourceHash()!==initialHash)throw new Error('Source changed during release.');audit(sourceZip,'source');audit(deployZip,'deploy');});
  recordAudit('final Git HEAD and clean working tree',()=>assertUnchanged(root,initialGit));
  const hashes={source:sha(sourceZip),deploy:sha(deployZip)},now=new Date().toISOString();
  const versions={php:version('php',['--version']),node:version('node',['--version']),npm:version(npm,['--version']),composer:version('composer',['--version'])};
  const manifest={createdAtUtc:now,versions,workingTreeClean:true,sourceTreeSha256:initialHash,gitCommit:initialGit.head,zipSha256:{'cms_sfreibe-source.zip':hashes.source,'cms_sfreibe-deploy.zip':hashes.deploy},tests:results};
  assertManifest(root,initialGit,manifest);
  fs.writeFileSync(path.join(output,'SHA256SUMS'),hashes.source+'  cms_sfreibe-source.zip\n'+hashes.deploy+'  cms_sfreibe-deploy.zip\n');
  fs.writeFileSync(path.join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(output,'verification-commands.json'),JSON.stringify({createdAtUtc:now,zipSha256:manifest.zipSha256,commands:results},null,2)+'\n');
  fs.writeFileSync(path.join(output,'verification.log'),['Release verified '+now,'source SHA-256 '+hashes.source,'deploy SHA-256 '+hashes.deploy,...results.map(r=>`${r.exitCode} ${r.command} (${r.elapsedMs} ms)`) ].join('\n')+'\n');
  assertUnchanged(root,initialGit);
  console.log('RELEASE VERIFIED: source='+hashes.source+' deploy='+hashes.deploy);
}catch(e){
  if(releaseOutputStarted && fs.existsSync(output)) {
    try { fs.rmSync(output,{recursive:true,force:true}); }
    catch(cleanupError) { console.error('Failed to remove unverified release output: '+cleanupError.message); }
  }
  console.error('RELEASE FAILED: '+e.message);process.exitCode=1;
}
