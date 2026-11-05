'use strict';
const assert=require('assert/strict');
const {JSDOM}=require('jsdom');
const {fs,path,crypto,root,baseEnv,run,php,temp,server,stop,snapshot}=require('./helpers');
(async()=>{
 const dir=temp();let api;
 const before=snapshot(path.join(root,'data'));
 const password=crypto.randomBytes(24).toString('hex');
 const env={...baseEnv,CMS_CONFIG_PATH:path.join(dir,'config.php'),CMS_DB_PATH:path.join(dir,'test.sqlite'),CMS_BACKUP_DIR:path.join(dir,'backups'),TEST_PASSWORD:password,TEST_DIR:dir};
 let cookie='',csrf='';
 try{
  fs.mkdirSync(path.join(dir,'sessions'));fs.mkdirSync(env.CMS_BACKUP_DIR);
  fs.writeFileSync(env.CMS_CONFIG_PATH,"<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__.'/sessions'];");
  run('php',['bin/migrate.php'],{env});
  php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->prepare('INSERT INTO admin_credentials(id,username,password_hash,must_change_password,credential_version) VALUES(1,?,?,0,1)')->execute(['test_editor',password_hash(getenv('TEST_PASSWORD'),PASSWORD_DEFAULT)]);$d->exec(\"INSERT INTO sections(id,lang,nav_label,title,content,is_active,is_published) VALUES('gallery-test','de','Test','Test','<p>Text bleibt erhalten.</p>',1,1)\");$im=imagecreatetruecolor(12,8);imagepng($im,getenv('TEST_DIR').'/test.png');imagejpeg($im,getenv('TEST_DIR').'/test.jpg');imagewebp($im,getenv('TEST_DIR').'/test.webp');imagedestroy($im);",env);
  api=await server(path.join(root,'frontend/public/api/api.php'),env);
  async function request(url,options={}){
   const res=await fetch(api.url+url,{...options,headers:{...(cookie?{Cookie:cookie}:{}),...options.headers}});
   const setCookie=res.headers.get('set-cookie');if(setCookie){const matches=[...setCookie.matchAll(/FREIBERGER_DESIGN_SESSION=([^; ,]+)/g)].filter(m=>m[1]!=='deleted');if(matches.length)cookie=matches[matches.length-1][0];}
   return res;
  }
  const upload=(file,token=csrf)=>{const body=new FormData();body.append('image',new Blob([file],{type:'image/png'}),'../original.php');return request('/api/media',{method:'POST',headers:{'X-CSRF-Token':token},body});};
  assert.equal((await upload(fs.readFileSync(path.join(dir,'test.png')))).status,401);
  const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test_editor',password})});assert.equal(login.status,200);csrf=(await login.json()).csrf_token;assert(csrf);
  assert.equal((await upload(fs.readFileSync(path.join(dir,'test.png')),'incorrect')).status,403);
  assert.equal((await upload(Buffer.from('<svg onload="alert(1)"></svg>'))).status,400);
  assert.equal((await upload(Buffer.alloc(8*1024*1024+1))).status,400);
  // Public reads must neither create nor refresh sessions, even with CMS cookies present.
  const publicSessionsBefore=snapshot(path.join(dir,'sessions'));
  for(const route of ['/api/ready','/api/sections?lang=de','/api/sections/gallery-test?lang=de','/api/sections/missing?lang=de','/api/legal/datenschutz?lang=de']){
   const response=await request(route);assert.equal(response.headers.get('set-cookie'),null,'Public route sets cookies: '+route);
  }
  assert.deepEqual(snapshot(path.join(dir,'sessions')),publicSessionsBefore,'Public reads access session storage');
  const sessionResponse=await request('/api/auth/session');assert.match(sessionResponse.headers.get('set-cookie'),/path=\/api/i);
  const preview=await request('/api/sections/gallery-test?lang=de&preview=1');assert.equal(preview.status,200);
  const urls=[];
  for(const ext of ['png','jpg','webp']){
   const bytes=Buffer.concat([fs.readFileSync(path.join(dir,'test.'+ext)),Buffer.from('UNTRUSTED_TRAILING_PAYLOAD')]);
   const res=await upload(bytes);assert.equal(res.status,201,await res.clone().text());const data=await res.json();assert.match(data.url,/^\/api\/media\/[a-f0-9]{32}$/);urls.push(data.url);
   const served=await request(data.url);assert.equal(served.status,200);assert.equal(served.headers.get('x-content-type-options'),'nosniff');assert.match(served.headers.get('content-type'),/^image\//);assert(!Buffer.from(await served.arrayBuffer()).includes(Buffer.from('UNTRUSTED_TRAILING_PAYLOAD')));
  }
  assert.equal((await request('/api/media/'+'0'.repeat(32))).status,404);
  global.DOMParser=new JSDOM('').window.DOMParser;
  const {readGalleries,writeGallery}=await import('../frontend/src/utils/slideshowContent.js');
  const initial='<p>Text bleibt erhalten.</p><div class="local-slideshow"><img src="/media/old.jpg" alt="Alt"></div>';
  let html=writeGallery(initial,0,[{src:urls[1],caption:'Nordseite < & >',title:'Haus A'},{src:urls[0],caption:'Südseite',title:'Haus A'}]);
  const save=await request('/api/sections/gallery-test',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({lang:'de',title:'Test',nav_label:'Test',content:html,image_url:urls[2],bg_image_url:urls[0],is_published:1,show_in_navigation:1})});assert.equal(save.status,200,await save.text());
  const loaded=await (await request('/api/sections/gallery-test?lang=de')).json();
  assert.equal(loaded.image_url,urls[2],'Section image URL was not persisted');assert.equal(loaded.bg_image_url,urls[0],'Background image URL was not persisted');

  const {clearLegacyPart}=await import('../frontend/src/utils/legacyParts.js');
  for(const part of ['slideshow','text']){
   const patch=clearLegacyPart(loaded,part);
   const removal=await request('/api/sections/gallery-test',{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({lang:'de',...patch})});assert.equal(removal.status,200);
   const result=await(await request('/api/sections/gallery-test?lang=de')).json();
   assert.equal(readGalleries(result.content,'gallery-test').length,part==='slideshow'?0:1);
   assert.equal(new DOMParser().parseFromString(result.content,'text/html').querySelector('p')?.textContent||'',part==='slideshow'?'Text bleibt erhalten.':'');
   assert.equal(result.image_url,urls[2]);assert.equal(result.bg_image_url,urls[0]);
   for(const url of urls)assert.equal((await request(url)).status,200,'Removing an area deleted uploaded media');
  }
  const clearImage=await request('/api/sections/gallery-test',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({lang:'de',image_url:null,bg_image_url:null})});assert.equal(clearImage.status,200);
  const cleared=await (await request('/api/sections/gallery-test?lang=de')).json();assert.equal(cleared.image_url,null);assert.equal(cleared.bg_image_url,null);assert.equal((await request(urls[0])).status,200,'Clearing background must not delete the image');assert.equal((await request(urls[2])).status,200,'Removing a section image must not delete its file');
  for(const layout of ['original','wide','left','right']){
   const response=await request('/api/sections/gallery-test',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({lang:'de',image_url:urls[1],image_layout:layout})});assert.equal(response.status,200,await response.text());
   const roundtrip=await (await request('/api/sections/gallery-test?lang=de')).json();assert.equal(roundtrip.image_layout,layout);assert.equal(roundtrip.image_url,urls[1]);
  }
  const keepLayout=await request('/api/sections/gallery-test',{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({lang:'de',subtitle:'Nur Text geändert'})});assert.equal(keepLayout.status,200);
  assert.equal((await (await request('/api/sections/gallery-test?lang=de')).json()).image_layout,'right');
  for(const layout of ['invalid',null,[],1]){assert.equal((await request('/api/sections/gallery-test',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({lang:'de',image_layout:layout})})).status,400);}
  const create=await request('/api/sections',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({id:'layout-create',lang:'de',title:'Bildlayout',nav_label:'Bildlayout',content:'<p>Test</p>',image_layout:'left'})});assert.equal(create.status,201,await create.clone().text());assert.equal((await create.json()).section.image_layout,'left');
  const slides=readGalleries(loaded.content,'gallery-test')[0];assert.deepEqual(slides.map(s=>s.src),[urls[1],urls[0]]);assert.equal(slides[0].caption,'Nordseite < & >');assert.equal(slides[0].title,'Haus A');assert(loaded.content.includes('Text bleibt erhalten.'));
  assert.equal(readGalleries(writeGallery(loaded.content,0,[]),'gallery-test')[0].length,0);
  assert.equal(readGalleries(writeGallery('<p>Neue Seite</p>',0,[slides[0]]),'gallery-test')[0][0].src,urls[1]);
  const home=JSON.parse(fs.readFileSync(path.join(root,'seeds/design-pages.json'),'utf8')).find(p=>p.id==='home');assert.equal(readGalleries(home.content,'home',JSON.parse(fs.readFileSync(path.join(root,'frontend/src/slideshows.json'),'utf8')))[0][0].caption,'Haus F, Maitenbeth');
  php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->exec('UPDATE admin_credentials SET must_change_password=1');",env);
  assert.equal((await upload(fs.readFileSync(path.join(dir,'test.png')))).status,403);
  console.log('Slideshow editor passed: isolated HTTP auth/CSRF, JPEG/PNG/WebP upload and re-encoding, invalid/oversize rejection, protected first login, persistent order/captions, empty/new galleries, legacy import; live data unchanged.');
 }finally{await stop(api);assert.deepEqual(snapshot(path.join(root,'data')),before,'Live runtime changed');fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
