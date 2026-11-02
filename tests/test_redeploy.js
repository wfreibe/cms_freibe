'use strict';
const assert=require('assert/strict');
const {fs,path,crypto,root,baseEnv,run,php,temp,hash,snapshot,extract}=require('./helpers');
const dir=temp(), server=path.join(dir,'server'), zip=path.resolve(process.argv[2] || path.join(root,'dist-packages/cms_sfreibe-deploy.zip'));
try{
 fs.mkdirSync(path.join(server,'config'),{recursive:true});fs.mkdirSync(path.join(server,'data'),{recursive:true});
 fs.mkdirSync(path.join(server,'data/sessions'),{recursive:true});fs.mkdirSync(path.join(server,'backups'),{recursive:true});
 const other=path.join(dir,'second_installation');fs.mkdirSync(other);
 fs.writeFileSync(path.join(other,'cms_config.php'),crypto.randomBytes(90));
 php("$d=new PDO('sqlite:'.getenv('TARGET'));$d->exec('CREATE TABLE sentinel(value TEXT)');$d->prepare('INSERT INTO sentinel VALUES (?)')->execute([bin2hex(random_bytes(32))]);",{TARGET:path.join(other,'content.sqlite')});
 const otherBefore=snapshot(other);
 const config=path.join(server,'config/cms_config.php');
 fs.writeFileSync(config,"<?php return ['db_path'=>dirname(__DIR__).'/data/content.sqlite','backup_dir'=>dirname(__DIR__).'/backups','sentinel'=>'"+crypto.randomBytes(16).toString('hex')+"'];");
 const old=path.join(dir,'old');fs.mkdirSync(old);
 for(const f of fs.readdirSync(path.join(root,'migrations')).filter(f=>/^00[1-3]_/.test(f)))fs.copyFileSync(path.join(root,'migrations',f),path.join(old,f));
 const db=path.join(server,'data/content.sqlite'),env={...baseEnv,CMS_CONFIG_PATH:config,CMS_MIGRATIONS_DIR:old};
 run('php',['bin/migrate.php'],{env});
 php("$d=new PDO('sqlite:'.getenv('DB'));$d->exec(file_get_contents(getenv('SEED')));",{DB:db,SEED:path.join(root,'seeds/initial_content.sql')});
 const permanent='Permanent-'+crypto.randomBytes(20).toString('hex');
 php("$d=new PDO('sqlite:'.getenv('DB'));$d->exec(file_get_contents(getenv('MIG')));$d->prepare('INSERT INTO admin_credentials(id,username,password_hash,must_change_password,credential_version) VALUES(1,?,?,0,2)')->execute(['admin',password_hash(getenv('PASS'),PASSWORD_DEFAULT)]);$d->prepare('INSERT INTO contact_messages(name,email,message) VALUES(?,?,?)')->execute(['Synthetic','synthetic@example.invalid','Synthetic legacy message']);",{DB:db,MIG:path.join(root,'migrations/008_admin_credentials.sql'),PASS:permanent});
 const marker=crypto.randomBytes(16).toString('hex');
 php("$d=new PDO('sqlite:'.getenv('DB'));$d->prepare(\"UPDATE sections SET title=?,content=?,updated_at='2001-01-01',is_active=0 WHERE id='home' AND lang='de'\")->execute([getenv('MARKER'),getenv('MARKER')]);$d->prepare(\"UPDATE section_accordions SET content=?,updated_at='2002-01-01' WHERE id='acc_ablauf'\")->execute([getenv('MARKER')]);$d->exec(\"DELETE FROM sections WHERE id='anfahrt' AND lang='en'\");",{DB:db,MARKER:marker});
 const persistentRecordsHash=()=>php("$d=new PDO('sqlite:'.getenv('DB'));$a=$d->query('SELECT * FROM admin_credentials ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);$m=$d->query('SELECT * FROM contact_messages ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);echo hash('sha256',json_encode(['admin'=>$a,'messages'=>$m]));",{DB:db});
 const recordsBefore=persistentRecordsHash();
 const contentHash=()=>php("$d=new PDO('sqlite:'.getenv('DB'));$s=$d->query('SELECT id,lang,sort_order,nav_label,title,subtitle,content,image_url,bg_color,bg_image_url,contact_info,is_active,created_at,updated_at FROM sections ORDER BY id,lang')->fetchAll(PDO::FETCH_ASSOC);$a=$d->query('SELECT id,section_id,lang,sort_order,title,content,is_active,created_at,updated_at FROM section_accordions ORDER BY id,lang')->fetchAll(PDO::FETCH_ASSOC);echo hash('sha256',json_encode([$s,$a]));",{DB:db});
 const contentBefore=contentHash();
 const runtime=path.join(server,'data/runtime.bin');fs.writeFileSync(runtime,crypto.randomBytes(128));
 fs.mkdirSync(path.join(server,'uploads'));
 const extras=['uploads/synthetic.bin','data/other.sqlite-wal','data/other.sqlite-shm','data/sessions/sess_synthetic','backups/existing.bin','config/local-note.bin'];
 for(const file of extras)fs.writeFileSync(path.join(server,file),crypto.randomBytes(64));
 const extraHashes=Object.fromEntries(extras.map(file=>[file,hash(path.join(server,file))]));
 const before=[hash(config),hash(db),hash(runtime)];
 const persistent=['config','data','backups','uploads'].map(d=>({dir:path.join(server,d),files:snapshot(path.join(server,d))}));
 if(process.platform==='win32'){
  // Validate every package entry, but never write PHP application copies to Windows TEMP.
  require('../scripts/release_audit').audit(zip,'deploy');
  for(const {name,data} of require('../scripts/isolation_guard').zipEntries(fs.readFileSync(zip))){
   if(name.endsWith('/') || /\.php$/i.test(name))continue;
   const target=path.resolve(dir,name);if(!target.startsWith(path.resolve(dir)+path.sep))throw new Error('Unsafe ZIP path');
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);
  }
  console.log('Windows redeploy: audited archive; PHP application remains in repository; isolated runtime only.');
 }else extract(zip,dir);
 const codeRoot=process.platform==='win32'?root:server;
 for(const {dir:directory,files} of persistent){const after=snapshot(directory);for(const [name,digest] of Object.entries(files))assert.equal(after[name],digest,'ZIP overlay changed persistent file: '+name);}
 assert.deepEqual(snapshot(other),otherBefore,'Second installation changed during overlay');
 delete env.CMS_MIGRATIONS_DIR;
 run('php',[path.join(codeRoot,'bin/migrate.php')],{env,stdio:'inherit'});
 assert.equal(persistentRecordsHash(),recordsBefore,'Migration changed admin credentials or legacy contact data');
 assert.equal(contentHash(),contentBefore,'Migration changed existing content fields');
 const check=()=>JSON.parse(php("$d=new PDO('sqlite:'.getenv('DB'));echo json_encode(['sections'=>$d->query('SELECT * FROM sections ORDER BY id,lang')->fetchAll(PDO::FETCH_ASSOC),'accordions'=>$d->query('SELECT * FROM section_accordions ORDER BY id,lang')->fetchAll(PDO::FETCH_ASSOC),'admin'=>$d->query('SELECT * FROM admin_credentials')->fetchAll(PDO::FETCH_ASSOC),'messages'=>$d->query('SELECT * FROM contact_messages')->fetchAll(PDO::FETCH_ASSOC),'integrity'=>$d->query('PRAGMA integrity_check')->fetchColumn(),'fk'=>$d->query('PRAGMA foreign_key_check')->fetchAll()]);",{DB:db}));
 const state=check();assert.equal(state.sections.length,13);assert.equal(state.accordions.length,6);
 assert.equal(state.admin.length,1);assert.equal(state.admin[0].credential_version,2);assert.equal(state.admin[0].must_change_password,0);assert.equal(state.messages.length,1);
 assert.equal(php("require getenv('ROOT').'/lib/Database.php';require getenv('ROOT').'/lib/Auth.php';echo Auth::login('admin',getenv('PASS'))['status'];",{CMS_CONFIG_PATH:config,ROOT:codeRoot,PASS:permanent}),'200','Permanent admin login failed after redeploy');
 const home=state.sections.find(s=>s.id==='home'&&s.lang==='de');assert.equal(home.title,marker);assert.equal(home.content,marker);assert.equal(home.updated_at,'2001-01-01');assert.equal(home.is_published,0);
 const acc=state.accordions.find(a=>a.id==='acc_ablauf');assert.equal(acc.content,marker);assert.equal(acc.updated_at,'2002-01-01');
 assert(state.sections.filter(s=>['impressum','datenschutz'].includes(s.id)).every(s=>s.is_published===0));
 assert.equal(state.integrity,'ok');assert.deepEqual(state.fk,[]);
 assert(fs.readdirSync(path.join(server,'backups')).some(f=>f.startsWith('cms_sfreibe_pre_migration_')));
 run('php',[path.join(codeRoot,'bin/migrate.php')],{env});assert.deepEqual(check(),state);
 assert.deepEqual(snapshot(other),otherBefore,'Second installation changed during migration');
 assert.throws(()=>run('php',[path.join(codeRoot,'bin/migrate.php'),'--seed'],{env}));assert.deepEqual(check(),state);
 assert.equal(hash(config),before[0]);assert.equal(hash(runtime),before[2]);
 for(const [file,digest] of Object.entries(extraHashes))assert.equal(hash(path.join(server,file)),digest,'Persistent extra file changed: '+file);
 console.log('ZIP redeploy passed: all legacy content fields and admin records hash-identical, 13 sections/6 accordions, password hash/change status preserved, timestamps, drafts, repeat migration and rejected seed option; integrity=ok; FK=0.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
