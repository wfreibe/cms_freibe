'use strict';
const assert=require('assert/strict');
(async()=>{
 const {slugify,proposedPath}=await import('../frontend/src/utils/pageUrls.js');
 for(const [input,output] of [['Über uns','ueber-uns'],['Müller & Söhne','mueller-soehne'],['ÄÖÜ äöü ßẞ','aeoeue-aeoeue-ssss'],['  Straße  & Büro  ','strasse-buero'],['Crème brûlée','creme-brulee'],['---','']])assert.equal(slugify(input),output);
 assert.equal(proposedPath('','Über uns',''),'/ueber-uns');
 assert.equal(proposedPath('','Über uns','/section/t'),'/ueber-uns');
 assert.equal(proposedPath('','Neuer Menüname','/bestehend'),'/bestehend');
 assert.equal(proposedPath('Über mich','Name','/bestehend'),'/ueber-mich');
 assert.equal(proposedPath('','Projekt','/project/L1_p'),'/project/L1_p');
 console.log('URL field passed: German transliteration, automatic names, explicit overrides and stable existing addresses.');
})().catch(e=>{console.error(e);process.exitCode=1;});
