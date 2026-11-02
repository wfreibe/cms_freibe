'use strict';
const assert=require('assert/strict');
const {fs,path,baseEnv,run,php,temp,hash}=require('./helpers');
const dir=temp(),config=path.join(dir,'config.php');
fs.writeFileSync(config,'<?php return [];');
try {
 for(const existing of [false,true]) {
  const db=path.join(dir,existing?'existing.sqlite':'new.sqlite');
  if(existing)fs.writeFileSync(db,'');
  const env={...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:db,CMS_BACKUP_DIR:path.join(dir,'backups'),CMS_ENV:'test'};
  const state=()=>php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$all=[];foreach(['sections','section_accordions','admin_credentials','contact_messages','login_attempts'] as $t)$all[$t]=$d->query('SELECT * FROM '.$t)->fetchAll(PDO::FETCH_ASSOC);echo json_encode($all);",env);
  run('php',['bin/migrate.php'],{env});
  assert(Object.values(JSON.parse(state())).every(rows=>rows.length===0));
  const empty=hash(db);run('php',['bin/migrate.php'],{env});assert.equal(hash(db),empty);
  for(const args of [['--seed'],['--prune-orphans'],['--unknown']]) {
   assert.throws(()=>run('php',['bin/migrate.php',...args],{env}));assert.equal(hash(db),empty);
  }
  for(const [args,extra] of [[[],{}],[['--confirm-seed'],{CMS_ENV:'production'}],[['--confirm-seed'],{CMS_ENV:''}],[['--confirm-seed'],{CMS_DB_PATH:''}]]) {
   assert.throws(()=>run('php',['bin/seed.php',...args],{env:{...env,...extra}}));assert.equal(hash(db),empty);
  }
  run('php',['bin/seed.php','--confirm-seed'],{env});
  assert.equal(JSON.parse(state()).sections.length,14);
  run('php',['bin/provision_admin.php'],{env}); // Never print the generated credential.
  const before=state();
  assert.throws(()=>run('php',['bin/seed.php','--confirm-seed'],{env}));assert.equal(state(),before);
  run('php',['bin/migrate.php'],{env});assert.equal(state(),before);
  php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec('DELETE FROM schema_migrations WHERE version IN (2,6,7,8)');",env);
  run('php',['bin/migrate.php'],{env});assert.equal(state(),before,'Pending schema migrations changed application records');
 }
 const orphanDb=path.join(dir,'orphans.sqlite');
 const orphanEnv={...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:orphanDb,CMS_BACKUP_DIR:path.join(dir,'backups')};
 php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec(file_get_contents(getcwd().'/migrations/001_initial_schema.sql'));$d->exec(\"INSERT INTO schema_migrations(version) VALUES(1); INSERT INTO section_accordions(id,section_id,lang,title,content) VALUES('orphan','missing','de','Synthetic','Preserve this record')\");",orphanEnv);
 const orphanBefore=hash(orphanDb);
 assert.throws(()=>run('php',['bin/migrate.php'],{env:orphanEnv}));
 assert.equal(hash(orphanDb),orphanBefore,'Failed migration removed an orphan or changed schema');
 console.log('Migration/seed regressions passed: absent and empty DB, no implicit content/admin, repeat byte identity, invalid options, seed environment/confirmation guards, existing records and credentials preserved, orphan migration aborted without changes.');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
