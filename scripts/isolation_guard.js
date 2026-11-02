'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const tokens = [[109,97,110,102,114,101,100],[98,117,101,104,108,101,114],[98,117,104,108,101,114]].map(c => String.fromCodePoint(...c));
function normalize(text) {
  return text.normalize('NFKD').toLowerCase().replace(/u\u0308/g, 'ue').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');
}
function matches(text) { const n = normalize(text); return tokens.some(t => n.includes(t)); }
function projectPathIssue(relative, isDirectory = false) {
  const name = relative.replaceAll('\\', '/');
  if (name.endsWith('/.git')) return 'nested Git metadata';
  if (isDirectory) return null;
  if (/\.(?:exe|dll|bat|cmd|ps1)$/i.test(name)) return 'platform-specific file';
  if (/(^|\/)test_curl\.php$/i.test(name)) return 'temporary diagnostic';
  if (/(^|\/)(?:router|server_router)\.php$/i.test(name) && !name.startsWith('tools/dev/')) return 'development router outside tools/dev';
  if ((name.startsWith('frontend/public/') || name.startsWith('public/')) && /\.php$/i.test(name) && !['frontend/public/api/api.php', 'frontend/public/api/entry.php'].includes(name)) return 'unexpected public PHP';
  return null;
}
function utf16be(data) {
  const swapped=Buffer.allocUnsafe(data.length-data.length%2);
  for(let i=0;i<swapped.length;i+=2){swapped[i]=data[i+1];swapped[i+1]=data[i];}
  return swapped.toString('utf16le');
}
function zipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Invalid ZIP directory');
  const entries = [], count = buffer.readUInt16LE(eocd + 10);
  let pos = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const flags = buffer.readUInt16LE(pos + 8), method = buffer.readUInt16LE(pos + 10), size = buffer.readUInt32LE(pos + 20), expanded = buffer.readUInt32LE(pos + 24);
    const n = buffer.readUInt16LE(pos + 28), x = buffer.readUInt16LE(pos + 30), c = buffer.readUInt16LE(pos + 32), offset = buffer.readUInt32LE(pos + 42);
    const name = buffer.subarray(pos + 46, pos + 46 + n).toString('utf8');
    if (flags & 1 || expanded > 128 * 1024 * 1024) throw new Error('Encrypted or excessive ZIP entry');
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const compressed = buffer.subarray(start, start + size);
    const data = method === 0 ? compressed : method === 8 ? zlib.inflateRawSync(compressed, { maxOutputLength: 128 * 1024 * 1024 }) : null;
    if (!data || data.length !== expanded) throw new Error('Unsupported or corrupt ZIP entry');
    entries.push({ name, data }); pos += 46 + n + x + c;
  }
  return entries;
}
function inspect(name, data, findings, depth = 0) {
  if (matches(name)) findings.push(name + ': path');
  if (['utf8', 'utf16le', 'latin1'].some(encoding => matches(data.toString(encoding))) || matches(utf16be(data))) findings.push(name + ': content');
  const raw = data.toString('utf8');
  if (/\$2[ayb]\$\d{2}\$[A-Za-z0-9./]{53}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(raw)) findings.push(name + ': secret signature');
  if (/\.png$/i.test(name) && data.length > 8 && data.subarray(1,4).toString() === 'PNG') {
    for (let offset = 8; offset + 12 <= data.length;) {
      const length = data.readUInt32BE(offset), type = data.subarray(offset+4,offset+8).toString();
      const chunk = data.subarray(offset+8,offset+8+length);
      if (type === 'zTXt') {
        const zero = chunk.indexOf(0);
        if (zero >= 0 && matches(zlib.inflateSync(chunk.subarray(zero+2), {maxOutputLength: 8*1024*1024}).toString())) findings.push(name + ': compressed PNG text');
      }
      offset += 12 + length;
    }
  }
  if (/\.pdf$/i.test(name)) {
    const text = execFileSync('pdftotext', ['-', '-'], { input: data, maxBuffer: 32 * 1024 * 1024, timeout: 30000 }).toString();
    if (matches(text)) findings.push(name + ': PDF text');
  }
  if (/\.(zip|docx|xlsx|pptx)$/i.test(name)) {
    if (depth > 4) throw new Error('Archive nesting limit');
    for (const e of zipEntries(data)) inspect(name + '!' + e.name, e.data, findings, depth + 1);
  }
}
function scanTree(directory = root) {
  const findings = []; let files = 0;
  const runtime = new Set(['data', 'backups', 'dist-packages', 'scratch', 'tmp', 'temp', '.cache', 'coverage', 'test-results', '.nyc_output']);
  function walk(dir, relative = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relative ? relative + '/' + entry.name : entry.name;
      if (['node_modules', 'vendor'].includes(entry.name) || runtime.has(rel) || rel === '.git') continue;
      if (/^(?:config\/cms_config(?:\.local)?\.php|\.env(?:\..*)?)$/.test(rel)) continue;
      const full = path.join(dir, entry.name);
      const issue = projectPathIssue(rel, entry.isDirectory());
      if (issue) findings.push(rel + ': ' + issue);
      if (entry.name === '.git') continue;
      if (entry.isSymbolicLink()) throw new Error('Symlink requires explicit review: ' + rel);
      if (entry.isDirectory()) { if (matches(rel)) findings.push(rel + ': path'); walk(full, rel); }
      else { inspect(rel, fs.readFileSync(full), findings); files++; }
    }
  }
  walk(directory); return { files, findings };
}
function scanZip(file) {
  const findings = []; const entries = zipEntries(fs.readFileSync(file));
  for (const entry of entries) inspect(entry.name, entry.data, findings);
  return { files: entries.length, findings };
}
function enforce(result, label) {
  console.log(`${label}: ${result.files} files; isolation hits=${result.findings.length}`);
  if (result.findings.length) throw new Error(result.findings.join('\n'));
}
module.exports = { matches, normalize, projectPathIssue, inspect, zipEntries, scanTree, scanZip, enforce };
if (require.main === module) {
  try {
    enforce(scanTree(), 'Working tree');
    for (const file of process.argv.slice(2)) enforce(scanZip(file), path.basename(file));
  } catch (e) { console.error(e.message); process.exit(1); }
}
