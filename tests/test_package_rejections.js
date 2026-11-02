'use strict';
const assert=require('assert/strict');
const {fs,path,temp}=require('./helpers');
const {execFileSync}=require('child_process');
const {audit}=require('../scripts/release_audit');
const dir=temp(),file=path.join(dir,'test.zip');
function create(entry,body){
  execFileSync('php',['-r',"$z=new ZipArchive();$z->open(getenv('ZIP'),ZipArchive::CREATE|ZipArchive::OVERWRITE);$z->addFromString(getenv('ENTRY'),getenv('BODY'));$z->close();"],{env:{...process.env,ZIP:file,ENTRY:entry,BODY:body}});
}
try{
  for(const entry of [
    'server/data/content.sqlite', 'server/data/content.sqlite-wal',
    'webroot/.git/config', 'server/tmp/diagnostic.txt', 'server/temp/diagnostic.txt',
    'webroot/assets/diagnostic.exe', 'webroot/assets/diagnostic.dll',
    'webroot/assets/diagnostic.bat', 'webroot/assets/diagnostic.cmd',
    'webroot/assets/diagnostic.ps1', 'server/vendor/pkg/tests/fixture.txt',
    'server/vendor/pkg/coverage/report.txt', 'webroot/router.php',
    'webroot/server_router.php', 'webroot/api/test_curl.php',
    'webroot/api/index.php'
  ]){
    create(entry,'synthetic');
    assert.throws(()=>audit(file,'deploy'),/Forbidden (deploy )?ZIP entry|Unexpected public PHP entry/,entry);
  }
  create('frontend/public/assets/diagnostic.exe','synthetic');
  assert.throws(()=>audit(file,'source'),/Forbidden ZIP entry/);
  const syntheticHash=String.fromCodePoint(36)+'2y'+String.fromCodePoint(36)+'10'+String.fromCodePoint(36)+'A'.repeat(53);
  create('webroot/index.html',syntheticHash);
  assert.throws(()=>audit(file,'deploy'),/secret signature/);
  console.log('Package rejection tests passed: runtime data, diagnostics, executable files, public PHP, test artifacts and credential signatures stop the release audit.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
