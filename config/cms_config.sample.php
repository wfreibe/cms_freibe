<?php
/**
 * Configuration Sample for cms_sfreibe
 * 
 * Copy this file to config/cms_config.php or set corresponding environment variables.
 * DO NOT commit production passwords or hashes to version control!
 */

declare(strict_types=1);

return [
    // Persistent absolute path to SQLite database outside the webroot
    // Deterministic path resolution without realpath() to prevent invalid paths if directory is not yet created.
    // E.g. dirname(__DIR__) . '/data/content.sqlite' or '/var/www/vhosts/example.com/shared/data/content.sqlite'
    'db_path' => getenv('CMS_DB_PATH') ?: (dirname(__DIR__) . '/data/content.sqlite'),

    // Admin credentials are provisioned once in SQLite using bin/provision_admin.php.
    // No admin password or hash belongs in this configuration.

    // Session inactivity timeout in seconds (default: 1800 = 30 minutes)
    'session_lifetime' => 1800,

    // Max session lifetime from initial login in seconds (default: 28800 = 8 hours)
    'session_max_lifetime' => 28800,

    // Writable private directory for PHP session files (outside the served webroot)
    'session_save_path' => dirname(__DIR__) . '/data/sessions',

    // Cookie security flags (set to true on production HTTPS, false during non-SSL local tests)
    'cookie_secure' => true,

    // Login rate limiting: maximum failed attempts before temporary lockout
    'rate_limit_max_attempts' => 5,

    // Login rate limiting window in seconds (default: 900 = 15 minutes)
    'rate_limit_window_seconds' => 900,

    // Trusted reverse proxies (exact IP addresses only; CIDR is not supported)
    // E.g. ['127.0.0.1', '::1']
    'trusted_proxies' => [],

    // Directory for atomic database backups (outside webroot)
    'backup_dir' => getenv('CMS_BACKUP_DIR') ?: (dirname(__DIR__) . '/backups'),

    // Allowed CORS origins for local development (empty in production for strict same-origin)
    'cors_allowed_origins' => []
];
