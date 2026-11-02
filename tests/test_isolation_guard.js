'use strict';
const assert=require('assert/strict');
const guard=require('../scripts/isolation_guard');
const {fs,path,temp}=require('./helpers');
const {execFileSync}=require('child_process');
const name=String.fromCodePoint(66,252,104,108,101,114);
for(const v of [name,name.normalize('NFD'),name.toUpperCase(),name.replace(String.fromCodePoint(252),'ue'),name.replace(String.fromCodePoint(252),'u'),name.split('').join('-_ ')])assert(guard.matches(v));
for(const data of [Buffer.from(name,'utf8'),Buffer.from(name,'latin1'),Buffer.from(name,'utf16le')]){const hits=[];guard.inspect('fixture.txt',data,hits);assert(hits.length>0);}
for(const file of ['diagnostic.exe','diagnostic.dll','diagnostic.bat','diagnostic.cmd','diagnostic.ps1'])assert.equal(guard.projectPathIssue(file),'platform-specific file');
assert.equal(guard.projectPathIssue('nested/.git',true),'nested Git metadata');
assert.equal(guard.projectPathIssue('frontend/public/api/index.php'),'unexpected public PHP');
assert.equal(guard.projectPathIssue('router.php'),'development router outside tools/dev');
assert.equal(guard.projectPathIssue('tools/dev/router.php'),null);
assert.equal(guard.projectPathIssue('frontend/public/api/api.php'),null);
assert.equal(guard.projectPathIssue('frontend/public/api/entry.php'),null);
const le=Buffer.from(name,'utf16le'),be=Buffer.alloc(le.length);for(let i=0;i<le.length;i+=2){be[i]=le[i+1];be[i+1]=le[i];}
const beHits=[];guard.inspect('fixture.txt',be,beHits);assert(beHits.length>0);
const dir=temp();
try{
 fs.writeFileSync(path.join(dir,'fixture.txt'),name);assert.equal(guard.scanTree(dir).findings.length,1);
 fs.unlinkSync(path.join(dir,'fixture.txt'));fs.writeFileSync(path.join(dir,name+'.txt'),'safe');assert.equal(guard.scanTree(dir).findings.length,1);
 fs.unlinkSync(path.join(dir,name+'.txt'));
 for(const ignored of ['scratch','tmp','temp']){
  const folder=path.join(dir,ignored);fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'fixture.txt'),name);
 }
 assert.equal(guard.scanTree(dir).findings.length,0,'Ignored temporary directories must not be treated as project content');
 const office=path.join(dir,'fixture.docx');
 execFileSync('php',['-r',"$z=new ZipArchive();$z->open(getenv('ZIP'),ZipArchive::CREATE);$z->addFromString('word/document.xml',getenv('TEXT'));$z->close();"],{env:{...process.env,ZIP:office,TEXT:name}});
 const nested=[];guard.inspect('fixture.docx',fs.readFileSync(office),nested);assert(nested.some(hit=>hit.includes('word/document.xml')));
 if(process.platform!=='win32'){
  const word=String.fromCodePoint(109,97,110,102,114,101,100);
  const stream=`BT /F1 12 Tf 72 720 Td (${word}) Tj ET`;
  const objects=[
   '<< /Type /Catalog /Pages 2 0 R >>',
   '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
   '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
   `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
   '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const hits=[];guard.inspect('fixture.pdf',Buffer.from(pdf),hits);assert(hits.some(hit=>hit.includes('PDF text')));
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
guard.enforce(guard.scanTree(),'Working tree');
console.log('Isolation positive controls passed (Unicode, UTF-8/UTF-16/Latin-1, variants, paths and nested Office content).');
