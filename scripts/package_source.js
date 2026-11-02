/**
 * Source Package Generator for cms_sfreibe
 * 
 * Invokes scripts/packager.php source and performs post-packaging verification.
 */

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

try {
  execSync('php scripts/packager.php source', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} catch (e) {
  process.exit(1);
}

const guard = require('./isolation_guard');
guard.enforce(guard.scanTree(), 'Working tree');
guard.enforce(guard.scanZip(require('path').join(__dirname, '../dist-packages/cms_sfreibe-source.zip')), 'Release ZIP');
