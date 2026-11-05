<?php
declare(strict_types=1);

/** Read-only prerequisite checks; deliberately does not use Database::getConnection(). */
final class Readiness
{
    public static function status(): int
    {
        set_error_handler(static function (): never { throw new RuntimeException('Unavailable'); });
        ob_start();
        try {
            foreach (['pdo_sqlite', 'dom', 'mbstring', 'session'] as $extension) {
                if (!extension_loaded($extension)) return 503;
            }
            $root = dirname(__DIR__);
            $file = getenv('CMS_CONFIG_PATH') ?: $root . '/config/cms_config.php';
            if (!is_file($file) || !is_readable($file)) return 503;
            $config = require $file;
            if (!is_array($config)) return 503;
            $database = getenv('CMS_DB_PATH') ?: ($config['db_path'] ?? null);
            $backup = getenv('CMS_BACKUP_DIR') ?: ($config['backup_dir'] ?? null);
            $sessions = $config['session_save_path'] ?? $root . '/data/sessions';
            if (!is_string($database) || !is_file($database) || !is_readable($database) || !is_writable($database)) return 503;
            foreach ([dirname($database), $backup, $sessions] as $directory) {
                if (!is_string($directory) || !is_dir($directory) || !is_readable($directory) || !is_writable($directory)) return 503;
            }
            // SQLite's read-only flag alone can still create WAL/SHM files.
            // For an idle, checkpointed file, probe only its schema without locking
            // and reject the result if a writer appeared or changed the header.
            // A live WAL must be read with its index in read-only mode instead.
            clearstatcache();
            $idle = !is_file($database . '-wal');
            if (is_file($database . '-journal') || (!$idle && !is_file($database . '-shm'))) return 503;
            $header = file_get_contents($database, false, null, 0, 100);
            if ($header === false || strlen($header) !== 100 || substr($header, 0, 16) !== "SQLite format 3\0") return 503;
            $resolved = realpath($database);
            if ($resolved === false) return 503;
            $uri = 'sqlite:file:' . str_replace(['%2F', '%3A'], ['/', ':'], rawurlencode(str_replace('\\', '/', $resolved)));
            $uri .= $idle ? '?mode=ro&immutable=1' : '?mode=ro&readonly_shm=1';
            $db = new PDO($uri, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 1,
                PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY,
            ]);
            $applied = array_map('intval', $db->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
            $migrations = glob($root . '/migrations/*.sql');
            if (!$migrations) return 503;
            foreach ($migrations as $migration) {
                if (preg_match('/^(\d+)_/', basename($migration), $match) && !in_array((int)$match[1], $applied, true)) return 503;
            }
            foreach (['sections', 'section_accordions', 'admin_credentials', 'login_attempts', 'page_urls', 'page_navigation'] as $table) {
                $db->query('SELECT * FROM ' . $table . ' LIMIT 0');
            }
            $db = null;
            clearstatcache();
            if (is_file($database . '-journal')) return 503;
            if ($idle && (is_file($database . '-wal') || file_get_contents($database, false, null, 0, 100) !== $header)) return 503;
            return 200;
        } catch (Throwable $error) {
            return 503;
        } finally {
            ob_end_clean();
            restore_error_handler();
        }
    }
}
