'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {zipEntries,scanZip,enforce}=require('./isolation_guard');
const root=path.resolve(__dirname,'..');

function filesWithin(relative, prefix, result) {
  const absolute=path.join(root,relative);
  if (!fs.existsSync(absolute)) throw new Error('Required release input missing: '+relative);
  const stat=fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error('Symlink in release input: '+relative);
  if (stat.isFile()) {result.set(prefix,absolute);return;}
  if (!stat.isDirectory()) throw new Error('Unsupported release input: '+relative);
  for(const name of fs.readdirSync(absolute)) filesWithin(relative+'/'+name,prefix+'/'+name,result);
}

function expected(mode) {
  const result=new Map();
  const add=(p,zipPath=p)=>filesWithin(p,zipPath,result);
  if(mode==='source') {
    for(const p of ['bin','AGENTS.md','config/cms_config.sample.php','docs','frontend/src','frontend/public','frontend/index.html','frontend/package.json','frontend/package-lock.json','frontend/vite.config.js','lib','migrations','seeds','scripts','tests','frontend/tests','.gitattributes','.gitignore','README.md','package.json','package-lock.json','composer.json','composer.lock','data/.gitkeep','data/.htaccess']) add(p);
  } else if(mode==='deploy') {
    add('frontend/dist','webroot');
    for(const p of ['lib','bin','migrations','seeds','config/cms_config.sample.php','vendor','docs','data/.gitkeep']) add(p,'server/'+p);
  } else throw new Error('Unknown release mode.');
  return result;
}

function audit(zipPath,mode) {
  enforce(scanZip(zipPath),mode+' isolation');
  const entries=zipEntries(fs.readFileSync(zipPath));
  const listed=new Set();
  const allowedEmpty=new Set(mode==='source'?['data/','backups/']:['server/data/','server/backups/']);
  const forbidden=/(^|\/)(?:backend|node_modules|\.git|scratch|tmp|temp|sessions|\.cache|coverage|test-results|\.nyc_output)(\/|$)|(^|\/)\.env[^/]*$|(^|\/)cms_config\.php$|\.(?:sqlite3?|db3?)(?:-(?:wal|shm|journal))?$|(?:-wal|-shm|-journal)$|\.(?:log|key|pem|p12|pfx|bak|tmp|zip|exe|dll|bat|cmd|ps1|cache|lcov)$/i;
  const deployOnly=/(^|\/)(?:tests?|__tests__|fixtures?)(\/|$)|(^|\/)(?:router|server_router|test_curl)\.php$|(^|\/)(?:lockfinder|find_lock)(?:\.[^/]*)?$|(^|\/)\.coverage$/i;
  const publicPhp=mode==='source'?new Set(['frontend/public/api/api.php','frontend/public/api/entry.php']):new Set(['webroot/api/api.php','webroot/api/entry.php']);
  for(const entry of entries) {
    const name=entry.name;
    if(!name || name.includes('\\') || name.startsWith('/') || name.includes('\0') || name.split('/').includes('..') || listed.has(name)) throw new Error('Unsafe or duplicate ZIP entry: '+name);
    listed.add(name);
    if(forbidden.test(name)) throw new Error('Forbidden ZIP entry: '+name);
    if(mode==='deploy' && deployOnly.test(name)) throw new Error('Forbidden deploy ZIP entry: '+name);
    if(/\.php$/i.test(name) && (mode==='source'?name.startsWith('frontend/public/'):name.startsWith('webroot/')) && !publicPhp.has(name)) throw new Error('Unexpected public PHP entry: '+name);
  }
  const want=expected(mode);
  for(const entry of entries) {
    const name=entry.name;
    if(name.endsWith('/')) {
      if(!allowedEmpty.has(name) || entry.data.length!==0) throw new Error('Unexpected ZIP directory: '+name);
      continue;
    }
    if(mode==='source' && (name.startsWith('vendor/') || name.startsWith('frontend/dist/') || name.startsWith('backups/'))) throw new Error('Runtime file in source ZIP: '+name);
    if(mode==='deploy' && !/^(?:webroot\/|server\/(?:lib\/|vendor\/|bin\/|migrations\/|seeds\/|config\/cms_config\.sample\.php$|docs\/|data\/\.gitkeep$))/.test(name)) throw new Error('Entry outside deployment allowlist: '+name);
    if(mode==='deploy' && (/\.(?:jsx|tsx|ts)$/i.test(name) && name.startsWith('webroot/'))) throw new Error('Uncompiled source in webroot: '+name);
    if(mode==='deploy' && /^webroot\/[^/]+\.php$/i.test(name)) throw new Error('Public root PHP file: '+name);
    const source=want.get(name);
    if(!source) throw new Error('Unexpected ZIP file: '+name);
    const disk=fs.readFileSync(source);
    if(!crypto.createHash('sha256').update(entry.data).digest().equals(crypto.createHash('sha256').update(disk).digest())) throw new Error('ZIP differs from current source/build: '+name);
    const text=entry.data.toString('utf8');
    if(/\$2[ayb]\$\d{2}\$[A-Za-z0-9./]{53}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) throw new Error('Credential signature in ZIP entry: '+name);
  }
  for(const name of want.keys()) if(!listed.has(name)) throw new Error('Current source/build file missing in ZIP: '+name);
  for(const name of allowedEmpty) if(!listed.has(name)) throw new Error('Persistent directory marker missing: '+name);
  console.log(mode+' ZIP audit passed: '+want.size+' files byte-identical to current inputs; '+entries.length+' entries; no runtime data.');
  return {files:want.size,entries:entries.length};
}
module.exports={audit,expected};
if(require.main===module) {
  try {
    if(process.argv.length!==4) throw new Error('Usage: node scripts/release_audit.js source|deploy ZIP');
    audit(process.argv[3],process.argv[2]);
  } catch(e) {console.error(e.message);process.exitCode=1;}
}
