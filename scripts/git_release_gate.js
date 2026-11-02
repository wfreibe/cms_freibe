'use strict';

const { spawnSync } = require('child_process');

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1' },
  });
  if (result.error || result.status !== 0) throw new Error(`Git check failed: ${args[0]}`);
  return result.stdout.trim();
}

function snapshot(root) {
  if (git(root, ['status', '--porcelain']) !== '') throw new Error('Release requires a clean Git working tree');
  const verified = git(root, ['rev-parse', '--verify', 'HEAD']);
  const head = git(root, ['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40,64}$/.test(head) || head !== verified) throw new Error('Release HEAD is invalid');
  if (git(root, ['rev-parse', '--is-shallow-repository']) !== 'false') throw new Error('Release requires a full Git clone');
  git(root, ['cat-file', '-e', `${head}^{commit}`]);
  return Object.freeze({ head, workingTreeClean: true });
}

function assertUnchanged(root, initial) {
  const current = snapshot(root);
  if (current.head !== initial.head) throw new Error('Release HEAD changed during verification');
  return current;
}

function assertManifest(root, initial, manifest) {
  assertUnchanged(root, initial);
  if (manifest.workingTreeClean !== true || manifest.gitCommit !== initial.head) {
    throw new Error('Release manifest does not match the clean release HEAD');
  }
  git(root, ['cat-file', '-e', `${manifest.gitCommit}^{commit}`]);
}

module.exports = { snapshot, assertUnchanged, assertManifest };
