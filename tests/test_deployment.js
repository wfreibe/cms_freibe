'use strict';
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const {spawnSync, execFileSync} = require('child_process');
const root = path.resolve(__dirname, '..');
const remote = fs.readFileSync(path.join(root, 'scripts/deploy_remote.sh'), 'utf8');
const extraction = remote.match(/"\$php" -r '([\s\S]*?)' "\$archive" "\$stage"/)?.[1];
assert(extraction, 'Actual remote ZIP validator must be testable');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-deployment-'));
try {
  const entries = ['webroot/index.html', 'webroot/api/api.php', 'server/lib/Database.php', 'server/bin/migrate.php'];
  let counter = 0;
  function check(extra, success, symlink = false) {
    const zip = path.join(dir, (++counter)+'.zip');
    const output = path.join(dir, 'output-'+counter);
    fs.mkdirSync(output);
    const names = JSON.stringify([...entries, ...extra]);
    execFileSync('php', ['-r', '$z=new ZipArchive();$z->open($argv[1],ZipArchive::CREATE);foreach(json_decode($argv[2],true) as $n)$z->addFromString($n,"synthetic");if($argv[3]==="1")$z->setExternalAttributesName("webroot/link",ZipArchive::OPSYS_UNIX,0120777<<16);$z->close();', zip, names, symlink?'1':'0']);
    const result = spawnSync('php', ['-r', extraction, zip, output], {encoding:'utf8'});
    assert.equal(result.status === 0, success, extra.join(',')+' '+result.stderr);
    if (success) assert(fs.existsSync(path.join(output, 'webroot/index.html')));
    else assert.equal(fs.readdirSync(output).length, 0, 'Reject before extracting any files');
  }
  check(['server/data/.gitkeep', 'server/config/cms_config.sample.php'], true);
  for (const entry of ['../escape', 'webroot/../../escape', 'server/config/cms_config.php', 'server/data/content.sqlite', 'webroot/uploads/private.jpg', 'webroot/.env', 'server/sessions/session']) check([entry], false);
  check(['webroot/link'], false, true);
  console.log('Deployment validator passed: valid application, traversal, private data, active config, environment files and symlink rejection.');
} finally {
  fs.rmSync(dir, {recursive:true,force:true});
}
