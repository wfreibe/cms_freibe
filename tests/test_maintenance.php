<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/DatabaseMaintenance.php';
$dir = getenv('CMS_MAINTENANCE_TEST_DIR');
if (!$dir || !is_dir($dir)) throw new RuntimeException('An isolated maintenance test directory is required.');
function ensure(bool $ok, string $label): void { if (!$ok) throw new RuntimeException($label); echo "PASS: $label\n"; }
try {
    $path = $dir . '/active.sqlite';
    $db = DatabaseMaintenance::open($path);
    $db->exec('CREATE TABLE sentinel(value TEXT)');
    $db->exec("INSERT INTO sentinel VALUES ('before')");
    $candidate = DatabaseMaintenance::backup($db, $dir);
    $db->exec("UPDATE sentinel SET value='current'"); $db = null;
    foreach (['copy', 'stage', 'rename', 'verify', 'rollback_copy', 'rollback', 'verify_rollback'] as $fault) {
        $hit = false;
        $op = static function($action, $from, $to = '') use ($fault, &$hit) {
            if ($fault === 'stage' && $action === 'stage') {
                $hit = true;
                throw new RuntimeException('Injected staging verification failure');
            }
            if (in_array($fault, ['rollback_copy', 'rollback', 'verify_rollback'], true) && $action === 'verify') {
                throw new RuntimeException('Injected post-swap failure');
            }
            if ($fault === 'rollback_copy' && $action === 'copy' && str_contains($from, 'pre_restore')) {
                $hit = true;
                throw new RuntimeException('Injected rollback copy failure');
            }
            if ($action === $fault) { $hit = true; throw new RuntimeException('Injected failure'); }
            if (in_array($action, ['stage', 'verify', 'verify_rollback'], true)) return;
            $ok = $action === 'copy' ? copy($from, $to) : rename($from, $to);
            if (!$ok) throw new RuntimeException('Filesystem failure');
        };
        $failed = false;
        try { DatabaseMaintenance::restore($path, $candidate, $dir, $op); }
        catch (RuntimeException $e) {
            $failed = true;
            if (str_starts_with($fault, 'rollback') || $fault === 'verify_rollback') {
                ensure(str_contains($e->getMessage(), 'Verified recovery snapshot:'), 'Rollback failure names verified recovery snapshot');
            }
        }
        ensure($failed && $hit && is_file($path), "Restore $fault error fails without deleting active DB");
        $db = DatabaseMaintenance::open($path); DatabaseMaintenance::verify($db);
        if (!in_array($fault, ['rollback_copy', 'rollback', 'verify_rollback'], true)) ensure($db->query('SELECT value FROM sentinel')->fetchColumn() === 'current', "$fault failure preserves or rolls back original content");
        $db->exec("UPDATE sentinel SET value='current'"); $db = null;
    }
    DatabaseMaintenance::restore($path, $candidate, $dir);
    $db = DatabaseMaintenance::open($path);
    ensure($db->query('SELECT value FROM sentinel')->fetchColumn() === 'before', 'Successful restore replaces content');
    $db->exec('PRAGMA journal_mode=WAL');
    $reader = DatabaseMaintenance::open($path);
    $reader->beginTransaction(); $reader->query('SELECT * FROM sentinel')->fetchAll();
    $db->exec("UPDATE sentinel SET value='wal'");
    $failed = false;
    try { DatabaseMaintenance::checkpoint($db); } catch (RuntimeException $e) { $failed = true; }
    ensure($failed, 'Busy WAL checkpoint aborts');
    $reader->rollBack(); $reader = null;
    DatabaseMaintenance::verify($db); $db = null;
    $orphanDb = DatabaseMaintenance::open($dir . '/orphans.sqlite');
    $orphanDb->exec('CREATE TABLE sections(id TEXT,lang TEXT); CREATE TABLE section_accordions(id TEXT,section_id TEXT,lang TEXT,title TEXT,content TEXT,created_at TEXT,updated_at TEXT,is_active INTEGER)');
    $orphanDb->exec("INSERT INTO section_accordions VALUES('orphan','missing','de','Synthetic','Full archive sentinel','2000','2001',0)");
    ensure(DatabaseMaintenance::pruneOrphans($orphanDb, $dir) === 1, 'Explicit orphan cleanup removes exactly one row');
    $archives = glob($dir . '/cms_sfreibe_orphans_*.json');
    $rows = json_decode(file_get_contents($archives[0]), true, 512, JSON_THROW_ON_ERROR);
    ensure(count($rows[0]) === 8 && $rows[0]['content'] === 'Full archive sentinel' && $rows[0]['updated_at'] === '2001', 'Orphan archive contains every column and original timestamps');
    $orphanDb = null;
    echo "Maintenance: integrity_check=ok; foreign_key_check=0\n";
} finally { $db = null; $reader = null; $orphanDb = null; }
