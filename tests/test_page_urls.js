'use strict';
const assert=require('assert/strict');
const {fs,path,crypto,root,baseEnv,run,php,temp,server,stop}=require('./helpers');
(async()=>{
 const dir=temp();let api,cookie='',csrf='';
 const env={...baseEnv,CMS_DB_PATH:path.join(dir,'content.sqlite'),CMS_CONFIG_PATH:path.join(dir,'config.php'),CMS_BACKUP_DIR:path.join(dir,'backups'),API_ENTRY:path.join(root,'frontend/public/api/api.php'),TEST_PASSWORD:crypto.randomBytes(24).toString('hex')};
 try{
  fs.mkdirSync(env.CMS_BACKUP_DIR);fs.mkdirSync(path.join(dir,'sessions'));
  fs.writeFileSync(env.CMS_CONFIG_PATH,"<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__.'/sessions'];");
  run('php',['bin/migrate.php'],{env});
  php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->prepare('INSERT INTO admin_credentials(id,username,password_hash,must_change_password,credential_version) VALUES(1,?,?,0,1)')->execute(['test_editor',password_hash(getenv('TEST_PASSWORD'),PASSWORD_DEFAULT)]);$d->exec(\"INSERT INTO sections(id,lang,nav_label,title,content,is_published,is_active,show_in_navigation) VALUES('aboutme','de','Über mich','Vorhandener Titel','<p>Bestand bleibt.</p>',1,1,1),('home','de','Home','Start','<p>Home</p>',1,1,1)\");",env);
  const router=path.join(dir,'router.php');fs.writeFileSync(router,"<?php if(!str_starts_with(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),'/api/'))$_GET['__cms_page']='1';require getenv('API_ENTRY');");
  api=await server(router,env,path.join(root,'frontend/public'));
  async function request(url,options={}){const r=await fetch(api.url+url,{...options,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...options.headers}});const value=r.headers.get('set-cookie');if(value){const values=[...value.matchAll(/FREIBERGER_DESIGN_SESSION=([^; ,]+)/g)].filter(m=>m[1]!=='deleted');if(values.length)cookie=values.at(-1)[0];}return r;}
  const write=(id,data,method='PATCH')=>request('/api/sections'+(id?'/'+id:''),{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({lang:'de',...data})});
  const load=async id=>(await request('/api/sections/'+id+'?lang=de&preview=1')).json();
  const resolve=path=>request('/api/page-route?path='+encodeURIComponent(path));
  let r=await resolve('/aboutme');assert.equal(r.status,200);assert.deepEqual(await r.json(),{id:'aboutme',url_path:'/aboutme',redirect:false});assert.equal(r.headers.get('set-cookie'),null);
  assert.equal((await write('aboutme',{url_slug:'ueber-mich'})).status,401);
  r=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test_editor',password:env.TEST_PASSWORD})});csrf=(await r.json()).csrf_token;assert(csrf);
  r=await write('',{id:'slug-alpha',nav_label:'Müller & Söhne',title:'Neu',is_published:1},'POST');assert.equal(r.status,201,await r.clone().text());const created=(await r.json()).section;assert.equal(created.url_path,'/mueller-soehne');assert.equal(created.url_slug,'mueller-soehne');

  assert.equal((await load('slug-alpha')).menu_parent,'');
  r=await write('slug-alpha',{menu_parent:'@projects'});assert.equal(r.status,200);assert.equal((await load('slug-alpha')).menu_parent,'@projects');
  r=await write('slug-alpha',{menu_parent:'aboutme'});assert.equal(r.status,200);assert.equal((await load('slug-alpha')).url_path,'/mueller-soehne','Menu move changed URL');
  let translated=await request('/api/sections/slug-alpha?lang=fr&preview=1');assert.equal((await translated.json()).menu_parent,'aboutme','Menu placement differs between translations');
  for(const parent of ['slug-alpha','missing-parent',[],null,'../bad']){
   r=await write('slug-alpha',{menu_parent:parent});assert.equal(r.status,400,'Accepted invalid menu placement '+JSON.stringify(parent));assert.equal((await load('slug-alpha')).menu_parent,'aboutme');
  }
  r=await write('aboutme',{menu_parent:'@projects',url_slug:'must-rollback'});assert.equal(r.status,400,'Moved parent with children');assert.equal((await load('aboutme')).url_path,'/aboutme','Rejected menu change left URL update behind');
  r=await write('home',{menu_parent:'aboutme'});assert.equal(r.status,400,'Start page moved below another menu');
  r=await write('',{id:'menu-folder',nav_label:'Ordner',title:'Ordner',menu_parent:''},'POST');assert.equal(r.status,201);
  r=await write('slug-alpha',{menu_parent:'menu-folder'});assert.equal(r.status,200);
  r=await write('aboutme',{menu_parent:'slug-alpha'});assert.equal(r.status,400,'Accepted a third menu level');
  r=await write('menu-folder',{},'DELETE');assert.equal(r.status,200);assert.equal((await load('slug-alpha')).menu_parent,'','Deleting parent lost/promoted children incorrectly');
  r=await write('slug-alpha',{title:'Neu'});assert.equal(r.status,200);
  r=await request('/section/slug-alpha?ref=one');assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/mueller-soehne?ref=one');assert.equal(r.headers.get('set-cookie'),null);
  r=await request('/mueller-soehne');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);
  assert.equal((await request('/api/ready')).status,200);
  r=await write('slug-alpha',{url_slug:'ready'});assert.equal(r.status,200);r=await request('/ready');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);await write('slug-alpha',{url_slug:'mueller-soehne'});
  r=await write('slug-alpha',{nav_label:'Neuer Menüname',url_slug:''});assert.equal(r.status,200);assert.equal((await load('slug-alpha')).url_path,'/mueller-soehne');
  for(const slug of ['cms','API','section','assets','media','../evil','https://evil.example','name?x=1',[],null,'ü'.repeat(101)]){
   r=await write('slug-alpha',{url_slug:slug,title:'MUST_NOT_SAVE'});assert.equal(r.status,400,JSON.stringify(slug)+' '+await r.clone().text());assert.equal((await load('slug-alpha')).title,'Neu');
  }
  r=await write('',{id:'duplicate',nav_label:'Müller & Söhne',title:'Doppelt'},'POST');assert.equal(r.status,409);
  assert.equal(php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));echo $d->query(\"SELECT count(*) FROM sections WHERE id='duplicate'\")->fetchColumn();",env),'0','Failed create left translations behind');
  r=await write('',{id:'reserved-auto',nav_label:'CMS',title:'Reserviert'},'POST');assert.equal(r.status,400);assert.equal(php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));echo $d->query(\"SELECT count(*) FROM sections WHERE id='reserved-auto'\")->fetchColumn();",env),'0');
  r=await write('slug-alpha',{url_slug:'aboutme'});assert.equal(r.status,409,'Protected existing legacy URL');
  r=await write('aboutme',{url_slug:'Über mich',nav_label:'Anderer Name'});assert.equal(r.status,200);let page=await load('aboutme');assert.equal(page.url_path,'/ueber-mich');assert.equal(page.content,'<p>Bestand bleibt.</p>');
  r=await request('/aboutme');assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/ueber-mich');
  r=await write('aboutme',{url_slug:'profil'});assert.equal(r.status,200);
  r=await resolve('/ueber-mich');assert.deepEqual(await r.json(),{id:'aboutme',url_path:'/profil',redirect:true});
  r=await write('slug-alpha',{url_slug:'ueber-mich'});assert.equal(r.status,409,'Old addresses cannot be stolen');
  r=await write('aboutme',{url_slug:'ueber-mich'});assert.equal(r.status,200,'Own former URL can be restored');
  r=await request('/profil');assert.equal(r.headers.get('location'),'/ueber-mich');
  r=await write('aboutme',{show_in_navigation:0});assert.equal(r.status,200);assert.equal((await resolve('/ueber-mich')).status,200,'Hidden navigation page remains reachable');
  r=await write('aboutme',{is_published:0});assert.equal(r.status,200);assert.equal((await resolve('/ueber-mich')).status,404);assert.equal((await request('/aboutme')).status,404,'Draft alias must not redirect');
  r=await write('home',{url_slug:'andere-startseite'});assert.equal(r.status,409);assert.equal((await resolve('/')).status,200);
  for(const path of ['//evil.example','https://evil.example','/bad\\path','/missing']){r=await resolve(path);assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);}
  assert.equal((await request('/cms')).status,200);assert.equal((await request('/cms/')).status,200);assert.equal((await request('/cms/preview/aboutme')).status,200);
  r=await request('/api/sections/slug-alpha?__cms_page=1');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/json/);
  r=await write('slug-alpha',{},'DELETE');assert.equal(r.status,200);assert.equal((await resolve('/mueller-soehne')).status,404);
  assert.equal(php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));echo $d->query(\"SELECT count(*) FROM page_urls WHERE section_id='slug-alpha'\")->fetchColumn();",env),'0');
  console.log('Page URLs passed: automatic German slugs, stable menu renames, uniqueness/reservations, atomic failures, old-address ownership, 301 redirects, hidden pages, drafts, CMS and API separation.');
 }finally{await stop(api);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
