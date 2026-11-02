<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/Auth.php';

$dir = sys_get_temp_dir() . '/cms_sfreibe_auth_' . bin2hex(random_bytes(8));
if (!mkdir($dir, 0700)) throw new RuntimeException('Cannot create test directory.');
$dbPath = $dir . '/content.sqlite';
$configPath = $dir . '/cms_config.php';
$password = bin2hex(random_bytes(24));
file_put_contents($configPath, "<?php return ['cookie_secure'=>false,'session_save_path'=>__DIR__,'rate_limit_max_attempts'=>2,'rate_limit_window_seconds'=>900];");
putenv('CMS_CONFIG_PATH=' . $configPath);
putenv('CMS_DB_PATH=' . $dbPath);
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

function checkAuth(bool $value, string $message): void
{
    if (!$value) throw new RuntimeException($message);
}

try {
    $db = new PDO('sqlite:' . $dbPath, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('CREATE TABLE login_attempts (id INTEGER PRIMARY KEY, ip TEXT NOT NULL, username TEXT NOT NULL, attempted_at INTEGER NOT NULL)');
    $db->exec('CREATE TABLE admin_credentials (id INTEGER PRIMARY KEY, username TEXT NOT NULL, password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL, credential_version INTEGER NOT NULL)');
    $stmt = $db->prepare('INSERT INTO admin_credentials VALUES (1, ?, ?, 0, 1)');
    $stmt->execute(['synthetic_admin', password_hash($password, PASSWORD_DEFAULT)]);
    checkAuth(Auth::login('synthetic_admin', 'wrong')['status'] === 401, 'First invalid login status');
    checkAuth((int)$db->query('SELECT COUNT(*) FROM login_attempts')->fetchColumn() === 1, 'Failed attempt not stored');
    checkAuth(Auth::login('synthetic_admin', 'wrong')['status'] === 401, 'Second invalid login status');
    checkAuth(Auth::login('synthetic_admin', 'wrong')['status'] === 429, 'Rate limit not enforced');
    checkAuth(session_status() !== PHP_SESSION_ACTIVE, 'Rate limit created a session');

    $db->exec('DROP TABLE login_attempts');
    checkAuth(Auth::login('synthetic_admin', $password)['status'] === 503, 'Unreadable rate limit table did not fail closed');
    checkAuth(session_status() !== PHP_SESSION_ACTIVE, 'Unreadable table created a session');

    $db->exec('CREATE TABLE login_attempts (id INTEGER PRIMARY KEY, ip TEXT NOT NULL, username TEXT NOT NULL, attempted_at INTEGER NOT NULL)');
    $db->exec("CREATE TRIGGER deny_insert BEFORE INSERT ON login_attempts BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END");
    checkAuth(Auth::login('synthetic_admin', 'wrong')['status'] === 503, 'Failed INSERT did not fail closed');
    checkAuth((int)$db->query('SELECT COUNT(*) FROM login_attempts')->fetchColumn() === 0, 'Failed INSERT left an attempt');
    checkAuth(session_status() !== PHP_SESSION_ACTIVE, 'Failed INSERT created a session');
    $db->exec('DROP TRIGGER deny_insert');

    Database::getConnection()->exec('PRAGMA query_only=ON');
    checkAuth(Auth::login('synthetic_admin', $password)['status'] === 503, 'Read-only database did not fail closed');
    checkAuth(session_status() !== PHP_SESSION_ACTIVE, 'Read-only database created a session');
    Database::getConnection()->exec('PRAGMA query_only=OFF');
    checkAuth(Auth::login('synthetic_admin', $password)['status'] === 200, 'Valid login did not succeed after storage recovery');
    checkAuth(session_status() === PHP_SESSION_ACTIVE, 'Valid login did not create a session');
    session_write_close();
    $db->exec('DROP TABLE admin_credentials');
    checkAuth(Auth::login('synthetic_admin', $password)['status'] === 503, 'Unavailable credential table did not fail closed');
    checkAuth(!Auth::isAuthenticated(), 'Old session survived unavailable credential table');
    echo "Auth fail-closed tests passed: limit=429; unreadable tables, failed INSERT, read-only connection=503; no new session.\n";
} finally {
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $stmt = null;
    $db = null;
    Database::reset();
    foreach (glob($dir . '/*') ?: [] as $file) if (is_file($file)) unlink($file);
    rmdir($dir);
}
