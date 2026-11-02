'use strict';
const assert=require('assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
 global.window=new JSDOM('').window;
 const {sanitizeHtml}=await import('../frontend/src/utils/sanitizeHtml.js');
 const payloads=['<script>alert(1)</script>','<img src=x onerror=alert(1)>','<a href="javascript:alert(1)">X</a>','<a href="data:text/html,test">X</a>','<a href="//evil.example">X</a>','<svg onload=alert(1)></svg>','<math><mtext><img onerror=alert(1)></mtext></math>','<p style="background:url(https://evil.example)">X</p>','<p style="width:expression(alert(1))">X</p>','<p><b><a href="jav&#x61;script:alert(1)">X</p></a>'];
 for(const input of payloads){const doc=new JSDOM(sanitizeHtml(input)).window.document; assert.equal(doc.querySelector('script,svg,math,[style]'),null);for(const el of doc.querySelectorAll('*'))for(const a of el.attributes)assert(!/^on/i.test(a.name));for(const a of doc.querySelectorAll('[src]'))assert(!/javascript:|data:|^\/\//i.test(a.getAttribute('src')));for(const a of doc.querySelectorAll('a[href]'))assert(!/javascript:|data:|^\/\//i.test(a.getAttribute('href')));}
 assert(sanitizeHtml('<img src="/media/test.jpg" alt="Test">').includes('src="/media/test.jpg"'));
 const safe=sanitizeHtml('<a href="https://example.com" target="_blank">X</a>');assert(safe.includes('noopener noreferrer'));
 const purify=(await import('../frontend/node_modules/dompurify/dist/purify.es.mjs')).default;
 const original=purify.sanitize;purify.sanitize=()=>{throw new Error('Injected failure');};assert.equal(sanitizeHtml('<p>raw sentinel</p>'),'');purify.sanitize=original;
 console.log('DOMPurify: 10 XSS vectors, safe link and actual sanitizer failure passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
