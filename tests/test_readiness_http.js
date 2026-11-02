'use strict';
const assert=require('assert/strict');
const {fs,path,root,baseEnv,run,temp,snapshot,server,stop}=require('./helpers');
(async()=>{
 const dir=temp(),config=path.join(dir,'config.php');let api;
 const env={...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:path.join(dir,'content.sqlite'),CMS_BACKUP_DIR:path.join(dir,'backups')};
 try {
  fs.writeFileSync(config,"<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__.'/sessions'];");
  fs.mkdirSync(path.join(dir,'sessions'));fs.mkdirSync(path.join(dir,'backups'));
  run('php',['bin/migrate.php'],{env});
  api=await server(path.join(root,'frontend/public/api/api.php'),env);
  for(const ready of [true,true,false]) {
   if(!ready)fs.writeFileSync(config,'<?php return "invalid";');
   const before=snapshot(dir);
   const response=await fetch(api.url+'/api/ready',{signal:AbortSignal.timeout(5000)});
   assert.equal(response.status,ready?200:503);
   assert.deepEqual(await response.json(),{ready});
   assert.deepEqual(snapshot(dir),before,'HTTP readiness changed runtime files');
  }
  console.log('HTTP /api/ready passed: 200/503, exact sanitized bodies, repeated requests without runtime changes.');
 } finally {await stop(api);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
