'use strict';
const assert=require('assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('');global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;
 try{
  const {legacyPartPresence,clearLegacyPart}=await import('../frontend/src/utils/legacyParts.js');
  const {prepareRichText,serializeRichText}=await import('../frontend/src/utils/richText.js');
  const source={content:'<h2>Titel</h2><p>Text bleibt.</p><img src="/files/inline.jpg"><div class="local-slideshow cms-gallery"><img src="/files/a.jpg" alt="A"></div><p>Ende</p><div class="MagicSlideshow"><img src="/files/b.jpg"></div>',image_url:'/files/lead.jpg',image_layout:'left',bg_color:'#c7254e',bg_image_url:'/files/bg.jpg',accordions:[{id:'a',title:'Thema',content:'<p>Inhalt</p>'}],contact_info:{email:'test@example.invalid'}};
  const before=JSON.stringify(source);
  assert(Object.values(legacyPartPresence(source)).every(Boolean));
  for(const part of ['image','background','accordions','contact','slideshow','text']){
   const patch=clearLegacyPart(source,part),next={...source,...patch};
   assert.equal(legacyPartPresence(next)[part],false,part);
   for(const key of Object.keys(source))if(!Object.hasOwn(patch,key))assert.deepEqual(next[key],source[key],part+' changed '+key);
  }
  const noGallery=clearLegacyPart(source,'slideshow').content;
  let doc=new DOMParser().parseFromString(noGallery,'text/html');assert.equal(doc.querySelectorAll('.MagicSlideshow,.local-slideshow').length,0);assert.equal(doc.querySelector('h2').textContent,'Titel');assert(doc.querySelector('img[src="/files/inline.jpg"]'));
  const prepared=prepareRichText(noGallery);assert.equal(prepared.galleries.length,0);assert(!serializeRichText(prepared.html+'<p>Weiter bearbeitet</p>',prepared.galleries).includes('local-slideshow'));
  const onlyGalleries=clearLegacyPart(source,'text').content;doc=new DOMParser().parseFromString(onlyGalleries,'text/html');assert.equal(doc.querySelectorAll('.MagicSlideshow,.local-slideshow').length,2);assert.equal(doc.querySelector('p,h2,img[src="/files/inline.jpg"]'),null);assert.equal(doc.querySelector('.cms-gallery img').alt,'A');
  assert.equal(JSON.stringify(source),before);assert.throws(()=>clearLegacyPart(source,'invalid'));
  console.log('Individual removal passed: all six areas, unrelated fields and original state preserved, text/gallery separation and no slideshow resurrection after text edits.');
 }finally{dom.window.close();delete global.window;delete global.document;delete global.DOMParser;}
})().catch(e=>{console.error(e);process.exitCode=1;});
