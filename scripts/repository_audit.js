'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { inspect, matches } = require('./isolation_guard');

const defaultRoot = path.resolve(__dirname, '..');
const forbiddenPath = /(?:^|\/)(?:cms_config(?:\.local)?\.php|\.env(?:\.[^/]*)?|backups\/(?!\.gitkeep$)[^/]+|sessions\/|runtime\/|storage\/|uploads\/|dist-packages\/|node_modules\/|vendor\/|scratch\/)|\.(?:sqlite3?|db)(?:-(?:wal|shm|journal))?$|\.(?:log|bak|tmp|zip)$/i;
const tokenSignature = /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})/;

function git(root, args) {
  const result = spawnSync('git', ['-c', 'core.quotePath=false', '-C', root, ...args], {
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 30000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1' },
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args[0]} failed (exit ${result.status ?? 'unknown'})`);
  }
  return result.stdout;
}

function lines(buffer) {
  const value = buffer.toString('utf8').trim();
  return value ? value.split(/\r?\n/) : [];
}

function redactPath(file) {
  return matches(file) ? '[redacted tenant path]' : tokenSignature.test(file) ? '[redacted path]' : file;
}

function redactRef(ref) {
  return matches(ref) ? '[redacted tenant ref]' : tokenSignature.test(ref) ? '[redacted ref]' : ref;
}

function scanRepository(root = defaultRoot) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).toString('utf8').trim() !== 'false') {
    throw new Error('Full clone required for repository history audit');
  }
  if (lines(git(root, ['for-each-ref', '--format=%(refname)', 'refs/replace'])).length) {
    throw new Error('Git replacements are forbidden during repository history audit');
  }
  git(root, ['fsck', '--full', '--no-reflogs']);
  const refs = lines(git(root, ['for-each-ref', '--format=%(refname)']));
  const commits = lines(git(root, ['rev-list', '--all']));
  if (!refs.length || !commits.length) throw new Error('Repository has no reachable references');

  const objectRefs = new Map();
  for (const ref of refs) {
    for (const entry of lines(git(root, ['rev-list', '--objects', ref]))) {
      const oid = entry.split(' ', 1)[0];
      if (!objectRefs.has(oid)) objectRefs.set(oid, []);
      objectRefs.get(oid).push(ref);
    }
  }

  const findings = [];
  function add(file, category, oid, commit) {
    findings.push({ path: redactPath(file), category, object: oid, commit, refs: (objectRefs.get(oid) || []).map(redactRef) });
  }
  for (const ref of refs) {
    if (matches(ref)) findings.push({ path: '(reference name)', category: 'tenant reference', ref: redactRef(ref) });
    if (tokenSignature.test(ref)) findings.push({ path: '(reference name)', category: 'token signature', ref: '[redacted ref]' });
  }
  for (const target of lines(git(root, ['for-each-ref', '--format=%(symref)']))) {
    if (matches(target)) findings.push({ path: '(symbolic reference target)', category: 'tenant reference', ref: redactRef(target) });
  }
  const seenPaths = new Set(), blobIds = new Set();
  for (const commit of commits) {
    for (const entry of git(root, ['ls-tree', '-r', '-z', '--full-tree', commit]).toString('utf8').split('\0')) {
      if (!entry) continue;
      const separator = entry.indexOf('\t');
      if (separator < 0) throw new Error('Invalid Git tree entry');
      const [mode, type, oid] = entry.slice(0, separator).split(' ');
      const file = entry.slice(separator + 1);
      const key = oid + '\0' + file;
      if (seenPaths.has(key)) continue;
      seenPaths.add(key);
      if (type === 'commit' || mode === '160000') {
        add(file, 'submodule requires separate audit', oid, commit);
        continue;
      }
      if (type !== 'blob') throw new Error('Unexpected Git tree entry');
      blobIds.add(oid);
      const data = git(root, ['cat-file', 'blob', oid]);
      if (forbiddenPath.test(file)) add(file, 'forbidden tracked path', oid, commit);
      if (tokenSignature.test(data.toString('utf8'))) add(file, 'token signature', oid, commit);
      if (data.subarray(0, 64).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) add(file, 'LFS content requires separate audit', oid, commit);
      const hits = [];
      try { inspect(file, data, hits); }
      catch (_) { add(file, 'content inspection failed', oid, commit); }
      for (const hit of hits) add(file, hit.slice(hit.lastIndexOf(': ') + 2), oid, commit);
    }
  }
  for (const oid of commits) {
    const message = git(root, ['show', '-s', '--format=%B', oid]).toString('utf8');
    if (matches(message)) add('(commit message)', 'tenant reference', oid, oid);
    if (tokenSignature.test(message)) add('(commit message)', 'token signature', oid, oid);
    const hits = [];
    inspect('(commit message)', Buffer.from(message), hits);
    if (hits.some(hit => hit.endsWith(': secret signature'))) add('(commit message)', 'secret signature', oid, oid);
  }
  for (const ref of refs.filter(value => value.startsWith('refs/tags/'))) {
    const oid = git(root, ['rev-parse', ref]).toString('utf8').trim();
    if (git(root, ['cat-file', '-t', oid]).toString('utf8').trim() !== 'tag') continue;
    const message = git(root, ['cat-file', '-p', oid]).toString('utf8');
    if (matches(message)) findings.push({ path: '(tag message)', category: 'tenant reference', object: oid, ref: redactRef(ref) });
    if (tokenSignature.test(message)) findings.push({ path: '(tag message)', category: 'token signature', object: oid, ref: redactRef(ref) });
    const hits = [];
    inspect('(tag message)', Buffer.from(message), hits);
    if (hits.some(hit => hit.endsWith(': secret signature'))) findings.push({ path: '(tag message)', category: 'secret signature', object: oid, ref: redactRef(ref) });
  }
  return { refs, commits: commits.length, blobs: blobIds.size, findings };
}

function enforce(result) {
  console.log(`Repository history: ${result.refs.length} refs, ${result.commits} commits, ${result.blobs} blobs; findings=${result.findings.length}`);
  if (result.findings.length) {
    for (const finding of result.findings) console.error(JSON.stringify(finding));
    throw new Error('Repository history audit failed');
  }
}

module.exports = { scanRepository, enforce };
if (require.main === module) {
  try {
    enforce(scanRepository(process.argv[2] ? path.resolve(process.argv[2]) : defaultRoot));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
