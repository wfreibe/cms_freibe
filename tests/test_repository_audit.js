'use strict';

const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const os = require('os');
const { fs, path, temp } = require('./helpers');
const { scanRepository } = require('../scripts/repository_audit');

const tenant = String.fromCodePoint(66, 252, 104, 108, 101, 114);
const variants = [
  [98, 252, 104, 108, 101, 114],
  [98, 117, 101, 104, 108, 101, 114],
  [98, 117, 104, 108, 101, 114],
  [109, 98, 117, 101, 104, 108, 101, 114],
  [99, 109, 115, 95, 109, 98, 117, 101, 104, 108, 101, 114],
  [109, 97, 110, 102, 114, 101, 100],
].map(codes => String.fromCodePoint(...codes));

function withRepository(test) {
  const root = temp();
  function git(...args) {
    return execFileSync('git', ['-C', root, ...args], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Synthetic Test',
        GIT_AUTHOR_EMAIL: 'test@example.invalid',
        GIT_COMMITTER_NAME: 'Synthetic Test',
        GIT_COMMITTER_EMAIL: 'test@example.invalid',
      },
      stdio: 'pipe',
    }).toString('utf8').trim();
  }
  try {
    git('init', '-q');
    fs.writeFileSync(path.join(root, 'safe.txt'), 'safe fixture');
    git('add', '.');
    git('commit', '-qm', 'safe commit');
    assert.equal(scanRepository(root).findings.length, 0);
    test({ root, git });
  } finally {
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      throw new Error('Refusing to remove test directory outside temporary root');
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

for (const value of variants) {
  withRepository(({ root, git }) => {
    git('branch', `fixture/${value}`);
    const findings = scanRepository(root).findings;
    assert(findings.some(f => f.path === '(reference name)' && f.category === 'tenant reference'));
    assert(!JSON.stringify(findings).includes(value));
  });
}

const cases = [
  ['remote branch', ({ git }) => git('update-ref', `refs/remotes/origin/${tenant}`, 'HEAD'), '(reference name)'],
  ['lightweight tag', ({ git }) => git('tag', `fixture-${tenant}`), '(reference name)'],
  ['annotated tag name', ({ git }) => git('tag', '-a', `annotated-${tenant}`, '-m', 'safe tag'), '(reference name)'],
  ['annotated tag message', ({ git }) => git('tag', '-a', 'safe-tag', '-m', tenant), '(tag message)'],
  ['commit message', ({ git }) => git('commit', '--allow-empty', '-qm', tenant), '(commit message)'],
  ['file path', ({ root, git }) => {
    fs.writeFileSync(path.join(root, `${tenant}.txt`), 'safe fixture');
    git('add', '.'); git('commit', '-qm', 'add fixture');
  }, '[redacted tenant path]'],
  ['historical content', ({ root, git }) => {
    fs.writeFileSync(path.join(root, 'historical.txt'), tenant);
    git('add', '.'); git('commit', '-qm', 'add fixture');
    fs.unlinkSync(path.join(root, 'historical.txt'));
    git('add', '-u'); git('commit', '-qm', 'remove fixture');
  }, 'historical.txt'],
];

for (const [label, setup, expectedPath] of cases) {
  withRepository(context => {
    setup(context);
    const findings = scanRepository(context.root).findings;
    assert(findings.some(f => f.path === expectedPath), `${label} was not detected`);
    assert(!JSON.stringify(findings).includes(tenant), `${label} was not redacted`);
  });
}

withRepository(({ root, git }) => {
  const first = git('rev-parse', 'HEAD');
  git('commit', '--allow-empty', '-qm', 'second safe commit');
  git('replace', 'HEAD', first);
  assert.throws(() => scanRepository(root), /replacements are forbidden/);
});

withRepository(({ root, git }) => {
  const signature = ['$2y$10$', 'A'.repeat(53)].join('');
  fs.writeFileSync(path.join(root, 'signature.txt'), signature);
  git('add', '.'); git('commit', '-qm', 'signature fixture');
  const findings = scanRepository(root).findings;
  assert(findings.some(f => f.path === 'signature.txt' && f.category === 'secret signature'));
  assert(!JSON.stringify(findings).includes(signature));
});

console.log('Repository audit reference, history, replacement, and secret controls passed.');
