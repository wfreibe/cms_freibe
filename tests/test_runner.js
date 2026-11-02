'use strict';
const assert=require('assert/strict');
const {fs,path,crypto,root,baseEnv,run,php,temp,snapshot,server,stop}=require('./helpers');
(async()=>{
 if(process.env.REQUIRE_HTTP_TESTS==='1' && process.platform==='win32')throw new Error('Required HTTP tests cannot be skipped on Windows.');
 const dir=temp();let api;
 const runtime=['data','backups','config'];
 const before=runtime.map(d=>snapshot(path.join(root,d)));
 const other=path.join(dir,String.fromCodePoint(99,109,115,95,109,98,117,101,104,108,101,114));
 fs.mkdirSync(other);
 fs.writeFileSync(path.join(other,'cms_config.php'),crypto.randomBytes(64));
 fs.writeFileSync(path.join(other,'sentinel.bin'),crypto.randomBytes(256));
 php("$d=new PDO('sqlite:'.getenv('TARGET'));$d->exec('CREATE TABLE sentinel(value TEXT)');$d->prepare('INSERT INTO sentinel VALUES (?)')->execute([bin2hex(random_bytes(32))]);",{TARGET:path.join(other,'content.sqlite')});
 const otherBefore=snapshot(other);
 const config=path.join(dir,'cms_config.php');fs.writeFileSync(config,"<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__.'/sessions','trusted_proxies'=>['127.0.0.1']];");
 const password=crypto.randomBytes(24).toString('hex');
 const env={...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:path.join(dir,'content.sqlite'),CMS_BACKUP_DIR:path.join(dir,'backups'),CMS_ADMIN_USER:'synthetic_admin',CMS_ADMIN_PASSWORD:password};
 try {
  run('node',['tests/test_readiness.js'],{stdio:'inherit'});
  run('node',['tests/test_api_routing.js'],{stdio:'inherit'});
  run('node',['tests/test_readiness_wal.js'],{stdio:'inherit'});
  run('node',['tests/test_admin_cli.js'],{stdio:'inherit'});
  run('node',['tests/test_migrations.js'],{stdio:'inherit'});
  run('node',['tests/test_french.js'],{stdio:'inherit'});
  for(const test of ['tests/test_isolation_guard.js','tests/test_repository_audit.js','tests/test_git_release_gate.js','tests/test_dompurify.js','tests/test_frontend_state.js'])run('node',[test],{stdio:'inherit'});
  if(process.platform!=='win32')run('node',['tests/test_admin_bootstrap.js'],{stdio:'inherit'});
  else console.log('SKIP Windows: HTTP admin bootstrap; mandatory in Ubuntu release CI.');
  run('php',['bin/migrate.php'],{env,stdio:'inherit'});
  run('php',['bin/seed.php','--confirm-seed'],{env:{...env,CMS_ENV:'test'}});
  php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->prepare('INSERT INTO admin_credentials(id,username,password_hash,must_change_password,credential_version) VALUES(1,?,?,0,1)')->execute([getenv('CMS_ADMIN_USER'),password_hash(getenv('CMS_ADMIN_PASSWORD'),PASSWORD_DEFAULT)]);",env);
  for(const test of ['tests/test_database.php','tests/test_xss.php','tests/test_sessions.php'])run('php',[test],{env,stdio:'inherit'});
  run('node',['tests/test_maintenance.js'],{stdio:'inherit'});
  run('php',['tests/test_auth_fail_closed.php'],{env:baseEnv,stdio:'inherit'});
  run('php',['tests/test_permissions.php'],{env:baseEnv,stdio:'inherit'});
  run('node',['tests/test_legal_redaction.js'],{stdio:'inherit'});
  if(process.platform!=='win32'){
  run('node',['tests/test_readiness_http.js'],{stdio:'inherit'});
  api=await server(path.join(root,'frontend/public/api/api.php'),env);
  run('php',['tests/test_api_suite.php'],{env:{...env,CMS_TEST_PORT:String(api.port)},stdio:'inherit'});
  await stop(api);api=null;
  run('node',['tests/test_security_regressions.js'],{stdio:'inherit'});
  }else console.log('SKIP Windows: HTTP API suite and security regressions; mandatory in Ubuntu release CI.');
 } finally {
  await stop(api);
  assert.deepEqual(snapshot(other),otherBefore,'Second installation changed');
  runtime.forEach((d,i)=>assert.deepEqual(snapshot(path.join(root,d)),before[i],'Runtime changed: '+d));
  fs.rmSync(dir,{recursive:true,force:true});
 }
 console.log('CORE TESTS PASSED; second installation DB/config/sentinels and project runtime byte-identical.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
