<?php
/**
 * Clean Packaging Worker for cms_sfreibe
 * 
 * Supports two distinct packaging modes:
 * 1. 'source': Full source code, composer files, migrations, seed, tests, sample config, docs.
 * 2. 'deploy': Production-only build artifacts (frontend/dist), server lib/bin/migrations, vendor (no-dev), sample config, docs.
 * 
 * Both modes strictly exclude:
 * - node_modules
 * - SQLite databases (*.sqlite, *.db) & WAL/SHM sidecars
 * - Backups & scratch directories
 * - Active production secrets & cms_config.php
 * - Logs and temporary test artifacts
 * - Root-level PHP files in the public webroot (e.g. /entry.php)
 * 
 * Usage:
 *   php scripts/packager.php source
 *   php scripts/packager.php deploy
 */

declare(strict_types=1);

$mode = $argv[1] ?? '';
if (!in_array($mode, ['source', 'deploy'], true)) {
    fwrite(STDERR, "Usage: php scripts/packager.php [source|deploy]\n");
    exit(1);
}

$projectRoot = dirname(__DIR__);
$outputDir = $projectRoot . '/dist-packages';
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0750, true);
}

$zipFileName = ($mode === 'source') ? 'cms_sfreibe-source.zip' : 'cms_sfreibe-deploy.zip';
$finalZipPath = $outputDir . '/' . $zipFileName;
$zipFilePath = $outputDir . '/pending-' . $zipFileName;
passthru('node ' . escapeshellarg(__DIR__ . '/isolation_guard.js'), $guardExit);
if ($guardExit !== 0) exit(1);

if (file_exists($zipFilePath)) {
    @unlink($zipFilePath);
}

$zip = new ZipArchive();
if ($zip->open($zipFilePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "ERROR: Failed to create ZIP file at {$zipFilePath}\n");
    exit(1);
}

// Global blacklist across all archives
$FORBIDDEN_PATTERNS = [
    '#node_modules#i',
    '#(^|/)\.git(/|$)#i',
    '#\.(sqlite|db)(-wal|-shm|-journal)?$#i',
    '#(^|/)cms_config\.php$#i',
    '#(^|/)\.env#i',
    '#(^|/)sessions(/|$)#i',
    '#(^|/)backups(/|$)#i',
    '#(^|/)scratch(/|$)#i',
    '#(^|/)dist-packages(/|$)#i',
    '#\.(log|bak|tmp)$#i',
    '#\.zip$#i',
    '#(^|/)tests/temp_#i',
];

function isForbidden(string $relPath, array $patterns): bool
{
    $norm = str_replace('\\', '/', $relPath);
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $norm)) {
            return true;
        }
    }
    return false;
}

$fileCount = 0;

