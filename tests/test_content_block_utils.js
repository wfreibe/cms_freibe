'use strict';
const assert=require('assert/strict');
const {run}=require('./helpers');
if(!global.crypto)global.crypto=require('crypto').webcrypto;
(async()=>{
 const {pageBlocks,createBlock,blockTypes,moveBlock,youtubeId,localImage,localAudio,safeBlockLink}=await import('../frontend/src/utils/contentBlocks.js');
 assert.equal(pageBlocks(null)[0].type,'legacy');assert.deepEqual(pageBlocks([]),[]);
 const defaults=blockTypes.map(([type])=>createBlock(type));assert.equal(new Set(defaults.map(b=>b.id)).size,defaults.length);
 const normalized=JSON.parse(run('php',['-r',"require 'lib/Validator.php';echo json_encode(ContentBlocks::normalize(json_decode($argv[1],true)));",JSON.stringify(defaults)]).toString());
 assert.deepEqual(normalized.map(b=>b.type),defaults.map(b=>b.type),'Frontend defaults rejected by backend');
 const original=Object.freeze([{id:'a'},{id:'b'},{id:'c'}]);assert.deepEqual(moveBlock(original,0,2).map(b=>b.id),['b','c','a']);assert.deepEqual(original.map(b=>b.id),['a','b','c']);
 const videos=[
  ['abcdefghijk','abcdefghijk'],
  ['https://www.youtube.com/watch?v=abcdefghijk&t=30','abcdefghijk'],
  ['https://youtu.be/abcdefghijk?si=example','abcdefghijk'],
  ['https://www.youtube.com/shorts/abcdefghijk','abcdefghijk'],
  ['https://www.youtube-nocookie.com/embed/abcdefghijk','abcdefghijk'],
  ['HTTPS://www.youtube.com/live/abcdefghijk','abcdefghijk'],
  ['https://youtube.com.evil.example/watch?v=abcdefghijk',''],
  ['https://user@youtube.com/watch?v=abcdefghijk',''],
  ['https://youtube.com:444/watch?v=abcdefghijk',''],
  ['javascript:alert(1)',''],
  ['https://youtube.com/watch?v[]=abcdefghijk','']
 ];
 for(const [value,expected] of videos){
  assert.equal(youtubeId(value),expected,value);
  const actual=run('php',['-r',"require 'lib/Validator.php';try {echo ContentBlocks::youtube($argv[1]);}catch(InvalidArgumentException $e){echo '';}",value]).toString();assert.equal(actual,expected,'Server/client YouTube mismatch: '+value);
 }
 for(const value of ['/media/photo.jpg','/api/media/'+'a'.repeat(32)])assert(localImage(value),value);
 for(const value of ['//tracker.example/a.jpg','https://tracker.example/a.jpg','/%2Ftracker.example/a.jpg','/media/../private.jpg','/media/%0Aphoto.jpg'])assert(!localImage(value),value);
 assert(localAudio('/files/audio.mp3'));assert(!localAudio('https://example.com/audio.mp3'));
 assert.equal(safeBlockLink('/contact'),'/contact');assert.equal(safeBlockLink('https://example.com/'),'https://example.com/');
 for(const value of ['javascript:alert(1)','//evil.example','https://user:pass@example.com','/foo\\bar','/%0Afoo'])assert.equal(safeBlockLink(value),'',value);
 console.log('Block UI contracts passed: recoverable legacy defaults, new block types accepted by server, immutable sorting, matching YouTube parsing, local media and safe links.');
})().catch(e=>{console.error(e);process.exitCode=1;});
