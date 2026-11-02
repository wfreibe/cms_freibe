<?php
declare(strict_types=1);
require_once __DIR__ . '/PrivateStorage.php';

/** SQLite operations shared by the CLI tools. All paths are explicit. */
final class DatabaseMaintenance
{
    public static function open(string $path): PDO
    {
        $db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        $db->exec('PRAGMA busy_timeout=5000');
        $db->exec('PRAGMA foreign_keys=ON');
        return $db;
    }

    public static function verify(PDO $db, bool $foreignKeys = true): void
    {
        if ($db->query('PRAGMA integrity_check')->fetchAll(PDO::FETCH_COLUMN) !== ['ok']) throw new RuntimeException('Integrity check failed.');
        if ($foreignKeys && $db->query('PRAGMA foreign_key_check')->fetchAll()) throw new RuntimeException('Foreign key check failed.');
    }

    public static function checkpoint(PDO $db): void
    {
        $result = $db->query('PRAGMA wal_checkpoint(TRUNCATE)')->fetch(PDO::FETCH_NUM);
        if (!$result || (int)$result[0] !== 0 || (int)$result[1] !== (int)$result[2]) throw new RuntimeException('WAL checkpoint failed or busy.');
    }

    public static function backup(PDO $db, string $directory, string $purpose = 'backup', bool $foreignKeys = true): string
    {
        if ($directory === '') throw new RuntimeException('Backup directory must be configured.');
        if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new RuntimeException('Cannot create backup directory.');
        PrivateStorage::directory($directory);
        self::verify($db, $foreignKeys);
        self::checkpoint($db);
        $target = $directory . '/cms_sfreibe_' . $purpose . '_' . gmdate('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.sqlite';
        if (file_exists($target)) throw new RuntimeException('Backup already exists.');
        try {
            $db->exec('VACUUM INTO ' . $db->quote($target));
            PrivateStorage::file($target);
            $check = self::open($target);
            self::verify($check, $foreignKeys);
            $check = null;
            return $target;
        } catch (Throwable $e) {
            $check = null;
            if (is_file($target)) unlink($target);
            throw $e;
        }
    }

    public static function pruneOrphans(PDO $db, string $directory): int
    {
        self::backup($db, $directory, 'pre_prune', false);
        $db->beginTransaction();
        $temp = null;
        try {
            $rows = $db->query('SELECT a.* FROM section_accordions a LEFT JOIN sections s ON s.id=a.section_id AND s.lang=a.lang WHERE s.id IS NULL')->fetchAll();
            if (!$rows) { $db->commit(); return 0; }
            $target = $directory . '/cms_sfreibe_orphans_' . bin2hex(random_bytes(12)) . '.json';
            $temp = $target . '.tmp';
            $json = json_encode($rows, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if (file_put_contents($temp, $json, LOCK_EX) !== strlen($json)) throw new RuntimeException('Archive write failed.');
            PrivateStorage::file($temp);
            if (json_decode(file_get_contents($temp), true, 512, JSON_THROW_ON_ERROR) !== $rows || !rename($temp, $target)) throw new RuntimeException('Archive verification failed.');
            PrivateStorage::file($target);
            $stmt = $db->prepare('DELETE FROM section_accordions WHERE id=? AND section_id=? AND lang=?');
            foreach ($rows as $row) $stmt->execute([$row['id'], $row['section_id'], $row['lang']]);
            self::verify($db);
            $db->commit();
            return count($rows);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            if ($temp && is_file($temp)) unlink($temp);
            throw $e;
        }
    }

    /** Injectable filesystem operations let tests exercise real error handling without production switches. */
    public static function restore(string $path, string $candidate, string $directory, ?callable $operation = null): void
    {
        $operation ??= static function(string $action, string $from, string $to = ''): void {
            $ok = match ($action) {
                'copy' => copy($from, $to),
                'rename', 'rollback' => rename($from, $to),
                'stage', 'verify', 'verify_rollback' => true,
                default => throw new RuntimeException('Unknown operation.')
            };
            if (!$ok) throw new RuntimeException('Restore filesystem operation failed.');
        };
        if (!is_file($path) || !is_file($candidate) || realpath($path) === realpath($candidate)) throw new RuntimeException('Invalid restore source or destination.');
        PrivateStorage::directory(dirname($path));
        PrivateStorage::file($path);
        $check = self::open($candidate); self::verify($check); $check = null;
        $active = self::open($path);
        $snapshot = self::backup($active, $directory, 'pre_restore');
        // Require all writers to be stopped; DELETE mode removes WAL/SHM safely before the swap.
        self::checkpoint($active);
        if (strtolower((string)$active->query('PRAGMA journal_mode=DELETE')->fetchColumn()) !== 'delete') throw new RuntimeException('Cannot leave WAL mode. Stop all connections.');
        $active = null;
        foreach (['-wal', '-shm'] as $suffix) if (file_exists($path . $suffix)) throw new RuntimeException('Live SQLite sidecar remains.');
        $stage = $path . '.stage_' . bin2hex(random_bytes(8));
        $rollback = $path . '.rollback_' . bin2hex(random_bytes(8));
        $swapped = false;
        try {
            $operation('copy', $candidate, $stage);
            PrivateStorage::file($stage);
            $operation('stage', $stage);
            $check = self::open($stage); self::verify($check); $check = null;
            $operation('rename', $stage, $path); // Never unlink the active database first.
            $swapped = true;
            $operation('verify', $path);
            $check = self::open($path); self::verify($check); $check = null;
        } catch (Throwable $e) {
            $check = null;
            if ($swapped) {
                try {
                    $operation('copy', $snapshot, $rollback);
                    PrivateStorage::file($rollback);
                    $operation('verify_rollback', $rollback);
                    $check = self::open($rollback); self::verify($check); $check = null;
                    $operation('rollback', $rollback, $path);
                    $check = self::open($path); self::verify($check); $check = null;
                } catch (Throwable $rollbackError) {
                    throw new RuntimeException('Rollback failed; keep maintenance mode. Verified recovery snapshot: ' . $snapshot, 0, $rollbackError);
                }
            }
            throw $e;
        } finally {
            foreach ([$stage, $rollback] as $file) if (is_file($file)) unlink($file);
        }
    }
}