if ($mode === 'source') {
    echo "Creating SOURCE package: {$zipFileName}...\n";

    // Define source directories and files to include
    $includePaths = [
        'bin',
        'AGENTS.md',
        'config/cms_config.sample.php',
        'docs',
        'frontend/src',
        'frontend/public',
        'frontend/index.html',
        'frontend/package.json',
        'frontend/package-lock.json',
        'frontend/vite.config.js',
        'lib',
        'migrations',
        'seeds',
        'scripts',
        'tests',
        'frontend/tests',
        '.gitattributes',
        '.gitignore',
        'README.md',
        'filezilla.md',
        'package.json',
        'package-lock.json',
        'composer.json',
        'composer.lock',
        'data/.gitkeep',
        'data/.htaccess',
        'backups/.gitkeep'
    ];

    $sourcePatterns = array_merge($FORBIDDEN_PATTERNS, [
        '#(^|/)vendor(/|$)#i',
        '#(^|/)frontend/dist(/|$)#i',
        '#(^|/)frontend/public/entry\.php$#i',
    ]);

    foreach ($includePaths as $item) {
        $abs = $projectRoot . '/' . $item;
        if (!file_exists($abs)) continue;

        if (is_file($abs)) {
            if (!isForbidden($item, $sourcePatterns)) {
                $zip->addFile($abs, $item);
                $fileCount++;
            }
        } elseif (is_dir($abs)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($abs, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $rel = substr($file->getPathname(), strlen($projectRoot) + 1);
                    $normRel = str_replace('\\', '/', $rel);
                    if (!isForbidden($normRel, $sourcePatterns)) {
                        $zip->addFile($file->getPathname(), $normRel);
                        $fileCount++;
                    }
                }
            }
        }
    }

} else { // deploy mode
    echo "Creating DEPLOYMENT package: {$zipFileName}...\n";

    $distDir = $projectRoot . '/frontend/dist';
    if (!is_dir($distDir)) {
        fwrite(STDERR, "ERROR: frontend/dist does not exist. Run 'npm run build' first.\n");
        exit(1);
    }

    $deployPatterns = array_merge($FORBIDDEN_PATTERNS, [
        '#(^|/)tests(/|$)#i',
        '#(^|/)backend(/|$)#i',
        '#\.(ts|tsx|jsx)$#i',
        '#(^|/)webroot/[^/]+\.php$#i' // Strictly no PHP file in root of webroot! (only webroot/api/*.php)
    ]);

    // 1. Add compiled public webroot files from frontend/dist
    $distIterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($distDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($distIterator as $file) {
        if ($file->isFile()) {
            $rel = substr($file->getPathname(), strlen($distDir) + 1);
            $normRel = str_replace('\\', '/', $rel);

            // Reject any root-level PHP file in webroot
            if (preg_match('/^[^\/]+\.php$/i', $normRel)) {
                fwrite(STDERR, "ERROR: Unexpected root-level PHP file in webroot: {$normRel}. Only dist/api/*.php is allowed.\n");
                exit(1);
            }

            $zipPath = 'webroot/' . $normRel;
            if (!isForbidden($zipPath, $deployPatterns)) {
                $zip->addFile($file->getPathname(), $zipPath);
                $fileCount++;
            }
        }
    }

    // 2. Add non-public server files (lib, bin, migrations, vendor, sample config, docs)
    $serverIncludes = [
        'lib',
        'bin',
        'migrations',
        'seeds',
        'config/cms_config.sample.php',
        'vendor',
        'docs',
        'data/.gitkeep',
        'backups/.gitkeep'
    ];

    foreach ($serverIncludes as $item) {
        $abs = $projectRoot . '/' . $item;
        if (!file_exists($abs)) continue;

        if (is_file($abs)) {
            $zipPath = 'server/' . $item;
            if (!isForbidden($zipPath, $deployPatterns)) {
                $zip->addFile($abs, $zipPath);
                $fileCount++;
            }
        } elseif (is_dir($abs)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($abs, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $rel = substr($file->getPathname(), strlen($projectRoot) + 1);
                    $normRel = str_replace('\\', '/', $rel);
                    $zipPath = 'server/' . $normRel;
                    if (!isForbidden($zipPath, $deployPatterns)) {
                        $zip->addFile($file->getPathname(), $zipPath);
                        $fileCount++;
                    }
                }
            }
        }
    }
}

$zip->addEmptyDir($mode === 'deploy' ? 'server/data' : 'data');
$zip->addEmptyDir($mode === 'deploy' ? 'server/backups' : 'backups');
$zip->close();

echo "Package written ({$fileCount} files, " . number_format(filesize($zipFilePath)) . " bytes).\n";
echo "Performing mandatory post-packaging security audit of {$zipFileName}...\n";

// MANDATORY POST-PACKAGING AUDIT: Re-open ZIP and inspect EVERY entry
$verifyZip = new ZipArchive();
if ($verifyZip->open($zipFilePath) !== true) {
    fwrite(STDERR, "ERROR: Could not re-open generated ZIP file for auditing!\n");
    exit(1);
}

$violations = [];
$essentialCheck = [
    'has_sample_config' => false,
    'has_index_html' => false,
    'has_api_php' => false,
    'has_readme' => false
];

