'use strict';
const assert = require('assert/strict');
const {fs,path,root,baseEnv,run,php,temp,snapshot} = require('./helpers');
const dir = temp(), db = path.join(dir,'content.sqlite'), config = path.join(dir,'config.php');
const env = {...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:db,CMS_BACKUP_DIR:path.join(dir,'backups')};
const source = "<?php return ['session_save_path'=>__DIR__.'/sessions','secret'=>'SYNTHETIC_NOT_PUBLIC'];";
const status = (overrides={}) => php("require getcwd().'/lib/Readiness.php';echo Readiness::status();",{...env,...overrides});
try {
 fs.writeFileSync(config,source);
 fs.mkdirSync(path.join(dir,'sessions'));fs.mkdirSync(path.join(dir,'backups'));
 assert.equal(status(),'503','Missing database must fail closed');
 assert(!fs.existsSync(db),'Readiness created a database');
 run('php',['bin/migrate.php'],{env});
 const before = snapshot(dir);
 assert.equal(status(),'200');assert.equal(status(),'200');
 assert.deepEqual(snapshot(dir),before,'Readiness modified runtime data');
 php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec('PRAGMA journal_mode=WAL');",env);
 assert(!fs.existsSync(db+'-wal') && !fs.existsSync(db+'-shm'),'Expected checkpointed idle WAL database');
 const idleWal=snapshot(dir);
 assert.equal(status(),'200');assert.equal(status(),'200');
 assert.deepEqual(snapshot(dir),idleWal,'Idle WAL readiness created sidecars or modified data');
 assert.equal(status({CMS_CONFIG_PATH:path.join(dir,'missing.php')}),'503');
 assert.equal(status({CMS_BACKUP_DIR:path.join(dir,'missing-directory')}),'503');
 fs.writeFileSync(config,'<?php return "invalid";');assert.equal(status(),'503');
 fs.writeFileSync(config,source);
 php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec('DELETE FROM schema_migrations WHERE version=8');",env);
 const pending = snapshot(dir);assert.equal(status(),'503');assert.deepEqual(snapshot(dir),pending);
 php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec('INSERT INTO schema_migrations(version) VALUES(8)');",env);
 const api = "register_shutdown_function(function(){fwrite(STDERR,(string)http_response_code());});$_SERVER['REQUEST_METHOD']='GET';$_SERVER['REQUEST_URI']='/api/ready';require getcwd().'/frontend/public/api/api.php';";
 const {spawnSync} = require('child_process');
 for(const [extra,expected] of [[{},200],[{CMS_CONFIG_PATH:path.join(dir,'missing.php')},503]]) {
  const beforeRequest=snapshot(dir);
  const response=spawnSync('php',['-r',api],{cwd:root,env:{...env,...extra},encoding:'utf8',timeout:5000});
  assert.equal(response.status,0);assert.equal(response.stderr,String(expected));
  assert.deepEqual(JSON.parse(response.stdout),{ready:expected===200});
  assert.deepEqual(snapshot(dir),beforeRequest,'API readiness modified runtime data');
 }
 const noIni=JSON.parse(run('php',['-n','-r',"require getcwd().'/lib/Readiness.php';echo json_encode(['extensions'=>count(array_filter(['pdo_sqlite','dom','mbstring','session'],'extension_loaded'))===4,'status'=>Readiness::status()]);"],{env}).toString());
 assert.equal(noIni.status,noIni.extensions?200:503,'Static extensions remain available without php.ini');
 assert.equal(run('php',['-n','-d','disable_functions=extension_loaded','-r',"require getcwd().'/lib/Readiness.php';echo Readiness::status();"],{env}).toString(),'503','Unavailable extension detection must fail closed');
 fs.writeFileSync(db,'not a database');assert.equal(status(),'503');
 console.log('Readiness passed: 200/503, missing extensions/config/runtime/database/migrations, invalid database, repeated checks and unchanged runtime; API executed in-process without HTTP server.');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
