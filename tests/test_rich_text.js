'use strict';
const assert=require('assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 global.window=new JSDOM('').window;global.document=window.document;global.DOMParser=window.DOMParser;
 const {prepareRichText,serializeRichText,cleanPastedText,safeEditorLink}=await import('../frontend/src/utils/richText.js');
 const source='<div class="layout"><h2>Überschrift</h2><p>Text <strong>fett</strong></p><div class="local-slideshow cms-gallery"><img src="/media/a.jpg" alt="Nordseite" title="Haus"/><img src="/media/b.jpg" alt="Südseite"/></div><p>Ende</p></div>';
 const prepared=prepareRichText(source);assert.equal(prepared.galleries.length,1);assert(prepared.html.includes('contenteditable="false"'));assert(!prepared.html.includes('<img'));
 const restored=serializeRichText(prepared.html,prepared.galleries);const doc=new JSDOM(restored).window.document;assert.equal(doc.querySelectorAll('.cms-gallery img').length,2);assert.equal(doc.querySelector('.cms-gallery img').alt,'Nordseite');assert.equal(doc.querySelector('.layout strong').textContent,'fett');
 const deleted=serializeRichText('<p>Neuer Text</p>',prepared.galleries);assert.equal(new JSDOM(deleted).window.document.querySelectorAll('.cms-gallery img').length,2);
 const duplicate=serializeRichText(prepared.html+prepared.html,prepared.galleries);assert.equal(new JSDOM(duplicate).window.document.querySelectorAll('.cms-gallery').length,1);
 const pasted=cleanPastedText('<style>bad</style><p class="MsoNormal" style="color:red" onclick="alert(1)"><b>Word</b><script>alert(1)</script><img src="https://example.com/tracker.jpg"></p>','');const p=new JSDOM(pasted).window.document;assert.equal(p.querySelector('script,style,img,[class],[style],[onclick]'),null);assert.equal(p.querySelector('b').textContent,'Word');
 assert.equal(new JSDOM(cleanPastedText('','<script>Text</script>\nZweite Zeile')).window.document.querySelectorAll('p').length,2);assert(!cleanPastedText('','<script>Text</script>').includes('<script>'));
 for(const value of ['https://example.com','http://example.com','mailto:test@example.com','tel:+49123','#kontakt','/contact'])assert(safeEditorLink(value),value);
 for(const value of ['javascript:alert(1)','data:text/html,test','//evil.example','/\\evil.example','https://exam ple.com'])assert(!safeEditorLink(value),value);
 console.log('Rich text passed: structure/format retention, slideshow protection including deletion/duplication, safe Word/plain-text paste and allowed link protocols.');
})().catch(e=>{console.error(e);process.exitCode=1;});
