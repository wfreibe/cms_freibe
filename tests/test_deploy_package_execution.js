'use strict';
const assert=require('assert/strict');
const {fs,path,root,baseEnv,run,temp,extract,server,stop}=require('./helpers');
const {scanZip,enforce,zipEntries}=require('../scripts/isolation_guard');
(async()=>{
 if(process.env.REQUIRE_HTTP_TESTS==='1' && process.platform==='win32')throw new Error('Required deployment HTTP tests cannot be skipped.');
 if(process.platform==='win32'){console.log('SKIP Windows: HTTP deploy-package execution; mandatory in Ubuntu release CI. No PHP application is extracted or started.');return;}
 const dir=temp();let api;
 try{
  const zip=path.resolve(process.argv[2] || path.join(root,'dist-packages/cms_sfreibe-deploy.zip'));enforce(scanZip(zip),'Deploy ZIP');
  const entries=zipEntries(fs.readFileSync(zip));
  for(const required of ['webroot/api/api.php','webroot/index.html','server/lib/Database.php','server/config/cms_config.sample.php','server/data/','server/backups/'])assert(entries.some(e=>e.name===required),required);
  for(const {name} of entries)assert(!/(^|\/)(node_modules|\.git|scratch)(\/|$)|cms_config\.php$|(^|\/)\.env|\.(sqlite|db)(-wal|-shm)?$|\.log$/i.test(name),name);
  extract(zip,dir);
  for(const [deployed,source] of [['webroot/.htaccess','frontend/public/.htaccess'],['webroot/api/api.php','frontend/public/api/api.php']])assert.deepEqual(fs.readFileSync(path.join(dir,deployed)),fs.readFileSync(path.join(root,source)),deployed);
  const config=path.join(dir,'server/config/cms_config.php');fs.writeFileSync(config,"<?php return ['db_path'=>dirname(__DIR__).'/data/content.sqlite','backup_dir'=>dirname(__DIR__).'/backups','cookie_secure'=>false];");
  // Exercise default local config discovery: no CMS_DB_PATH/CMS_CONFIG_PATH overrides.
  run('php',[path.join(dir,'server/bin/migrate.php')]);
  api=await server(path.join(dir,'webroot/api/api.php'),{},path.join(dir,'webroot'));
  for(const route of ['ready','sections','auth%2Fsession'])assert.equal((await fetch(api.url+'/api/api.php?__cms_route='+route+'&lang=de')).status,200,route);
  for(const [route,status] of [['auth/session',200],['sections',200],['legal/impressum',404],['legal/datenschutz',404],['unknown',404]])assert.equal((await fetch(api.url+'/api/'+route)).status,status,route);
  const response=await fetch(api.url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'invalid'})});assert.equal(response.status,401);
  const provision=run('php',[path.join(dir,'server/bin/provision_admin.php')],{env:{...baseEnv,CMS_CONFIG_PATH:config}}).toString().trim();
  const oneTime=provision.match(/^One-time admin password: ([A-Za-z0-9_-]{32})$/)?.[1];assert(oneTime);
  const login=await fetch(api.url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:oneTime})});
  assert.equal(login.status,200);assert.equal((await login.json()).passwordChangeRequired,true);
  console.log('Extracted deploy ZIP smoke passed: sibling library, fresh DB, draft legal 404, closed default login and CLI first access.');
 }finally{await stop(api);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
