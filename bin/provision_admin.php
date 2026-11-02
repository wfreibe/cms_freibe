<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit(1); }
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/Auth.php';
require_once dirname(__DIR__) . '/lib/AdminCredentials.php';

try {
    if ($argc !== 1) {
        throw new RuntimeException('Usage: php bin/provision_admin.php');
    }
    $path = Database::getConfig()['db_path'] ?? null;
    if (!is_string($path) || !is_file($path)) throw new RuntimeException('An existing migrated database is required.');
    // Reject an existing account before a writable connection can change journal mode.
    $readOnly = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
        PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY,
    ]);
    $existing = AdminCredentials::current($readOnly);
    $readOnly = null;
    if ($existing !== null) throw new RuntimeException('Admin already provisioned; bootstrap cannot change an existing account. Use the separate confirmed password reset command.');
    $db = Database::getConnection();
    $password = AdminCredentials::provision($db, 'admin', false);
    fwrite(STDOUT, "One-time admin password: {$password}\n");
} catch (Throwable $e) {
    fwrite(STDERR, 'Provisioning failed: ' . $e->getMessage() . "\n");
    exit(1);
}
