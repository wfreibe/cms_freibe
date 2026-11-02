<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';

try {
    $apply = in_array('--apply', $argv, true);
    if ($apply && !in_array('--maintenance', $argv, true)) {
        throw new RuntimeException('Stop application writers and pass --maintenance to apply.');
    }
    $config = Database::getConfig();
    $dbPath = $config['db_path'] ?? '';
    $backupDir = $config['backup_dir'] ?? '';
    if (!is_string($dbPath) || $dbPath === '' || !is_file($dbPath)) {
        throw new RuntimeException('An explicitly configured existing database is required.');
    }
    if ($apply && (!is_string($backupDir) || $backupDir === '')) {
        throw new RuntimeException('An explicitly configured backup directory is required.');
    }

    $db = $apply
        ? DatabaseMaintenance::open($dbPath)
        : new PDO('sqlite:' . $dbPath, null, null, [
            PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY,
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    DatabaseMaintenance::verify($db);
    $stmt = $db->query("SELECT id, lang, length(CAST(content AS BLOB)) AS content_bytes FROM sections WHERE id IN ('impressum', 'datenschutz') ORDER BY id, lang");
    $rows = $stmt->fetchAll();
    $expected = ['datenschutz/de', 'datenschutz/en', 'impressum/de', 'impressum/en'];
    if (array_map(static fn(array $row): string => $row['id'] . '/' . $row['lang'], $rows) !== $expected) {
        throw new RuntimeException('Expected exactly four German and English legal text rows; no changes made.');
    }
    $legalAccordions = (int)$db->query("SELECT COUNT(*) FROM section_accordions WHERE section_id IN ('impressum', 'datenschutz')")->fetchColumn();
    if ($legalAccordions !== 0) {
        throw new RuntimeException('Legal accordions need separate review; no changes made.');
    }
    foreach ($rows as $row) {
        echo $row['id'] . '/' . $row['lang'] . ': ' . $row['content_bytes'] . " content bytes scheduled for removal\n";
    }
    if (!$apply) {
        echo "Read-only preview complete.\n";
        exit(0);
    }

    // The backup retains the original text for a controlled rollback. It stays private.
    $snapshot = DatabaseMaintenance::backup($db, $backupDir, 'pre_legal_redaction');
    echo "Verified pre-redaction backup: {$snapshot}\n";

    $columns = array_column($db->query('PRAGMA table_info(sections)')->fetchAll(), 'name');
    $updates = ['content = ?', 'is_active = 0', 'updated_at = CURRENT_TIMESTAMP'];
    if (in_array('is_published', $columns, true)) $updates[] = 'is_published = 0';
    if (in_array('show_in_navigation', $columns, true)) $updates[] = 'show_in_navigation = 0';

    $db->exec('PRAGMA secure_delete = ON');
    $db->beginTransaction();
    try {
        $update = $db->prepare('UPDATE sections SET ' . implode(', ', $updates) . ' WHERE id = ? AND lang = ?');
        foreach ($rows as $row) {
            $update->execute(['', $row['id'], $row['lang']]);
            if ($update->rowCount() !== 1) throw new RuntimeException('Legal row changed during redaction.');
        }
        DatabaseMaintenance::verify($db);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }

    // Rebuild pages so superseded text cannot remain in SQLite free space.
    $db->exec('VACUUM');
    DatabaseMaintenance::checkpoint($db);
    DatabaseMaintenance::verify($db);
    $remaining = (int)$db->query("SELECT COUNT(*) FROM sections WHERE id IN ('impressum', 'datenschutz') AND (content <> '' OR is_active <> 0)")->fetchColumn();
    if (in_array('is_published', $columns, true)) {
        $remaining += (int)$db->query("SELECT COUNT(*) FROM sections WHERE id IN ('impressum', 'datenschutz') AND is_published <> 0")->fetchColumn();
    }
    if ($remaining !== 0) throw new RuntimeException('Post-redaction verification failed; retain the backup and maintenance mode.');
    echo "Four legal texts cleared and unpublished. integrity_check=ok; foreign_key_check=0\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'LEGAL REDACTION ERROR: ' . $e->getMessage() . "\n");
    exit(1);
}
