<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';
try {
    if (!in_array('--maintenance', $argv, true) || empty($argv[1])) throw new RuntimeException('Usage: php bin/restore.php BACKUP --maintenance (stop all application workers first).');
    $config = Database::getConfig();
    DatabaseMaintenance::restore($config['db_path'] ?? '', $argv[1], $config['backup_dir'] ?? '');
    echo "Restore verified: integrity_check=ok; foreign_key_check=0\n";
} catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . "\n"); exit(1); }
