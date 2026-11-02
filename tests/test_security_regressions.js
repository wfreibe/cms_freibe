'use strict';
const assert=require('assert/strict');
const {fs,path,crypto,root,baseEnv,run,php,temp,server,stop}=require('./helpers');
(async()=>{
 const dir=temp();let api;
 const config=path.join(dir,'cms_config.php'),db=path.join(dir,'content.sqlite');
 const password=crypto.randomBytes(24).toString('hex');
 const env={...baseEnv,CMS_CONFIG_PATH:config,CMS_DB_PATH:db,CMS_BACKUP_DIR:path.join(dir,'backups')};
 fs.writeFileSync(config,"<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__.'/sessions'];");
 try{
  run('php',['bin/migrate.php'],{env});
  run('php',['bin/seed.php','--confirm-seed'],{env:{...env,CMS_ENV:'test'}});
  php("$d=new PDO('sqlite:'.getenv('DB'));$d->prepare('INSERT INTO admin_credentials(id,username,password_hash,must_change_password,credential_version) VALUES(1,?,?,0,1)')->execute(['test',password_hash(getenv('PASS'),PASSWORD_DEFAULT)]);",{DB:db,PASS:password});
  api=await server(path.join(root,'frontend/public/api/api.php'),env);
  let cookie='',csrf='';
  async function request(route,method='GET',body,authenticated=true){
   const r=await fetch(api.url+'/api/'+route,{method,headers:{'Content-Type':'application/json',...(authenticated?{'Cookie':cookie,'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
   const setCookie=r.headers.get('set-cookie');if(authenticated&&setCookie)cookie=setCookie.split(';')[0];
   const data=await r.json();return {r,data,setCookie};
  }
  const session=await request('auth/session');assert(session.setCookie.includes('CMS_SFREIBE_SESSION='));assert(/HttpOnly/i.test(session.setCookie));assert(/SameSite=Strict/i.test(session.setCookie));
  const oldCookie=cookie;
  const login=await request('auth/login','POST',{username:'test',password});assert.equal(login.r.status,200);csrf=login.data.csrf_token;assert.notEqual(cookie,oldCookie);
  const english=await request('sections','POST',{id:'english-only',lang:'en',nav_label:'English',title:'English',is_published:1});assert.equal(english.r.status,201);assert.equal(english.data.section.lang,'en');
  assert.equal((await request('sections/english-only?lang=de','GET',undefined,false)).r.status,404);
  let result=await request('sections','POST',{id:'draft-test',nav_label:'Draft',title:'Draft',content:'<p>Test</p>'});assert.equal(result.r.status,201);assert.equal(result.data.section.is_published,0);
  result=await request('sections/draft-test','PUT',{lang:'de',title:'Changed'});assert.equal(result.r.status,200);assert.equal(result.data.section.is_published,0);assert.equal(result.data.section.content,'<p>Test</p>');
  assert.equal((await request('sections/draft-test?lang=de','GET',undefined,false)).r.status,404);
  result=await request('sections/draft-test/toggle','PATCH',{lang:'de',is_published:1});assert.equal(result.r.status,200);
  assert.equal((await request('sections/draft-test?lang=en','GET',undefined,false)).r.status,404);
  assert.equal((await request('sections/draft-test?lang=de','GET',undefined,false)).r.status,200);
  result=await request('sections/impressum','PUT',{lang:'de',title:'Reviewed synthetic notice',is_published:1});assert.equal(result.r.status,200);
  assert.equal((await request('legal/impressum?lang=de','GET',undefined,false)).r.status,200);
  assert.equal((await request('legal/impressum?lang=en','GET',undefined,false)).r.status,404);
  for(const contact_info of [{extra:'x'},{email:'invalid'},{phone:'<b>x</b>'},{web:'javascript:alert(1)'},{note:'a'.repeat(1001)}])assert.equal((await request('sections/draft-test','PUT',{lang:'de',contact_info})).r.status,400);
  assert.equal((await request('sections/draft-test','PUT',{lang:'de',contact_info:{email:'test@example.com',phone:'+49 123 456789',web:'https://example.com',company:'Synthetic'}})).r.status,200);
  await request('sections/draft-test','PUT',{lang:'de',accordions:[{id:'draft-acc',title:'Draft',content:'<p>Test</p>',is_published:0}]});
  result=await request('sections/draft-test','PUT',{lang:'de',accordions:[{id:'draft-acc',title:'Changed',content:'<p>Changed</p>'}]});assert.equal(result.data.section.accordions[0].is_published,0);
  for (const route of ['contact','messages']) {
   const retired=await fetch(api.url+'/api/'+route,{method:'POST',headers:{'Content-Type':'text/plain'},body:'not json'});
   assert.equal(retired.status,404,route);
  }
  const oversized=await fetch(api.url+'/api/sections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:'A'.repeat(1050000)})});
  assert.equal(oversized.status,413,'Oversized JSON request must be rejected');
  const change=(sql)=>php("$d=new PDO('sqlite:'.getenv('DB'));$d->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$d->exec(getenv('SQL'));",{DB:db,SQL:sql});
  change("CREATE TRIGGER deny_attempt BEFORE INSERT ON login_attempts BEGIN SELECT RAISE(ABORT, 'unavailable'); END");
  let denied=await request('auth/login','POST',{username:'test',password:'invalid'},false);
  assert.equal(denied.r.status,503);assert.equal(denied.setCookie,null);assert.match(denied.r.headers.get('retry-after')||'',/^\d+$/);
  assert.equal(denied.data.error,'Sicherheitsprüfung vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.');
  change('DROP TRIGGER deny_attempt');
  change('DROP TABLE login_attempts');
  denied=await request('auth/login','POST',{username:'test',password},false);
  assert.equal(denied.r.status,503);assert.equal(denied.setCookie,null);
  change('CREATE TABLE login_attempts (id INTEGER PRIMARY KEY, ip TEXT NOT NULL, username TEXT NOT NULL, attempted_at INTEGER NOT NULL)');
  // Real response from API with dependency failure: copied library, intentionally no Composer vendor.
  await stop(api);api=null;
  const lib=path.join(dir,'isolated/lib');fs.mkdirSync(lib,{recursive:true});for(const f of fs.readdirSync(path.join(root,'lib')))fs.copyFileSync(path.join(root,'lib',f),path.join(lib,f));
  api=await server(path.join(root,'frontend/public/api/api.php'),{...env,CMS_LIB_PATH:lib});cookie='';csrf='';
  const l=await request('auth/login','POST',{username:'test',password});assert.equal(l.r.status,200);csrf=l.data.csrf_token;
  result=await request('sections/draft-test','PUT',{lang:'de',content:'<script>RAW_SENTINEL</script>'});assert.equal(result.r.status,500);assert.deepEqual(result.data,{error:'Internal server error.'});
  await stop(api);api=null;
  api=await server(path.join(root,'frontend/public/api/api.php'),env);
  fs.renameSync(config,config+'.unavailable');
  result=await request('sections');assert.equal(result.r.status,500);assert.deepEqual(result.data,{error:'Internal server error.'});
  console.log('Security regressions passed: sessions, drafts, retired routes, rate-limit 503 without cookie, sanitizer/config failures.');
 }finally{await stop(api);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
