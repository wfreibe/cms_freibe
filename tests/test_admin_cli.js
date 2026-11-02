'use strict';
const assert=require('assert/strict');
const {fs,path,baseEnv,run,php,temp,hash}=require('./helpers');
const dir=temp(),config=path.join(dir,'config.php'),db=path.join(dir,'content.sqlite');
const env={...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:db,CMS_BACKUP_DIR:path.join(dir,'backups')};
try{
 fs.writeFileSync(config,'<?php return [];');
 run('php',['bin/migrate.php'],{env});
 const output=run('php',['bin/provision_admin.php'],{env}).toString().trim();
 const password=output.match(/^One-time admin password: ([A-Za-z0-9_-]{32})$/)?.[1];
 assert(password,'Expected one-time credential format');
 assert.equal(php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$r=$d->query('SELECT * FROM admin_credentials')->fetch(PDO::FETCH_ASSOC);echo (password_verify(getenv('PASS'),$r['password_hash']) && (int)$r['must_change_password']===1)?'ok':'failed';",{...env,PASS:password}),'ok');
 const digest=()=>php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));echo hash('sha256',json_encode($d->query('SELECT * FROM admin_credentials')->fetchAll(PDO::FETCH_ASSOC)));",env);
 const before=digest();
 php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec('PRAGMA journal_mode=DELETE');",env);
 const databaseBefore=hash(db);
 for(const args of [[],['--recover']]){
  assert.throws(()=>run('php',['bin/provision_admin.php',...args],{env}));
  assert.equal(digest(),before,'Bootstrap changed an existing admin');
  assert.equal(hash(db),databaseBefore,'Rejected bootstrap changed database bytes or journal mode');
 }
 assert.throws(()=>run('php',['bin/reset_admin_password.php'],{env}));
 assert.equal(digest(),before,'Unconfirmed reset changed credentials');
 const reset=run('php',['bin/reset_admin_password.php','--confirm-reset'],{env}).toString().trim().match(/^One-time admin password: ([A-Za-z0-9_-]{32})$/)?.[1];
 assert(reset);assert.notEqual(reset,password);
 assert.equal(php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$r=$d->query('SELECT * FROM admin_credentials')->fetch(PDO::FETCH_ASSOC);echo (password_verify(getenv('PASS'),$r['password_hash']) && !password_verify(getenv('OLD'),$r['password_hash']) && (int)$r['must_change_password']===1 && (int)$r['credential_version']===2)?'ok':'failed';",{...env,PASS:reset,OLD:password}),'ok');
 const after=digest();assert.throws(()=>run('php',['bin/provision_admin.php'],{env}));assert.equal(digest(),after);
 console.log('Admin CLI passed: first account, one-time password/hash, forced change, immutable repeated bootstrap, confirmed separate reset and old password invalidation.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
