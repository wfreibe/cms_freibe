<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';
try {
    $config = Database::getConfig();
    $path = $config['db_path'] ?? '';
    if (!$path || !is_file($path)) throw new RuntimeException('Explicit existing database path required.');
    $db = DatabaseMaintenance::open($path);
    $count = DatabaseMaintenance::pruneOrphans($db, $config['backup_dir'] ?? '');
    echo "Archived and removed: $count\n";
} catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . "\n"); exit(1); }
