'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const pages=JSON.parse(fs.readFileSync(path.join(root,'seeds/design-pages.json'),'utf8'));
const base=process.env.DESIGN_TEST_URL||'http://127.0.0.1:3011';
const text=html=>new JSDOM(html).window.document.body.textContent.replace(/\s+/g,' ').trim();
(async()=>{
 assert.equal(pages.length,11);assert.equal((await fetch(base+'/api/ready')).status,200);
 for(const page of pages){
  const res=await fetch(base+'/api/sections/'+page.id+'?lang=de');assert.equal(res.status,200,page.route);
  assert.equal(res.headers.get('set-cookie'),null,'Public content sets cookies');
  const data=await res.json();assert.equal(text(data.content),text(page.content),'Text changed: '+page.route);
  const doc=new JSDOM(data.content).window.document;
  assert.equal(doc.querySelectorAll('img').length,new JSDOM(page.content).window.document.querySelectorAll('img').length,'Image count: '+page.route);
  for(const img of doc.querySelectorAll('img')){const src=img.getAttribute('src');assert(src.startsWith('/media/'));assert(fs.existsSync(path.join(root,'frontend/public',src)));}
  assert.equal((await fetch(base+page.route)).status,200,page.route);
 }
 assert.equal((await fetch(base+'/api/sections/does-not-exist?lang=de')).status,404);
 const session=await (await fetch(base+'/api/auth/session')).json();assert.equal(session.authenticated,false);
 assert.equal((await fetch(base+'/api/sections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'unauthorized-test'})})).status,401);
 console.log('Design: 11 routes, exact text preservation, local image counts/files, readiness, missing page and protected CMS writes passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
