<?php
declare(strict_types=1);
if (DIRECTORY_SEPARATOR !== '/') { echo "POSIX permissions test skipped: platform has no POSIX mode support.\n"; exit(0); }
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';
require_once dirname(__DIR__) . '/lib/Auth.php';
$root = sys_get_temp_dir() . '/cms_sfreibe_permissions_' . bin2hex(random_bytes(8));
mkdir($root, 0700);
mkdir($root . '/data', 0755);
$dbPath = $root . '/data/content.sqlite';
$configPath = $root . '/cms_config.php';
file_put_contents($configPath, "<?php return ['db_path'=>__DIR__.'/data/content.sqlite','backup_dir'=>__DIR__.'/backups','session_save_path'=>__DIR__.'/data/sessions','cookie_secure'=>false];");
putenv('CMS_CONFIG_PATH=' . $configPath);
function modeIs(string $path, int $expected): void {
    clearstatcache(true, $path);
    if ((fileperms($path) & 0777) !== $expected) throw new RuntimeException('Incorrect private storage mode.');
}
try {
    $initial = DatabaseMaintenance::open($dbPath);
    $initial->exec('CREATE TABLE sentinel(value TEXT)');
    $initial = null;
    $db = Database::getConnection();
    $db->exec("INSERT INTO sentinel VALUES ('synthetic')");
    Auth::startSession();
    $sessionPath = session_save_path() . '/sess_' . session_id();
    modeIs($configPath, 0600);
    modeIs($dbPath, 0600);
    modeIs(dirname($dbPath), 0700);
    modeIs(session_save_path(), 0700);
    modeIs($sessionPath, 0600);
    foreach (['-wal','-shm'] as $suffix) if (is_file($dbPath . $suffix)) modeIs($dbPath . $suffix, 0600);
    $backup = DatabaseMaintenance::backup($db, $root . '/backups');
    modeIs($root . '/backups', 0700);
    modeIs($backup, 0600);
    session_write_close();
    $db = null;
    Database::reset();
    echo "POSIX private storage permissions passed: config/database/sidecars/backup/session files 0600; directories 0700.\n";
} finally {
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $db = null;
    Database::reset();
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $entry) $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    rmdir($root);
}
