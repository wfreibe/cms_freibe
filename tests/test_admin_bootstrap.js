'use strict';
const assert=require('assert/strict');
const {fs,path,crypto,root,baseEnv,run,php,temp,server,stop}=require('./helpers');

(async()=>{
 const dir=temp();let api;
 const db=path.join(dir,'content.sqlite'),config=path.join(dir,'cms_config.php');
 fs.writeFileSync(config,"<?php return ['db_path'=>__DIR__.'/content.sqlite','backup_dir'=>__DIR__.'/backups','session_save_path'=>__DIR__.'/sessions','cookie_secure'=>false];");
 const env={...baseEnv,CMS_CONFIG_PATH:config};
 const permanent='Permanent-'+crypto.randomBytes(20).toString('hex');
 const fail=(args)=>{try{run('php',args,{env});return false;}catch{return true;}};
 try{
  run('php',['bin/migrate.php'],{env});
  const initial=run('php',['bin/provision_admin.php'],{env}).toString().trim();
  const oneTime=initial.match(/^One-time admin password: ([A-Za-z0-9_-]{32})$/)?.[1];
  assert(oneTime,'One-time password was not returned once in the expected format');
  assert(fail(['bin/provision_admin.php']),'Accidental reprovisioning was accepted');
  api=await server(path.join(root,'frontend/public/api/api.php'),env);
  let cookie='';
  async function request(route,method='GET',body,csrf='',sendCookie=true){
   const headers={'Content-Type':'application/json'};
   if(sendCookie&&cookie)headers.Cookie=cookie;
   if(csrf)headers['X-CSRF-Token']=csrf;
   const r=await fetch(api.url+'/api/'+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
   const setCookie=r.headers.get('set-cookie');
   if(setCookie)cookie=setCookie.split(';')[0];
   return {status:r.status,data:await r.json(),setCookie};
  }
  let result=await request('auth/login','POST',{username:'admin',password:oneTime});
  assert.equal(result.status,200);assert.equal(result.data.authenticated,true);assert.equal(result.data.passwordChangeRequired,true);
  const restrictedCookie=cookie,csrf=result.data.csrf_token;
  result=await request('auth/session');assert.equal(result.data.authenticated,true);assert.equal(result.data.passwordChangeRequired,true);
  for(const [route,method,body] of [['sections?all=true','GET',undefined],['sections','POST',{id:'denied',nav_label:'Denied',title:'Denied'}],['sections/home','PUT',{lang:'de',title:'Denied'}],['sections/home/toggle','PATCH',{lang:'de',is_published:1}],['sections/home','DELETE',undefined]]){
   result=await request(route,method,body,csrf);assert.equal(result.status,403,route);assert.equal(result.data.error,'PASSWORD_CHANGE_REQUIRED',route);
  }
  result=await request('auth/change-password','POST',{newPassword:permanent,confirmPassword:permanent});assert.equal(result.status,403,'Missing CSRF accepted');
  result=await request('auth/change-password','POST',{newPassword:oneTime,confirmPassword:oneTime},csrf);assert.equal(result.status,400,'Reused one-time password accepted');
  result=await request('auth/change-password','POST',{newPassword:permanent,confirmPassword:permanent},csrf);
  assert.equal(result.status,200);assert.equal(result.data.passwordChangeRequired,false);assert.notEqual(cookie,restrictedCookie,'Session ID not rotated');
  const permanentCookie=cookie;
  result=await request('auth/session');assert.equal(result.data.authenticated,true);assert.equal(result.data.passwordChangeRequired,false);
  cookie=restrictedCookie;result=await request('auth/session');assert.equal(result.data.authenticated,false,'Old restricted session survived password change');
  cookie='';result=await request('auth/login','POST',{username:'admin',password:oneTime});assert.equal(result.status,401,'One-time password still works');
  result=await request('auth/login','POST',{username:'admin',password:permanent});assert.equal(result.status,200);assert.equal(result.data.passwordChangeRequired,false);
  const state=JSON.parse(php("$d=new PDO('sqlite:'.getenv('DB'));$r=$d->query('SELECT password_hash,must_change_password,credential_version,password_changed_at FROM admin_credentials WHERE id=1')->fetch(PDO::FETCH_ASSOC);echo json_encode(['hash_ok'=>password_verify(getenv('PASS'),$r['password_hash']),'temporary_ok'=>password_verify(getenv('TEMP'),$r['password_hash']),'must_change'=>$r['must_change_password'],'version'=>$r['credential_version'],'changed'=>!empty($r['password_changed_at'])]);",{DB:db,PASS:permanent,TEMP:oneTime}));
  assert.deepEqual(state,{hash_ok:true,temporary_ok:false,must_change:0,version:2,changed:true});
  assert(fail(['bin/reset_admin_password.php']),'Reset without confirmation was accepted');
  const reset=run('php',['bin/reset_admin_password.php','--confirm-reset'],{env}).toString().trim().match(/^One-time admin password: ([A-Za-z0-9_-]{32})$/)?.[1];
  assert(reset,'Reset password output invalid');
  cookie=permanentCookie;result=await request('auth/session');assert.equal(result.data.authenticated,false,'Old session survived reset');
  cookie='';result=await request('auth/login','POST',{username:'admin',password:permanent});assert.equal(result.status,401,'Old permanent password survived reset');
  result=await request('auth/login','POST',{username:'admin',password:reset});assert.equal(result.status,200);assert.equal(result.data.passwordChangeRequired,true);
  const after=JSON.parse(php("$d=new PDO('sqlite:'.getenv('DB'));$r=$d->query('SELECT password_hash,must_change_password,credential_version FROM admin_credentials WHERE id=1')->fetch(PDO::FETCH_ASSOC);echo json_encode(['reset_ok'=>password_verify(getenv('PASS'),$r['password_hash']),'must_change'=>$r['must_change_password'],'version'=>$r['credential_version']]);",{DB:db,PASS:reset}));
  assert.deepEqual(after,{reset_ok:true,must_change:1,version:3});
  const resetCsrf=result.data.csrf_token;
  for(let i=0;i<5;i++){
   const invalid=await request('auth/change-password','POST',{newPassword:'short',confirmPassword:'short'},resetCsrf);
   assert.equal(invalid.status,400,'Invalid password attempt not rejected');
  }
  const blocked=await request('auth/change-password','POST',{newPassword:permanent,confirmPassword:permanent},resetCsrf);
  assert.equal(blocked.status,429,'Password-change rate limit not enforced');
  for(let i=0;i<4;i++)run('php',['bin/reset_admin_password.php','--confirm-reset'],{env});
  assert(fail(['bin/reset_admin_password.php','--confirm-reset']),'Reset rate limit not enforced');
  console.log('Admin bootstrap passed: one-time login, restricted endpoints, CSRF, password rotation, stale sessions, reset/reprovision guards and rate limits.');
 }finally{await stop(api);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
