<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit(1); }
if ($argc !== 2 || $argv[1] !== '--confirm-reset') {
    fwrite(STDERR, "Usage: php bin/reset_admin_password.php --confirm-reset\n");
    exit(1);
}
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/Auth.php';
require_once dirname(__DIR__) . '/lib/AdminCredentials.php';

try {
    $db = Database::getConnection();
    $current = AdminCredentials::current($db);
    if ($current === null) throw new RuntimeException('Admin is not provisioned.');
    $password = AdminCredentials::provision($db, $current['username'], true);
    fwrite(STDOUT, "One-time admin password: {$password}\n");
} catch (Throwable $e) {
    fwrite(STDERR, 'Reset failed: ' . $e->getMessage() . "\n");
    exit(1);
}
