/**
 * Deployment Package Generator for cms_sfreibe
 * 
 * Release-Prozess nach Audit-Vorgaben:
 * 1. Vor dem Deployment-Build wird frontend/dist kontrolliert vollständig entfernt.
 * 2. Der Frontend-Build wird bei jeder Erstellung zwingend neu ausgeführt.
 * 3. Bei einem Buildfehler wird kein Paket erzeugt (Abbruch).
 * 4. Build-Verifikation wird ausgeführt (scripts/verify_build.js).
 * 5. Erst nach erfolgreicher Verifikation wird das Deployment-Paket erstellt.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const frontendDir = path.join(projectRoot, 'frontend');
const distDir = path.join(frontendDir, 'dist');

console.log('====================================================================');
console.log('   CMS_SFREIBE - REPRODUCIBLE DEPLOYMENT PACKAGING                 ');
console.log('====================================================================\n');

try {
  // Step 1: Clean removal of existing dist directory
  console.log('1. Cleaning existing build directory (frontend/dist)...');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log('   [OK] Cleaned frontend/dist.');
  } else {
    console.log('   [OK] frontend/dist does not exist, ready for clean build.');
  }

  // Step 2: Fresh production frontend build
  console.log('\n2. Executing fresh production frontend build...');
  execSync('npm run build', {
    cwd: frontendDir,
    stdio: 'inherit'
  });

  // Step 3: Verify build artifacts
  console.log('\n3. Verifying freshly generated build artifacts...');
  execSync('node scripts/verify_build.js', {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  // Step 4: Ensure production Composer dependencies are installed without dev
  console.log('\n4. Verifying production vendor dependencies...');
  if (!fs.existsSync(path.join(projectRoot, 'vendor', 'autoload.php'))) {
    console.error('❌ ERROR: vendor/autoload.php not found. Run composer install first.');
    process.exit(1);
  }

  // Step 5: Assemble deployment package
  console.log('\n5. Assembling deployment package (scripts/packager.php deploy)...');
  execSync('php scripts/packager.php deploy', {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  console.log('\n🎉 Deployment package successfully built and verified!\n');
} catch (e) {
  console.error('\n❌ PACKAGING ABORTED DUE TO ERROR.');
  process.exit(1);
}

const guard = require('./isolation_guard');
guard.enforce(guard.scanTree(), 'Working tree');
guard.enforce(guard.scanZip(require('path').join(__dirname, '../dist-packages/cms_sfreibe-deploy.zip')), 'Release ZIP');
