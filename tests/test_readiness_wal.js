'use strict';
const assert=require('assert/strict');
const {spawn}=require('child_process');
const {once}=require('events');
const {fs,path,root,baseEnv,run,php,temp,snapshot}=require('./helpers');
(async()=>{
 const dir=temp(),config=path.join(dir,'config.php');let writer;
 const env={...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:path.join(dir,'content.sqlite'),CMS_BACKUP_DIR:path.join(dir,'backups')};
 try {
  fs.writeFileSync(config,"<?php return ['session_save_path'=>__DIR__.'/sessions'];");
  fs.mkdirSync(path.join(dir,'sessions'));fs.mkdirSync(path.join(dir,'backups'));
  run('php',['bin/migrate.php'],{env});
  for(const pending of [false,true]) {
   const mutation=pending?"$d->exec('DELETE FROM schema_migrations WHERE version=8');":"$d->query('SELECT * FROM schema_migrations')->fetchAll();";
   writer=spawn('php',['-r',"$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec('PRAGMA journal_mode=WAL');"+mutation+"echo 'ready';fflush(STDOUT);fgets(STDIN);"],{cwd:root,env,stdio:['pipe','pipe','pipe']});
   const [ready]=await once(writer.stdout,'data',{signal:AbortSignal.timeout(5000)});
   assert.equal(ready.toString(),'ready');
   const before=snapshot(dir);
   for(let repeat=0;repeat<2;repeat++) {
    assert.equal(php("require getcwd().'/lib/Readiness.php';echo Readiness::status();",env),pending?'503':'200');
    assert.deepEqual(snapshot(dir),before,'Readiness modified live WAL or SHM files');
   }
   const exited=once(writer,'exit');writer.stdin.end('\n');await exited;writer=null;
  }
  console.log('Live WAL readiness passed: 200 for current schema, 503 for pending migration committed only in WAL; database, WAL and SHM remain byte-identical.');
 } finally {
  if(writer && writer.exitCode===null){const exited=once(writer,'exit');writer.kill();await exited;}
  fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
