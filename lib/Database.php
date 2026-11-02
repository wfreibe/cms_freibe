<?php
/**
 * Database Connection & Configuration Manager for cms_sfreibe
 * 
 * Enforces strict explicit path resolution, WAL mode, foreign keys,
 * and zero internal path disclosure.
 */

declare(strict_types=1);
require_once __DIR__ . '/PrivateStorage.php';

class Database
{
    private static ?PDO $instance = null;
    private static ?array $config = null;

    /**
     * Load application configuration from secure location or environment.
     */
    public static function getConfig(): array
    {
        if (self::$config !== null) {
            return self::$config;
        }

        $projectRoot = dirname(__DIR__);
        $loadedConfig = [];

        // 1. Check explicit config file path or standard local config directory
        $configPath = getenv('CMS_CONFIG_PATH');
        if ($configPath && !is_file($configPath)) {
            throw new RuntimeException('Invalid configuration.');
        }
        $configPath = $configPath ?: $projectRoot . '/config/cms_config.php';
        if (is_file($configPath)) {
            PrivateStorage::file($configPath);
            $loadedConfig = require $configPath;
        }

        if (!is_array($loadedConfig)) {
            throw new RuntimeException('Invalid configuration.');
        }
        // Legacy keys may remain in a private local file during migration, but are never credentials.
        unset($loadedConfig['admin_hash'], $loadedConfig['admin_user']);

        // 2. Strict Environment Variable Overrides
        $envDb = getenv('CMS_DB_PATH');
        if ($envDb !== false && trim($envDb) !== '') {
            $loadedConfig['db_path'] = trim($envDb);
        }

        $envBackup = getenv('CMS_BACKUP_DIR');
        if ($envBackup !== false && trim($envBackup) !== '') {
            $loadedConfig['backup_dir'] = trim($envBackup);
        }

        $envProxies = getenv('CMS_TRUSTED_PROXIES');
        if ($envProxies !== false && trim($envProxies) !== '') {
            $loadedConfig['trusted_proxies'] = array_filter(array_map('trim', explode(',', $envProxies)));
        }

        self::$config = $loadedConfig;
        return self::$config;
    }

    /**
     * Get or create PDO SQLite connection.
     * Throws RuntimeException with sanitized message if configuration is missing or invalid.
     */
    public static function getConnection(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $config = self::getConfig();
        $dbPath = $config['db_path'] ?? null;

        if (!$dbPath || !is_string($dbPath) || trim($dbPath) === '') {
            error_log('[CMS Error] Database configuration missing: CMS_DB_PATH or config/cms_config.php is not set.');
            throw new RuntimeException('Database configuration missing.');
        }

        if (!file_exists($dbPath)) {
            error_log("[CMS Error] Configured database file not found: {$dbPath}");
            throw new RuntimeException('Database unavailable.');
        }

        try {
            PrivateStorage::directory(dirname($dbPath));
            PrivateStorage::file($dbPath);
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

            // Enforce SQLite safety & concurrency pragmas
            $pdo->exec('PRAGMA foreign_keys = ON;');
            $pdo->exec('PRAGMA journal_mode = WAL;');
            $pdo->exec('PRAGMA busy_timeout = 5000;');

            foreach (['-wal', '-shm', '-journal'] as $suffix) {
                if (is_file($dbPath . $suffix)) PrivateStorage::file($dbPath . $suffix);
            }

            self::$instance = $pdo;
            return self::$instance;

        } catch (Throwable $e) {
            error_log('[CMS Error] PDO Connection failed: ' . $e->getMessage());
            throw new RuntimeException('Database connection failed.');
        }
    }

    /**
     * Reset cached instance and configuration (used for testing and CLI commands).
     */
    public static function reset(): void
    {
        self::$instance = null;
        self::$config = null;
    }
}
