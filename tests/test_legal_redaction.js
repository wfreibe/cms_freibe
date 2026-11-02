'use strict';
const assert = require('assert/strict');
const { fs, path, root, run, php, temp, hash } = require('./helpers');
const { matches } = require('../scripts/isolation_guard');

const dir = temp();
const db = path.join(dir, 'content.sqlite');
const backupDir = path.join(dir, 'backups');
const config = path.join(dir, 'config.php');
const marker = String.fromCodePoint(77, 97, 110, 102, 114, 101, 100);
fs.mkdirSync(backupDir);
fs.writeFileSync(config, '<?php return [];');
const env = { ...process.env, CMS_CONFIG_PATH: config, CMS_DB_PATH: db, CMS_BACKUP_DIR: backupDir };
const read = () => JSON.parse(php("$d=new PDO('sqlite:'.getenv('DB'),null,null,[PDO::SQLITE_ATTR_OPEN_FLAGS=>PDO::SQLITE_OPEN_READONLY]);echo json_encode(['sections'=>$d->query('SELECT * FROM sections ORDER BY id,lang')->fetchAll(PDO::FETCH_ASSOC),'accordions'=>$d->query('SELECT * FROM section_accordions ORDER BY id,lang')->fetchAll(PDO::FETCH_ASSOC),'integrity'=>$d->query('PRAGMA integrity_check')->fetchColumn(),'fk'=>$d->query('PRAGMA foreign_key_check')->fetchAll(PDO::FETCH_ASSOC)],JSON_UNESCAPED_UNICODE);", { DB: db }));
try {
  run('php', ['bin/migrate.php'], { env });
  run('php',['bin/seed.php','--confirm-seed'],{env:{...env,CMS_ENV:'test'}});
  php("$d=new PDO('sqlite:'.getenv('DB'));$d->prepare(\"UPDATE sections SET content=?,is_active=0,is_published=0 WHERE id IN ('impressum','datenschutz')\")->execute([getenv('MARKER')]);", { DB: db, MARKER: marker });
  const before = read();
  const originalHash = hash(db);
  run('php', ['bin/redact_legal.php', '--preview'], { env });
  assert.equal(hash(db), originalHash, 'preview changed database');

  const blocked = path.join(dir, 'blocked');
  fs.writeFileSync(blocked, 'not a directory');
  assert.throws(() => run('php', ['bin/redact_legal.php', '--apply', '--maintenance'], { env: { ...env, CMS_BACKUP_DIR: blocked } }));
  assert.equal(hash(db), originalHash, 'backup failure changed database');

  run('php', ['bin/redact_legal.php', '--apply', '--maintenance'], { env });
  const after = read();
  const other = rows => rows.sections.filter(s => !['impressum', 'datenschutz'].includes(s.id));
  assert.deepEqual(other(after), other(before));
  assert.deepEqual(after.accordions, before.accordions);
  assert.equal(after.sections.length, before.sections.length);
  const legal = after.sections.filter(s => ['impressum', 'datenschutz'].includes(s.id));
  assert.equal(legal.length, 4);
  assert(legal.every(s => s.content === '' && Number(s.is_active) === 0 && Number(s.is_published) === 0));
  assert.equal(after.integrity, 'ok');
  assert.deepEqual(after.fk, []);
  assert(!matches(fs.readFileSync(db).toString('latin1')), 'deleted text remains in active SQLite pages');

  const backups = fs.readdirSync(backupDir).filter(name => name.startsWith('cms_sfreibe_pre_legal_redaction_'));
  assert.equal(backups.length, 1);
  assert(matches(fs.readFileSync(path.join(backupDir, backups[0])).toString('latin1')), 'rollback backup lacks prior text');
  console.log('Legal redaction: 4 drafts cleared, all other rows identical, backup failure aborts, verified backup retained, active DB byte scan clean, integrity=ok, FK=0.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
