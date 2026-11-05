'use strict';
const assert=require('assert/strict');
const {fs,path,crypto,root,baseEnv,run,php,temp,server,stop,snapshot}=require('./helpers');
(async()=>{
 const dir=temp(), before=snapshot(path.join(root,'data'));let api,cookie='',csrf='';
 const password=crypto.randomBytes(24).toString('hex');
 const env={...baseEnv,CMS_CONFIG_PATH:path.join(dir,'config.php'),CMS_DB_PATH:path.join(dir,'content.sqlite'),CMS_BACKUP_DIR:path.join(dir,'backups'),CMS_MIGRATIONS_DIR:path.join(dir,'old-migrations'),TEST_PASSWORD:password};
 const initial='<p>Bestehender Text bleibt.</p><div class="local-slideshow"><img src="/media/old.jpg" alt="Unterschrift"></div>';
 try {
  fs.mkdirSync(env.CMS_MIGRATIONS_DIR);fs.mkdirSync(env.CMS_BACKUP_DIR);fs.mkdirSync(path.join(dir,'sessions'));
  fs.writeFileSync(env.CMS_CONFIG_PATH,"<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__.'/sessions'];");
  for(const name of fs.readdirSync(path.join(root,'migrations')).filter(n=>/\.sql$/.test(n)&&Number(n.slice(0,3))<=10))fs.copyFileSync(path.join(root,'migrations',name),path.join(env.CMS_MIGRATIONS_DIR,name));
  run('php',['bin/migrate.php'],{env});
  php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));$d->prepare('INSERT INTO sections(id,lang,nav_label,title,content,is_active,is_published,show_in_navigation) VALUES(?,?,?,?,?,1,1,1)')->execute(['blocks-test','de','Test','Test',"+JSON.stringify(initial)+"]);$d->exec(\"INSERT INTO section_accordions(id,section_id,lang,title,content,sort_order,is_active,is_published) VALUES('acc_old','blocks-test','de','Bestehendes Thema','<p>Alter Akkordeontext</p>',1,1,1)\");$d->prepare('INSERT INTO admin_credentials(id,username,password_hash,must_change_password,credential_version) VALUES(1,?,?,0,1)')->execute(['test_editor',password_hash(getenv('TEST_PASSWORD'),PASSWORD_DEFAULT)]);",env);
  const oldRows=php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));echo json_encode([$d->query('SELECT content FROM sections')->fetchAll(),$d->query('SELECT * FROM section_accordions')->fetchAll()]);",env);
  env.CMS_MIGRATIONS_DIR=path.join(root,'migrations');run('php',['bin/migrate.php'],{env});
  assert.equal(php("$d=new PDO('sqlite:'.getenv('CMS_DB_PATH'));echo json_encode([$d->query('SELECT content FROM sections')->fetchAll(),$d->query('SELECT * FROM section_accordions')->fetchAll()]);",env),oldRows,'Migration changed legacy data');
  api=await server(path.join(root,'frontend/public/api/api.php'),env);
  async function request(url,options={}) {
   const response=await fetch(api.url+url,{...options,headers:{...(cookie?{Cookie:cookie}:{}),...options.headers}});
   const cookies=response.headers.get('set-cookie');if(cookies){const values=[...cookies.matchAll(/FREIBERGER_DESIGN_SESSION=([^; ,]+)/g)].filter(m=>m[1]!=='deleted');if(values.length)cookie=values.at(-1)[0];}
   return response;
  }
  const write=(data,method='PATCH',token=csrf)=>request('/api/sections/blocks-test',{method,headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({lang:'de',...data})});
  const publicRead=()=>request('/api/sections/blocks-test?lang=de');
  let response=await publicRead();assert.equal(response.headers.get('set-cookie'),null);
  const original=await response.json();assert.equal(original.content,initial);assert.equal(original.content_blocks[0].type,'legacy');assert.equal(original.accordions[0].title,'Bestehendes Thema');
  assert.equal((await write({content_blocks:[]})).status,401);
  const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test_editor',password})});assert.equal(login.status,200);csrf=(await login.json()).csrf_token;
  assert.equal((await write({content_blocks:[]},'PATCH','invalid')).status,403);
  for(const color of ['#111316','#edf0f2','#c7254e','#4ad7d1','']){
   const saved=await write({bg_color:color});assert.equal(saved.status,200);
   const returned=await (await publicRead()).json();assert.equal(returned.bg_color,color||null,'Background color lost between CMS save and public API');
  }
  const blocks=[
   {id:'old',type:'legacy',enabled:true,data:{}},
   {id:'copy',type:'text',enabled:true,data:{title:'Text',html:'<p onclick="alert(1)">Neu <strong>formatiert</strong></p><script>alert(1)</script>'}},
   {id:'picture',type:'image',enabled:true,data:{title:'Bild',src:'/api/media/'+'a'.repeat(32),html:'<p>Bildtext</p>',alt:'Ansicht',caption:'Nordseite < & >',options:{format:'1:1',layout:'beside',align:'right',width:66,focus_x:20,focus_y:75}}},
   {id:'slides',type:'slideshow',enabled:true,data:{images:[{src:'/media/second.jpg',caption:'Zwei',title:'B'},{src:'/media/first.jpg',caption:'Eins',title:'A'}],interval:7}},
   {id:'topics',type:'accordion',enabled:true,data:{items:[{id:'a1',title:'Thema 1',html:'<p>Inhalt 1</p>'},{id:'a2',title:'Thema 2',html:'<p>Inhalt 2</p>'}]}},
   {id:'film',type:'youtube',enabled:true,data:{title:'Film',video:'https://www.youtube.com/shorts/abcdefghijk',cover:'/media/cover.jpg'}},
   {id:'sound',type:'audio',enabled:true,data:{src:'/files/sample.mp3',caption:'Audio'}},
   {id:'action',type:'link',enabled:true,data:{href:'https://example.com/project',label:'Mehr erfahren',style:'button'}},
   {id:'hidden',type:'text',enabled:false,data:{html:'<p>UNPUBLISHED_BLOCK_MARKER</p>'}}
  ];
  response=await write({content_blocks:blocks});assert.equal(response.status,200,await response.text());
  response=await publicRead();assert.equal(response.headers.get('set-cookie'),null);let page=await response.json();
  assert.equal(page.content,initial);assert.deepEqual(page.accordions,original.accordions);assert.equal(page.content_blocks.length,8);assert(!JSON.stringify(page).includes('UNPUBLISHED_BLOCK_MARKER'));
  assert(!/onclick|<script/i.test(page.content_blocks.find(b=>b.id==='copy').data.html));assert(page.content_blocks.find(b=>b.id==='copy').data.html.includes('<strong>formatiert</strong>'));
  assert.equal(page.content_blocks.find(b=>b.id==='film').data.video,'abcdefghijk');
  assert.equal(page.content_blocks.find(b=>b.id==='picture').data.options.width,66);
  assert.deepEqual(page.content_blocks.find(b=>b.id==='slides').data.images.map(i=>i.caption),['Zwei','Eins']);
  const admin=await (await request('/api/sections/blocks-test?lang=de&preview=1')).json();assert.equal(admin.content_blocks.length,9);
  response=await write({subtitle:'Nur Untertitel'});assert.equal(response.status,200);
  assert.deepEqual((await (await request('/api/sections/blocks-test?lang=de&preview=1')).json()).content_blocks,admin.content_blocks,'Partial save lost blocks');
  const bad=[
   null,{},'[]',Array.from({length:51},(_,i)=>({id:'b'+i,type:'legacy',enabled:true,data:{}})),
   [{...blocks[0]},{...blocks[0]}],
   [{...blocks[0]},{...blocks[0],id:'old2'}],
   [{...blocks[1],type:'iframe'}],[{...blocks[1],enabled:1}],
   [{...blocks[2],data:{src:'https://example.com/track.jpg'}}],
   [{...blocks[2],data:{src:'/../private.jpg'}}],
   [{...blocks[2],data:{src:'/%2fexample.com/track.jpg'}}],
   [{...blocks[2],data:{options:{format:'broken'}}}],
   [{...blocks[3],data:{images:{src:'/media/foo.jpg'}}}],
   [{...blocks[3],data:{interval:0}}],
   [{...blocks[4],data:{items:[{id:'same',title:'A'},{id:'same',title:'B'}]}}],
   [{...blocks[5],data:{video:'https://youtube.com.evil.example/watch?v=abcdefghijk'}}],
   [{...blocks[5],data:{video:'https://www.youtube.com/watch?v[]=abcdefghijk'}}],
   [{...blocks[5],data:{video:'https://www.youtube.com:444/watch?v=abcdefghijk'}}],
   [{...blocks[6],data:{src:'https://example.com/a.mp3'}}],
   [{...blocks[7],data:{href:'javascript:alert(1)'}}],
   [{...blocks[7],data:{href:'//evil.example'}}]
  ];
  for(const value of bad){response=await write({title:'MUST_NOT_SAVE',content_blocks:value});assert.equal(response.status,400,JSON.stringify(value)+' '+await response.text());}
  page=await (await publicRead()).json();assert.equal(page.title,'Test');assert.equal(page.content,initial);
  response=await write({content_blocks:[...admin.content_blocks].reverse()});assert.equal(response.status,200);
  assert.deepEqual((await (await request('/api/sections/blocks-test?lang=de&preview=1')).json()).content_blocks.map(b=>b.id),admin.content_blocks.map(b=>b.id).reverse());
  response=await write({content_blocks:[]});assert.equal(response.status,200);page=await (await publicRead()).json();assert.deepEqual(page.content_blocks,[]);assert.equal(page.content,'');assert.deepEqual(page.accordions,[]);const retained=await (await request('/api/sections/blocks-test?lang=de&preview=1')).json();assert.equal(retained.content,initial);assert.deepEqual(retained.accordions,original.accordions);
  response=await write({content_blocks:[blocks[0]]});assert.equal(response.status,200);
  const create=await request('/api/sections',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({id:'modular-new',lang:'de',title:'Neue Seite',nav_label:'Neue Seite',is_published:1,content_blocks:[blocks[1]]})});
  assert.equal(create.status,201,await create.clone().text());assert.equal((await create.json()).section.content_blocks[0].type,'text');
  response=await write({is_published:0});assert.equal(response.status,200);assert.equal((await publicRead()).status,404);assert.equal((await request('/api/sections/blocks-test?lang=de&preview=1')).status,200);
  console.log('Content blocks passed: additive migration, legacy preservation, auth/CSRF, typed roundtrip, XSS/URL rejection, hidden/public separation, partial edits, order, removal/recovery and new pages.');
 } finally {await stop(api);assert.deepEqual(snapshot(path.join(root,'data')),before,'Live local runtime was modified by tests');fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
