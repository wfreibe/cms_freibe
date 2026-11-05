'use strict';
const assert=require('assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('');global.document=dom.window.document;
 try{
  const {blockSummary}=await import('../frontend/src/utils/blockSummary.js');
  assert.deepEqual(blockSummary({type:'slideshow',data:{title:'Galerie',images:[{},{}]}}),{title:'Galerie',detail:'2 Bilder'});
  assert.equal(blockSummary({type:'accordion',data:{items:[{}]}}).detail,'1 Thema');
  assert.equal(blockSummary({type:'legacy',data:{}},{title:'Startseite'}).title,'Startseite');
  assert.equal(blockSummary({type:'text',data:{html:'<p>Hallo <b>Welt</b> &amp; willkommen.</p><p>Zweiter Absatz.</p><script>evil()</script><style>hidden</style>'}}).detail,'Hallo Welt & willkommen. Zweiter Absatz.');
  assert.equal(blockSummary({type:'text',data:{html:''}}).detail,'Noch kein Text');
  assert(blockSummary({type:'text',data:{html:'x'.repeat(120)}}).detail.endsWith('…'));
  assert.equal(blockSummary({type:'link',data:{label:'Kontakt',href:'/contact'}}).title,'Kontakt');
  console.log('Block summaries passed: titles, gallery/topic counts, decoded text, paragraph spacing, inert HTML, empty content and truncation.');
 }finally{dom.window.close();delete global.document;}
})().catch(e=>{console.error(e);process.exitCode=1;});
