'use strict';
const fs = require('fs'), path = require('path');
const { scanTree, enforce } = require('./isolation_guard');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'frontend/dist');
for (const file of ['index.html', 'api/api.php', 'licenses/raleway-OFL.txt', 'licenses/amatic-sc-OFL.txt']) if (!fs.existsSync(path.join(dist, file))) throw new Error('Missing build entry: ' + file);
enforce(scanTree(), 'Working tree including frontend/dist');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (/\.(sqlite|db)(?:-wal|-shm|-journal)?$|\.env|cms_config\.php|\.log$/i.test(entry.name)) throw new Error('Runtime file in build');
    if (/\.(js|html|css)$/.test(file)) {
      const text = fs.readFileSync(file, 'utf8');
      if (/\$2[ayb]\$\d{2}\$[A-Za-z0-9./]{53}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) throw new Error('Secret in client build');
      if (/fonts\.(?:googleapis|gstatic)\.com/i.test(text)) throw new Error('Remote font URL in client build');
    }
  }
}
walk(dist);
if (!fs.readdirSync(path.join(dist, 'assets')).some(name => name.endsWith('.woff2'))) throw new Error('Missing locally bundled font');
console.log('Build verified: API entry, isolation, runtime exclusions, client secret scan, local fonts.');
