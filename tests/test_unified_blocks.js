'use strict';
const assert=require('assert/strict'),{JSDOM}=require('jsdom');
const {fs,path,root,run,temp}=require('./helpers');
(async()=>{
 const dir=temp(),dom=new JSDOM('<div id="test"></div>',{url:'http://localhost'});
 global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;Object.defineProperty(global,'navigator',{configurable:true,value:dom.window.navigator});Object.defineProperty(global,'crypto',{configurable:true,value:require('crypto').webcrypto});
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 try{
  require('../frontend/node_modules/esbuild').buildSync({stdin:{contents:"export {ContentBlocks} from './src/components/ContentBlocks';export {unifiedBlocks} from './src/utils/unifiedBlocks';export {render,h} from 'preact';",resolveDir:path.join(root,'frontend')},bundle:true,jsx:'automatic',jsxImportSource:'preact',platform:'node',format:'cjs',outfile:path.join(dir,'components.cjs'),loader:{'.css':'empty'},logLevel:'silent'});
  const {ContentBlocks,unifiedBlocks,render,h}=require(path.join(dir,'components.cjs'));
  const pages=JSON.parse(fs.readFileSync(path.join(root,'seeds/design-pages.json'),'utf8'));
  const normalized=blocks=>JSON.parse(run('php',['-r',"require 'lib/Validator.php';echo json_encode(ContentBlocks::normalize(json_decode(stream_get_contents(STDIN),true)));"],{input:JSON.stringify(blocks)}).toString());
  const mount=document.getElementById('test');
  function structure(node){
   if(node.nodeType===3)return node.textContent.trim()?node.textContent.replace(/\s+/g,' ').trim():null;
   if(node.nodeType!==1)return null;
   const attrs=[...node.attributes].filter(a=>a.name!=='alt'&&!(a.name==='title'&&a.value==='')).map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0]));
   return [node.tagName,attrs,[...node.childNodes].map(structure).filter(Boolean)];
  }
  for(const original of pages){
   const page={...original,accordions:[],content_blocks:null};
   const before=JSON.stringify(page);render(h(ContentBlocks,{page}),mount);
   const originalAlts=[...mount.querySelectorAll('.page-copy img')].map(el=>el.getAttribute('alt'));
   const originalText=mount.querySelector('.page-copy').textContent.replace(/\s+/g,'');
   const canonicalHtml=run('php',['-r',"require 'lib/HtmlSanitizer.php';echo HtmlSanitizer::clean(stream_get_contents(STDIN));"],{input:page.content}).toString();
   render(h(ContentBlocks,{page:{...page,content:canonicalHtml}}),mount);
   const old=[...mount.querySelector('.page-copy').childNodes].map(structure).filter(Boolean);
   const blocks=unifiedBlocks(page);assert(!blocks.some(b=>b.type==='legacy'),page.id);
   assert.equal(JSON.stringify(page),before,'Conversion mutated original page '+page.id);
   assert.deepEqual(unifiedBlocks({...page,content_blocks:blocks}),blocks,'Conversion was not idempotent');
   const stored=normalized(blocks);
   render(h(ContentBlocks,{page:{...page,content_blocks:stored}}),mount);
   const actual=[...mount.querySelector('.page-copy').childNodes].map(structure).filter(Boolean);
   originalAlts.forEach((alt,i)=>{if(alt!==null)assert.equal(mount.querySelectorAll('.page-copy img')[i].getAttribute('alt'),alt,'Image description changed for '+page.id);});
   assert.equal(mount.querySelector('.page-copy').textContent.replace(/\s+/g,''),originalText,'Text content lost for '+page.id);
   assert.deepEqual(actual,old,'Original layout/content changed for '+page.id);
   assert.equal(mount.querySelectorAll('.cms-slot').length,0);
  }
  const sample={id:'test',content:'<p>Nur Text.</p>',accordions:[],content_blocks:null};
  assert.deepEqual(unifiedBlocks({...sample,content:''}),[]);
  assert.deepEqual(unifiedBlocks(sample).map(b=>b.type),['text']);
  const galleries=unifiedBlocks({...sample,content:'<p>Vorher</p><div class="local-slideshow"><img src="/media/a.jpg" alt="A"></div><p>Nachher</p>'});
  assert.deepEqual(galleries.map(b=>b.type),['text','slideshow','text']);
  const moved=[galleries[2],galleries[1],galleries[0]];
  render(h(ContentBlocks,{page:{...sample,content_blocks:moved}}),mount);
  assert.deepEqual([...mount.querySelectorAll('.page-copy p')].map(p=>p.textContent),['Nachher','Vorher']);
  render(h(ContentBlocks,{page:{...sample,content_blocks:galleries.filter(b=>b.type!=='slideshow')}}),mount);
  assert.equal(mount.querySelector('.design-slideshow'),null);
  assert(mount.textContent.includes('Vorher')&&mount.textContent.includes('Nachher'));
  console.log('Unified elements passed: all 11 original page DOM structures preserved through PHP normalization, no mutation, repeatability, empty content, actual order and individual deletion.');
  render(null,mount);
 }finally{dom.window.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