for ($i = 0; $i < $verifyZip->numFiles; $i++) {
    $stat = $verifyZip->statIndex($i);
    $entryName = str_replace('\\', '/', $stat['name']);

    // Check against forbidden patterns
    if (!str_ends_with($entryName, '/') && isForbidden($entryName, $FORBIDDEN_PATTERNS)) {
        $violations[] = "Forbidden file detected in archive: {$entryName}";
    }

    if ($mode === 'deploy') {
        if (!preg_match('#^(webroot/|server/(?:lib/|vendor/|bin/|migrations/|seeds/|config/cms_config\.sample\.php$|docs/|data/|backups/))#', $entryName)) {
            $violations[] = "Unexpected deployment entry: {$entryName}";
        }
        if (preg_match('#(^|/)tests(/|$)#i', $entryName)) {
            $violations[] = "Test file detected in deployment archive: {$entryName}";
        }
        // Check for root PHP file in webroot
        if (preg_match('#^webroot/[^/]+\.php$#i', $entryName)) {
            $violations[] = "Unexpected PHP file in webroot root: {$entryName} (only webroot/api/*.php permitted)";
        }
    }

    if ($mode === 'source') {
        if (str_starts_with($entryName, 'backend/')) {
            $violations[] = "Retired backend detected in source archive: {$entryName}";
        }
        if (str_starts_with($entryName, 'vendor/')) {
            $violations[] = "Vendor directory must not be in source archive: {$entryName}";
        }
        if (str_starts_with($entryName, 'frontend/dist/')) {
            $violations[] = "frontend/dist must not be in source archive: {$entryName}";
        }
    }

    if (str_contains($entryName, 'cms_config.sample.php')) {
        $essentialCheck['has_sample_config'] = true;
    }
    if (str_ends_with($entryName, 'index.html')) {
        $essentialCheck['has_index_html'] = true;
    }
    if (str_ends_with($entryName, 'api/api.php')) {
        $essentialCheck['has_api_php'] = true;
    }
    if (str_ends_with($entryName, 'README.md')) {
        $essentialCheck['has_readme'] = true;
    }
}

$verifyZip->close();

if (!empty($violations)) {
    fwrite(STDERR, "\n❌ PACKAGE AUDIT FAILED with " . count($violations) . " violation(s):\n");
    foreach ($violations as $v) {
        fwrite(STDERR, "  - {$v}\n");
    }
    @unlink($zipFilePath);
    exit(1);
}

if ($mode === 'deploy') {
    if (!$essentialCheck['has_index_html'] || !$essentialCheck['has_api_php']) {
        fwrite(STDERR, "❌ ERROR: Deployment package missing essential entry files (index.html or api/api.php)!\n");
        @unlink($zipFilePath);
        exit(1);
    }
}

if (!$essentialCheck['has_sample_config']) {
    fwrite(STDERR, "❌ ERROR: Package missing config/cms_config.sample.php!\n");
    @unlink($zipFilePath);
    exit(1);
}

passthru('node ' . escapeshellarg(__DIR__ . '/isolation_guard.js') . ' ' . escapeshellarg($zipFilePath), $guardExit);
if ($guardExit !== 0) { unlink($zipFilePath); exit(1); }
passthru('node ' . escapeshellarg(__DIR__ . '/release_audit.js') . ' ' . escapeshellarg($mode) . ' ' . escapeshellarg($zipFilePath), $auditExit);
if ($auditExit !== 0) { unlink($zipFilePath); exit(1); }
if (!rename($zipFilePath, $finalZipPath)) { unlink($zipFilePath); exit(1); }

echo "✅ SUCCESS: {$zipFileName} passed all security and completeness audits.\n";
echo "   - No node_modules\n";
echo "   - No SQLite databases or sidecars (*.sqlite, *.db, *-wal, *-shm)\n";
echo "   - No active cms_config.php or .env secrets\n";
echo "   - No backups or scratch files\n";
echo "   - No root-level PHP files in webroot (/entry.php strictly prevented)\n";
echo "   - All required files verified present.\n\n";
exit(0);
