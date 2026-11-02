'use strict';

const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const os = require('os');
const { fs, path, temp } = require('./helpers');
const { snapshot, assertUnchanged, assertManifest } = require('../scripts/git_release_gate');
const { scanRepository } = require('../scripts/repository_audit');

const roots = [];
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Synthetic Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Synthetic Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { env, stdio: 'pipe' }).toString('utf8').trim();
}

function repo() {
  const root = temp(); roots.push(root);
  git(root, 'init', '-q');
  fs.writeFileSync(path.join(root, 'safe.txt'), 'safe fixture');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'safe commit');
  return root;
}

try {
  {
    const root = repo();
    const state = snapshot(root);
    assert.equal(state.head, git(root, 'rev-parse', 'HEAD'));
    assert.equal(state.workingTreeClean, true);
    assertUnchanged(root, state);
    assertManifest(root, state, { gitCommit: state.head, workingTreeClean: true });
  }
  {
    const root = repo();
    fs.writeFileSync(path.join(root, 'safe.txt'), 'changed fixture');
    assert.throws(() => snapshot(root), /clean Git working tree/);
  }
  {
    const root = repo();
    fs.writeFileSync(path.join(root, 'stray.txt'), 'untracked');
    assert.throws(() => snapshot(root), /clean Git working tree/);
  }
  {
    const root = repo();
    fs.writeFileSync(path.join(root, '.gitignore'), 'runtime/\n');
    git(root, 'add', '.gitignore'); git(root, 'commit', '-qm', 'ignore runtime');
    fs.mkdirSync(path.join(root, 'runtime'));
    fs.writeFileSync(path.join(root, 'runtime', 'cache.tmp'), 'ignored');
    assert.equal(snapshot(root).workingTreeClean, true);
  }
  assert.throws(() => snapshot(path.join(os.tmpdir(), 'cms_sfreibe_nonexistent_git_fixture')), /Git check failed/);
  {
    const root = repo();
    git(root, 'commit', '--allow-empty', '-qm', 'second safe commit');
    const parent = temp(); roots.push(parent);
    const shallow = path.join(parent, 'shallow');
    execFileSync('git', ['clone', '-q', '--depth=1', pathToFileURL(root).href, shallow], { env, stdio: 'pipe' });
    assert.throws(() => snapshot(shallow), /full Git clone/);
    assert.throws(() => scanRepository(shallow), /Full clone required/);
  }
  {
    const root = repo();
    const state = snapshot(root);
    git(root, 'commit', '--allow-empty', '-qm', 'new HEAD');
    assert.throws(() => assertUnchanged(root, state), /HEAD changed/);
  }
  {
    const root = repo();
    const ancestor = git(root, 'rev-parse', 'HEAD');
    git(root, 'commit', '--allow-empty', '-qm', 'current HEAD');
    const state = snapshot(root);
    assert.throws(() => assertManifest(root, state, { gitCommit: ancestor, workingTreeClean: true }), /manifest does not match/);
    assert.throws(() => assertManifest(root, state, { gitCommit: state.head, workingTreeClean: false }), /manifest does not match/);
  }
  console.log('Git release gate clean, dirty, shallow, HEAD-change, and manifest controls passed.');
} finally {
  for (const root of roots) {
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      throw new Error('Refusing to remove test directory outside temporary root');
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
