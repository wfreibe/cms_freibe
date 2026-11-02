'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { snapshot, assertManifest, assertUnchanged } = require('./git_release_gate');
const { audit } = require('./release_audit');
const { zipEntries } = require('./isolation_guard');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist-packages');
const names = ['cms_sfreibe-source.zip', 'cms_sfreibe-deploy.zip'];

try {
  const state = snapshot(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'release-manifest.json'), 'utf8'));
  assertManifest(root, state, manifest);
  if (!Array.isArray(manifest.tests) || !manifest.tests.length || manifest.tests.some(test => test.exitCode !== 0)) {
    throw new Error('Release manifest contains missing or failed checks');
  }
  const checksums = [];
  for (const name of names) {
    const file = path.join(output, name);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (manifest.zipSha256?.[name] !== hash) throw new Error(`Release checksum mismatch: ${name}`);
    audit(file, name.includes('source') ? 'source' : 'deploy');
    checksums.push(`${hash}  ${name}`);
  }
  if (fs.readFileSync(path.join(output, 'SHA256SUMS'), 'utf8') !== checksums.join('\n') + '\n') {
    throw new Error('SHA256SUMS differs from verified release packages');
  }
  const sourceEntries = new Set(zipEntries(fs.readFileSync(path.join(output, names[0]))).map(entry => entry.name));
  for (const name of ['scripts/repository_audit.js', 'tests/test_repository_audit.js', 'tests/test_git_release_gate.js', '.github/workflows/ci.yml']) {
    if (!sourceEntries.has(name)) throw new Error(`Required source entry missing: ${name}`);
  }
  for (const name of ['verification-commands.json', 'verification.log']) {
    if (!fs.statSync(path.join(output, name)).isFile()) throw new Error(`Release evidence missing: ${name}`);
  }
  assertUnchanged(root, state);
  console.log(`Release output verified for ${state.head}`);
} catch (error) {
  console.error(`Release output verification failed: ${error.message}`);
  process.exitCode = 1;
}
