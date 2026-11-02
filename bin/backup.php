<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';
try {
    $config = Database::getConfig();
    $path = $config['db_path'] ?? '';
    if (!$path || !is_file($path)) throw new RuntimeException('Explicit existing database path required.');
    $db = DatabaseMaintenance::open($path);
    if (in_array('--check', $argv, true)) {
        DatabaseMaintenance::verify($db);
        echo "integrity_check=ok; foreign_key_check=0\n";
    } else {
        $target = DatabaseMaintenance::backup($db, $config['backup_dir'] ?? '');
        echo "Backup verified: $target; integrity_check=ok; foreign_key_check=0\n";
    }
} catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . "\n"); exit(1); }
