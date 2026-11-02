<?php
/**
 * Automated Database & Migration Test Suite for cms_sfreibe
 * 
 * Verifies:
 * 1. Fresh database initialization through migrations
 * 2. Migration idempotency
 * 3. Preservation of existing editorial changes
 * 4. Transactional rollback on faulty migration
 * 5. Foreign Keys, ON DELETE CASCADE, and domain CHECK constraints
 * 6. Backup tool integrity and verification
 */

declare(strict_types=1);

echo "\n=== [TEST SUITE: Database, Migrations & Constraints] ===\n";

$projectRoot = dirname(__DIR__);
$testDir = sys_get_temp_dir() . '/cms_db_test_' . uniqid();
if (!is_dir($testDir)) {
    mkdir($testDir, 0750, true);
}

$testDbPath = $testDir . '/test_content.sqlite';
$testBackupDir = $testDir . '/backups';
mkdir($testBackupDir, 0750, true);

$failed = false;

function assertCondition(bool $condition, string $msg): void
{
    global $failed;
    if ($condition) {
        echo "  [PASS] $msg\n";
    } else {
        echo "  [FAIL] $msg\n";
        $failed = true;
    }
}

// Set isolated test environment variables
putenv("CMS_DB_PATH={$testDbPath}");
putenv("CMS_BACKUP_DIR={$testBackupDir}");
$configFile = $testDir . '/config.php';
file_put_contents($configFile, '<?php return [];');
putenv("CMS_CONFIG_PATH={$configFile}");
putenv('CMS_ENV=test');

require_once $projectRoot . '/lib/Database.php';
Database::reset();

// 1. Test Fresh Database Installation via Migrations
echo "\n1. Test: Fresh Database Installation\n";
$output = [];
$exitCode = 0;
exec("php bin/migrate.php", $output, $exitCode);

assertCondition($exitCode === 0, "Initial migration executed with exit code 0");
assertCondition(file_exists($testDbPath), "Database file was created at isolated test location");

$db = new PDO('sqlite:' . $testDbPath);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('PRAGMA foreign_keys = ON;');

$secCount = (int)$db->query("SELECT COUNT(*) FROM sections")->fetchColumn();
assertCondition($secCount === 0, "Fresh migration creates no content");

$accCount = (int)$db->query("SELECT COUNT(*) FROM section_accordions")->fetchColumn();
assertCondition($accCount === 0, "Fresh migration creates no accordions");
assertCondition((int)$db->query('SELECT COUNT(*) FROM admin_credentials')->fetchColumn() === 0, 'Fresh migration creates no admin');
exec('php bin/seed.php --confirm-seed', $seedOutput, $seedExit);
assertCondition($seedExit === 0, 'Explicit test fixture seed succeeds');
assertCondition((int)$db->query('SELECT COUNT(*) FROM sections')->fetchColumn() === 14, 'Explicit fixture has 14 sections');

$integrity = $db->query("PRAGMA integrity_check")->fetchColumn();
assertCondition($integrity === 'ok', "Database integrity check is 'ok'");

// 2. Test Migration Idempotency
echo "\n2. Test: Migration Idempotency\n";
$output2 = [];
exec("php bin/migrate.php", $output2, $exitCode2);
assertCondition($exitCode2 === 0, "Repeated migration run exited with code 0");
$outputStr = implode("\n", $output2);
assertCondition(str_contains($outputStr, "already up-to-date"), "Confirmed database is already up-to-date");

$secCountAfter = (int)$db->query("SELECT COUNT(*) FROM sections")->fetchColumn();
assertCondition($secCountAfter === 14, "Sections count unchanged after second migration run");

// 3. Test That Existing Modified Content is NOT Overwritten
echo "\n3. Test: Preserving Existing Content\n";
$customTitle = 'Custom Redaktions-Titel ' . time();
$db->prepare("UPDATE sections SET title = ? WHERE id = 'home' AND lang = 'de'")->execute([$customTitle]);

$output3 = [];
exec("php bin/migrate.php", $output3, $exitCode3);
$currentTitle = $db->query("SELECT title FROM sections WHERE id = 'home' AND lang = 'de'")->fetchColumn();
assertCondition($currentTitle === $customTitle, "Existing editorial modification was preserved and NOT overwritten by migrations");

