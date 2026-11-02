<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit(1); }
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';
try {
    if ($argc !== 1) throw new RuntimeException('Usage: php bin/migrate.php (schema only; no seed or data cleanup options).');
    $config = Database::getConfig();
    $path = $config['db_path'] ?? '';
    if (!is_string($path) || $path === '') throw new RuntimeException('Explicit database path required.');
    $existed = file_exists($path);
    if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0700, true)) throw new RuntimeException('Cannot create database directory.');
    PrivateStorage::directory(dirname($path));
    $db = DatabaseMaintenance::open($path);
    PrivateStorage::file($path);
    $hasVersions = (bool)$db->query("SELECT 1 FROM sqlite_master WHERE name='schema_migrations'")->fetchColumn();
    $applied = $hasVersions ? array_map('intval', $db->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN)) : [];
    $directory = getenv('CMS_MIGRATIONS_DIR') ?: dirname(__DIR__) . '/migrations';
    $pending = [];
    foreach (glob($directory . '/*.sql') as $file) {
        if (!preg_match('/^(\d+)_/', basename($file), $match)) continue;
        $version = (int)$match[1];
        if (!in_array($version, $applied, true)) $pending[$version] = $file;
    }
    ksort($pending);
    if (!$pending) {
        DatabaseMaintenance::verify($db);
        echo "Database is already up-to-date. integrity_check=ok; foreign_key_check=0\n";
        exit(0);
    }
    // No metadata or content changes until a verified backup exists.
    if ($existed && filesize($path) > 0) {
        $backup = DatabaseMaintenance::backup($db, $config['backup_dir'] ?? '', 'pre_migration');
        echo "Pre-migration backup verified: $backup\n";
    }
    if ((isset($pending[4]) || isset($pending[7])) && (int)$db->query("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('sections','section_accordions')")->fetchColumn() === 2) {
        $count = (int)$db->query('SELECT COUNT(*) FROM section_accordions a LEFT JOIN sections s ON s.id=a.section_id AND s.lang=a.lang WHERE s.id IS NULL')->fetchColumn();
        if ($count) {
            throw new RuntimeException('Orphaned accordions found; resolve them separately before schema migration. No records were removed.');
        }
    }
    // SQLite foreign_keys cannot change inside a transaction. Restore enforcement after the rebuild.
    $db->exec('PRAGMA foreign_keys=OFF');
    $db->beginTransaction();
    try {
        $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        foreach ($pending as $version => $file) {
            $sql = file_get_contents($file);
            if ($sql === false) throw new RuntimeException('Cannot read migration.');
            $db->exec($sql);
            $db->prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)')->execute([$version]);
            echo 'Applied ' . basename($file) . "\n";
        }
        DatabaseMaintenance::verify($db);
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
    $db->exec('PRAGMA foreign_keys=ON');
    DatabaseMaintenance::verify($db);
    PrivateStorage::file($path);
    foreach (['-wal', '-shm', '-journal'] as $suffix) if (is_file($path . $suffix)) PrivateStorage::file($path . $suffix);
    echo "SUCCESS: integrity_check=ok; foreign_key_check=0\n";
} catch (Throwable $e) { fwrite(STDERR, 'MIGRATION ERROR: ' . $e->getMessage() . "\n"); exit(1); }
