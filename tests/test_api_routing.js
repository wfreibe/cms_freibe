'use strict';
const assert=require('assert/strict');
const {spawnSync}=require('child_process');
const {fs,path,root,baseEnv,run,temp,server,stop}=require('./helpers');
(async()=>{
 const dir=temp();let api;
 const env={...baseEnv,CMS_CONFIG_PATH:path.join(dir,'config.php'),CMS_DB_PATH:path.join(dir,'content.sqlite'),CMS_BACKUP_DIR:path.join(dir,'backups')};
 const cases=[
  ['/api/ready','',200],
  ['/api/api.php','__cms_route=ready',200],
  ['/api/api.php','__cms_route=%2Fready%2F',200],
  ['/api/sections','__cms_route=sections&lang=de',200],
  ['/api/api.php','__cms_route=sections&lang=en',200],
  ['/api/api.php','__cms_route=auth%2Fsession',200],
  ['/api/api.php','__cms_route=unknown',404],
  ...['__cms_route[]=ready','__cms_route=','__cms_route='+ 'a'.repeat(513),
   '__cms_route=../ready','__cms_route=ready%00','__cms_route=auth//session',
   '__cms_route=ready%26lang%3Dde','__cms_route=%252Fready','__cms_route=ready%0A']
   .map(q=>['/api/ready',q,400])
 ];
 function check(body,status,expected,query){
  assert.equal(status,expected,query);
  if(expected===400)assert.deepEqual(body,{error:'Ungültige API-Route.'});
  if(expected===404)assert.deepEqual(body,{error:'API-Endpunkt nicht gefunden.'});
  if(expected===200 && query.includes('sections')){
   assert(Array.isArray(body)&&body.length>0);
   assert(body.every(s=>s.lang===(query.includes('lang=en')?'en':'de')));
  }
  if(expected===200 && query.includes('session'))assert.equal(body.authenticated,false);
  if(expected===200 && !query.includes('sections')&&!query.includes('session'))assert.deepEqual(body,{ready:true});
 }
 try{
  fs.mkdirSync(path.join(dir,'sessions'));fs.mkdirSync(env.CMS_BACKUP_DIR);
  fs.writeFileSync(env.CMS_CONFIG_PATH,"<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__.'/sessions'];");
  run('php',['bin/migrate.php'],{env});
  run('php',['bin/seed.php','--confirm-seed'],{env:{...env,CMS_ENV:'test'}});
  for(const [uri,query,expected] of cases){
   const code="http_response_code(200);parse_str(getenv('TEST_QUERY'),$_GET);$_SERVER['REQUEST_METHOD']='GET';$_SERVER['REQUEST_URI']=getenv('TEST_URI');register_shutdown_function(function(){fwrite(STDERR,json_encode(['status'=>http_response_code(),'get'=>$_GET]));});require getcwd().'/frontend/public/api/api.php';";
   const r=spawnSync('php',['-r',code],{cwd:root,env:{...env,TEST_URI:uri,TEST_QUERY:query},encoding:'utf8',timeout:10000});
   assert.equal(r.status,0,r.stderr);
   const meta=JSON.parse(r.stderr);assert(!('__cms_route' in meta.get));
   if(query.includes('lang='))assert.equal(meta.get.lang,query.includes('lang=en')?'en':'de');
   check(JSON.parse(r.stdout),meta.status,expected,query);
  }
  if(process.platform!=='win32'){
   api=await server(path.join(root,'frontend/public/api/api.php'),env);
   for(const [uri,query,expected] of cases){
    const r=await fetch(api.url+uri+(query?'?'+query:''));check(await r.json(),r.status,expected,query);
   }
  }else{
   assert.notEqual(process.env.REQUIRE_HTTP_TESTS,'1');
   console.log('SKIP Windows routing HTTP; all routing cases executed in PHP CLI; HTTP mandatory on Ubuntu.');
  }
  console.log('API routing passed: fallback, rewritten URI, query preservation, nested routes, normalization and invalid values.');
 }finally{await stop(api);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
