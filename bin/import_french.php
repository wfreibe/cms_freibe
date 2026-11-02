<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit(1); }
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';

try {
    if ($argc !== 2 || $argv[1] !== '--confirm-import') {
        throw new RuntimeException('Usage: php bin/import_french.php --confirm-import (adds missing French drafts only).');
    }
    if (!getenv('CMS_CONFIG_PATH') || !getenv('CMS_DB_PATH')) {
        throw new RuntimeException('Explicit CMS_CONFIG_PATH and CMS_DB_PATH are required.');
    }
    $config = Database::getConfig();
    if (!is_file($config['db_path'])) throw new RuntimeException('Migrate the database before importing.');
    $db = DatabaseMaintenance::open($config['db_path']);
    if (!(bool)$db->query('SELECT 1 FROM schema_migrations WHERE version=9')->fetchColumn()) {
        throw new RuntimeException('French schema migration 009 is required.');
    }
    $templates = json_decode(file_get_contents(dirname(__DIR__) . '/seeds/french_content.json'), true, 512, JSON_THROW_ON_ERROR);
    DatabaseMaintenance::backup($db, $config['backup_dir'], 'before_french_import');
    $db->exec('BEGIN IMMEDIATE');
    try {
        $existing = $db->prepare("SELECT 1 FROM sections WHERE id=? AND lang='fr'");
        $insert = $db->prepare("INSERT INTO sections (id,lang,sort_order,nav_label,title,subtitle,content,bg_color,bg_image_url,is_active,is_published,show_in_navigation) VALUES (?,'fr',?,?,?,?,?,?,?,0,0,?)");
        $accordion = $db->prepare("INSERT INTO section_accordions (id,section_id,lang,sort_order,title,content,is_active,is_published) VALUES (?,?,'fr',?,?,?,0,0)");
        $count = 0;
        foreach ($templates as $section) {
            $existing->execute([$section['id']]);
            if ($existing->fetchColumn()) continue;
            $insert->execute([$section['id'], $section['sort_order'], $section['nav_label'], $section['title'], $section['subtitle'], $section['content'], $section['bg_color'] ?? null, $section['bg_image_url'] ?? null, in_array($section['id'], ['impressum','datenschutz'], true) ? 0 : 1]);
            foreach ($section['accordions'] ?? [] as $index => $item) {
                $accordion->execute([$item['id'], $section['id'], $index + 1, $item['title'], $item['content']]);
            }
            $count++;
        }
        DatabaseMaintenance::verify($db);
        $db->exec('COMMIT');
        echo "Imported $count French draft sections. Existing content and accounts unchanged.\n";
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'French import failed: ' . $error->getMessage() . "\n");
    exit(1);
}