// 4. Test Transactional Rollback on Faulty Migration
echo "\n4. Test: Rollback on Faulty Migration\n";
// Strictly isolate test migrations directory: NEVER pollute project migrations/ folder
$tempMigDir = $testDir . '/temp_migrations_' . uniqid();
mkdir($tempMigDir, 0750, true);
foreach (scandir($projectRoot . '/migrations') as $mf) {
    if (str_ends_with($mf, '.sql')) {
        copy($projectRoot . '/migrations/' . $mf, $tempMigDir . '/' . $mf);
    }
}
$faultyMigration = $tempMigDir . '/999_faulty_test_migration.sql';
file_put_contents($faultyMigration, "
    CREATE TABLE valid_test_table (id INTEGER PRIMARY KEY);
    THIS IS SYNTAX ERROR INVALID SQL;
");

putenv("CMS_MIGRATIONS_DIR={$tempMigDir}");
$output4 = [];
exec("php bin/migrate.php", $output4, $exitCode4);
putenv("CMS_MIGRATIONS_DIR"); // Reset to default

assertCondition($exitCode4 !== 0, "Faulty migration properly failed with non-zero exit code");

$tableExists = (bool)$db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='valid_test_table'")->fetchColumn();
assertCondition(!$tableExists, "Transactional rollback succeeded: valid_test_table was NOT committed");

$migApplied = (bool)$db->query("SELECT version FROM schema_migrations WHERE version = 999")->fetchColumn();
assertCondition(!$migApplied, "Version 999 was NOT recorded in schema_migrations");

// Clean up isolated temp migrations dir
foreach (scandir($tempMigDir) as $mf) {
    if ($mf !== '.' && $mf !== '..') @unlink($tempMigDir . '/' . $mf);
}
@rmdir($tempMigDir);

// 5. Test Foreign Keys & Constraints
echo "\n5. Test: Foreign Keys and Domain CHECK Constraints\n";
$fkErrors = $db->query('PRAGMA foreign_key_check')->fetchAll();
assertCondition(empty($fkErrors), "Zero foreign key violations in migrated schema");

// CHECK lang
$rejectedLang = false;
try {
    $db->exec("INSERT INTO sections (id, lang, sort_order, nav_label, title, content) VALUES ('sec_test', 'es', 1, 'L', 'T', '<p>C</p>')");
} catch (Throwable $e) {
    $rejectedLang = true;
}
assertCondition($rejectedLang, "CHECK constraint rejects invalid lang 'es'");

// CHECK sort_order >= 0
$rejectedSort = false;
try {
    $db->exec("INSERT INTO sections (id, lang, sort_order, nav_label, title, content) VALUES ('sec_test2', 'de', -1, 'L', 'T', '<p>C</p>')");
} catch (Throwable $e) {
    $rejectedSort = true;
}
assertCondition($rejectedSort, "CHECK constraint rejects negative sort_order (-1)");

// Foreign Key ON DELETE CASCADE
$db->exec("INSERT INTO sections (id, lang, sort_order, nav_label, title, content) VALUES ('sec_cascade', 'de', 50, 'Cas', 'Cascade Title', '<p>C</p>')");
$db->exec("INSERT INTO section_accordions (id, section_id, lang, sort_order, title, content) VALUES ('acc_cas', 'sec_cascade', 'de', 1, 'Acc', '<p>Content</p>')");
$accBefore = (int)$db->query("SELECT COUNT(*) FROM section_accordions WHERE section_id = 'sec_cascade'")->fetchColumn();
$db->exec("DELETE FROM sections WHERE id = 'sec_cascade'");
$accAfter = (int)$db->query("SELECT COUNT(*) FROM section_accordions WHERE section_id = 'sec_cascade'")->fetchColumn();
assertCondition($accBefore === 1 && $accAfter === 0, "Deleting section cascades and removes child accordions automatically");

// 5b. Test: Migration 005 Columns, CHECK Constraints & Data Migration
echo "\n5b. Test: Migration 005 Columns, CHECK Constraints & Data Migration\n";
$secCols = $db->query("PRAGMA table_info(sections)")->fetchAll();
$colNames = array_column($secCols, 'name');
assertCondition(in_array('is_published', $colNames, true), "sections table has is_published column");
assertCondition(in_array('show_in_navigation', $colNames, true), "sections table has show_in_navigation column");

$accCols = $db->query("PRAGMA table_info(section_accordions)")->fetchAll();
$accColNames = array_column($accCols, 'name');
assertCondition(in_array('is_published', $accColNames, true), "section_accordions table has is_published column");

// Impressum and datenschutz must have show_in_navigation = 0
$legalNav = (int)$db->query("SELECT SUM(show_in_navigation) FROM sections WHERE id IN ('impressum', 'datenschutz')")->fetchColumn();
assertCondition($legalNav === 0, "Legal sections have show_in_navigation = 0");

// Standard sections must have show_in_navigation = 1
$homeNav = (int)$db->query("SELECT show_in_navigation FROM sections WHERE id = 'home' AND lang = 'de'")->fetchColumn();
assertCondition($homeNav === 1, "Home section has show_in_navigation = 1");

// Test CHECK constraints on is_published and show_in_navigation
$rejectedPub = false;
try {
    $db->exec("INSERT INTO sections (id, lang, sort_order, nav_label, title, content, is_published) VALUES ('sec_pub_err', 'de', 99, 'Err', 'T', '<p>C</p>', 2)");
} catch (Throwable $e) {
    $rejectedPub = true;
}
assertCondition($rejectedPub, "CHECK constraint rejects invalid is_published value (2)");

$rejectedNav = false;
try {
    $db->exec("INSERT INTO sections (id, lang, sort_order, nav_label, title, content, show_in_navigation) VALUES ('sec_nav_err', 'de', 99, 'Err', 'T', '<p>C</p>', 2)");
} catch (Throwable $e) {
    $rejectedNav = true;
}
assertCondition($rejectedNav, "CHECK constraint rejects invalid show_in_navigation value (2)");

// 6. Test: Seed behavior on existing empty database
echo "\n6. Test: Seed Behavior on Existing Empty Database\n";
$emptyTestDbPath = $testDir . '/empty_test_content.sqlite';
$emptyDb = new PDO('sqlite:' . $emptyTestDbPath);
$emptyDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
// Pre-create schema_migrations at version 1 and all base tables from 001_initial_schema.sql
$emptyDb->exec(file_get_contents(dirname(__DIR__) . '/migrations/001_initial_schema.sql'));
$emptyDb->exec("INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))");
$emptyDb = null;

// Run migration without --seed
putenv("CMS_DB_PATH={$emptyTestDbPath}");
$outNoSeed = [];
$exitNoSeed = 0;
exec("php bin/migrate.php", $outNoSeed, $exitNoSeed);
$checkEmptyDb = new PDO('sqlite:' . $emptyTestDbPath);
$secCountEmpty = (int)$checkEmptyDb->query("SELECT COUNT(*) FROM sections")->fetchColumn();
assertCondition($secCountEmpty === 0, "Migration does NOT automatically seed an existing empty database");
$checkEmptyDb = null;

// A removed seed option must fail without adding data.
$outWithSeed = [];
$exitWithSeed = 0;
exec("php bin/migrate.php --seed", $outWithSeed, $exitWithSeed);
$checkSeededDb = new PDO('sqlite:' . $emptyTestDbPath);
$secCountSeeded = (int)$checkSeededDb->query("SELECT COUNT(*) FROM sections")->fetchColumn();
assertCondition($exitWithSeed !== 0 && $secCountSeeded === 0, "Migration rejects --seed without inserting content");
$checkSeededDb = null;
@unlink($emptyTestDbPath);
@unlink($emptyTestDbPath . '-wal');
@unlink($emptyTestDbPath . '-shm');

// Restore original test db path
putenv("CMS_DB_PATH={$testDbPath}");

// 7. Test Backup Tool
echo "\n7. Test: Backup Tool\n";
$output5 = [];
exec("php bin/backup.php", $output5, $exitCode5);
assertCondition($exitCode5 === 0, "Backup command exited with code 0");

$output6 = [];
exec("php bin/backup.php --check", $output6, $exitCode6);
assertCondition($exitCode6 === 0, "Backup integrity check command exited with code 0");

// Correct already applied faulty publication without touching content or timestamps.
$db->exec("UPDATE sections SET is_published=1,is_active=0 WHERE id='impressum' AND lang='de'");
$db->exec("UPDATE sections SET is_published=1,is_active=1 WHERE id='impressum' AND lang='en'");
$legalBefore = $db->query("SELECT content,updated_at FROM sections WHERE id='impressum' AND lang='de'")->fetch(PDO::FETCH_ASSOC);
$db->exec('DELETE FROM schema_migrations WHERE version IN (6,7)');
exec('php bin/migrate.php', $correctOutput, $correctCode);
assertCondition($correctCode === 0, 'Corrective migrations execute on previously migrated DB');
assertCondition((int)$db->query("SELECT is_published FROM sections WHERE id='impressum' AND lang='de'")->fetchColumn() === 1, 'Schema migration preserves existing publication decisions');
assertCondition((int)$db->query("SELECT is_published FROM sections WHERE id='impressum' AND lang='en'")->fetchColumn() === 1, 'Explicitly reviewed publication preserved');
assertCondition($db->query("SELECT content,updated_at FROM sections WHERE id='impressum' AND lang='de'")->fetch(PDO::FETCH_ASSOC) === $legalBefore, 'Correction preserves content and timestamps');
$db->exec("INSERT INTO sections(id,lang,title,nav_label,content) VALUES('default-draft','de','Draft','Draft','Synthetic')");
assertCondition((int)$db->query("SELECT is_published FROM sections WHERE id='default-draft'")->fetchColumn() === 0, 'Database insert defaults to draft');

// Clean up temporary database test directory
Database::reset();
$db = null;
gc_collect_cycles();

// Delete temp files
foreach (scandir($testBackupDir) as $f) {
    if ($f !== '.' && $f !== '..') @unlink($testBackupDir . '/' . $f);
}
@rmdir($testBackupDir);

@unlink($testDbPath);
@unlink($testDbPath . '-wal');
@unlink($testDbPath . '-shm');
@unlink($configFile);
@rmdir($testDir);

if ($failed) {
    echo "\n❌ Database Test Suite FAILED!\n";
    exit(1);
} else {
    echo "\n✅ Database Test Suite PASSED COMPLETELY!\n";
    exit(0);
}
