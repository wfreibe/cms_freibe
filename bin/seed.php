<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit(1); }
require_once dirname(__DIR__) . '/lib/Database.php';

try {
    if ($argc !== 2 || $argv[1] !== '--confirm-seed') {
        throw new RuntimeException('Usage: php bin/seed.php --confirm-seed');
    }
    if (!in_array(getenv('CMS_ENV'), ['development', 'test'], true)) {
        throw new RuntimeException('Manual seeding requires CMS_ENV=development or test; production is forbidden.');
    }
    if (!getenv('CMS_DB_PATH') || !getenv('CMS_CONFIG_PATH')) {
        throw new RuntimeException('Manual seeding requires explicit CMS_DB_PATH and CMS_CONFIG_PATH.');
    }
    $db = Database::getConnection();
    // Acquire a writer lock before checking emptiness, preventing concurrent inserts.
    $db->exec('BEGIN IMMEDIATE');
    try {
        foreach (['sections', 'section_accordions', 'admin_credentials', 'contact_messages', 'login_attempts'] as $table) {
            if ((int)$db->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn() !== 0) {
                throw new RuntimeException('Seed refused: database already contains application data.');
            }
        }
        $sql = file_get_contents(dirname(__DIR__) . '/seeds/initial_content.sql');
        if ($sql === false) throw new RuntimeException('Seed source unavailable.');
        $db->exec($sql);
        $db->exec("UPDATE sections SET is_published=is_active, show_in_navigation=CASE WHEN id IN ('impressum','datenschutz') THEN 0 ELSE is_active END");
        $db->exec('UPDATE section_accordions SET is_published=is_active');
        $db->exec('COMMIT');
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
    fwrite(STDOUT, "Manual content seed completed; no administrator created.\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'Seed failed: ' . $error->getMessage() . "\n");
    exit(1);
}
