<?php
/**
 * Authentication & Session Security Manager for cms_sfreibe
 * 
 * Features:
 * - Session authentication (HttpOnly, SameSite=Strict)
 * - Cryptographic CSRF protection with per-session tokens
 * - Configurable IP/Username rate limiting with fail-safe behavior
 * - Strict password_verify() with zero fallback credentials
 */

declare(strict_types=1);
require_once __DIR__ . '/PrivateStorage.php';
require_once __DIR__ . '/AdminCredentials.php';

class Auth
{
    public const DEFAULT_MAX_ATTEMPTS = 5;
    public const DEFAULT_WINDOW_SECONDS = 900; // 15 minutes

    /**
     * Start secure session if not already active.
     */
    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $config = Database::getConfig();
        $lifetime = (int)($config['session_lifetime'] ?? 1800); // 30 mins

        // Secure by default; local HTTP testing must explicitly set cookie_secure=false.
        $isHttps = ($config['cookie_secure'] ?? true) !== false;

        session_set_cookie_params([
            'lifetime' => 0, // Session cookie expires when browser closes
            'path' => '/api',
            'domain' => '',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Strict'
        ]);

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.gc_maxlifetime', (string)($config['session_max_lifetime'] ?? 28800));

        $savePath = $config['session_save_path'] ?? dirname(__DIR__) . '/data/sessions';
        if (!is_string($savePath) || $savePath === '') {
            throw new RuntimeException('Session storage unavailable.');
        }
        if (!is_dir($savePath) && !mkdir($savePath, 0700, true)) {
            throw new RuntimeException('Session storage unavailable.');
        }
        if (!is_writable($savePath)) throw new RuntimeException('Session storage unavailable.');
        PrivateStorage::directory($savePath);
        session_save_path($savePath);

        session_name('FREIBERGER_DESIGN_SESSION');
        if (DIRECTORY_SEPARATOR === '/') umask(0077);
        if (!session_start()) {
            throw new RuntimeException('Session storage unavailable.');
        }
        // Migrate the former site-wide cookie only during an explicit CMS request.
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => '/', 'secure' => $isHttps, 'httponly' => true, 'samesite' => 'Strict']);
        setcookie(session_name(), session_id(), ['path' => '/api', 'secure' => $isHttps, 'httponly' => true, 'samesite' => 'Strict']);
        if (ini_get('session.save_handler') === 'files') {
            PrivateStorage::file(session_save_path() . '/sess_' . session_id());
        }

        // Enforce session timeout & absolute expiration
        $now = time();
        if (isset($_SESSION['auth_user'])) {
            $lastActivity = $_SESSION['auth_last_activity'] ?? 0;
            $createdAt = $_SESSION['auth_created_at'] ?? 0;
            $maxLifetime = (int)($config['session_max_lifetime'] ?? 28800);

            if (($now - $lastActivity) > $lifetime || ($now - $createdAt) > $maxLifetime) {
                self::logout();
                return;
            }

            $_SESSION['auth_last_activity'] = $now;
        }

        // Initialize CSRF token if missing
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
    }

    /**
     * Check if currently logged in as administrator.
     */
    public static function isAuthenticated(): bool
    {
        self::startSession();
        if (empty($_SESSION['auth_user']) || !isset($_SESSION['auth_credential_version'])) return false;
        try {
            $current = AdminCredentials::current(Database::getConnection());
            if ($current !== null &&
                hash_equals((string)$current['username'], (string)$_SESSION['auth_user']) &&
                (int)$current['credential_version'] === (int)$_SESSION['auth_credential_version']) {
                $_SESSION['auth_password_change_required'] = (int)$current['must_change_password'] === 1;
                return true;
            }
        } catch (Throwable $e) {
            error_log('[CMS Security] Session credential check unavailable: ' . $e->getMessage());
        }
        unset($_SESSION['auth_user'], $_SESSION['auth_credential_version'], $_SESSION['auth_password_change_required']);
        return false;
    }

    public static function passwordChangeRequired(): bool
    {
        return self::isAuthenticated() && !empty($_SESSION['auth_password_change_required']);
    }

    public static function isFullyAuthenticated(): bool
    {
        return self::isAuthenticated() && empty($_SESSION['auth_password_change_required']);
    }

    /**
     * Enforce authentication for protected endpoints.
     */
    public static function requireAdmin(): void
    {
        if (!self::isAuthenticated()) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error' => 'Nicht autorisiert. Bitte melden Sie sich an.'
            ]);
            exit;
        }
        if (!empty($_SESSION['auth_password_change_required'])) {
            http_response_code(403);
            echo json_encode(['error' => 'PASSWORD_CHANGE_REQUIRED']);
            exit;
        }
    }

    /**
     * Get or generate the current session CSRF token.
     */
    public static function getCsrfToken(): string
    {
        self::startSession();
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    /**
     * Validate CSRF token on mutating requests.
     */
    public static function requireCsrf(): void
    {
        self::startSession();

        $providedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!$providedToken && isset($_POST['csrf_token'])) {
            $providedToken = (string)$_POST['csrf_token'];
        }

        $sessionToken = $_SESSION['csrf_token'] ?? '';

        if (!$sessionToken || !$providedToken || !hash_equals($sessionToken, $providedToken)) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'Ungültiges oder fehlendes CSRF-Token. Bitte Seite neu laden.'
            ]);
            exit;
        }
    }

    /**
     * Central rate limit validation with fail-safe handling and housekeeping.
     */
    public static function checkRateLimit(PDO $db, string $ip, string $username, int $maxAttempts, int $windowSeconds): array
    {
        // Clamp parameters to sensible bounds
        $maxAttempts = max(1, min(100, $maxAttempts));
        $windowSeconds = max(10, min(604800, $windowSeconds));

        $now = time();
        $windowStart = $now - $windowSeconds;

        try {
            // Housekeeping: delete records older than the active window (or 24h)
            $cleanupThreshold = $now - max($windowSeconds, 86400);
            $cleanStmt = $db->prepare("DELETE FROM login_attempts WHERE attempted_at < ?");
            $cleanStmt->execute([$cleanupThreshold]);

            // 1. IP-based limit: max attempts from this single IP regardless of usernames
            // Defends against password guessing / credential stuffing attacks from a single source
            $ipMaxAttempts = max($maxAttempts * 3, 15);
            $ipStmt = $db->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at >= ?");
            $ipStmt->execute([$ip, $windowStart]);
            $ipFailCount = (int)$ipStmt->fetchColumn();

            if ($ipFailCount >= $ipMaxAttempts) {
                return [
                    'allowed' => false,
                    'status' => 429,
                    'retry_after' => $windowSeconds,
                    'error' => 'Anmeldung vorübergehend nicht möglich. Bitte später erneut versuchen.'
                ];
            }

            // 2. User+IP combination limit: max attempts for this username FROM this IP
            // Prevents DoS lockouts across different IPs: an attacker on IP A cannot lock out admin on IP B!
            $userIpStmt = $db->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND username = ? AND attempted_at >= ?");
            $userIpStmt->execute([$ip, $username, $windowStart]);
            $userIpFailCount = (int)$userIpStmt->fetchColumn();

            if ($userIpFailCount >= $maxAttempts) {
                return [
                    'allowed' => false,
                    'status' => 429,
                    'retry_after' => $windowSeconds,
                    'error' => 'Anmeldung vorübergehend nicht möglich. Bitte später erneut versuchen.'
                ];
            }

            return ['allowed' => true];

        } catch (Throwable $e) {
            // Fail-safe: A database failure in the rate limiter must NOT allow unbounded attempts
            error_log('[CMS Security] Rate limit check database error: ' . $e->getMessage());
            return [
                'allowed' => false,
                'status' => 503,
                'retry_after' => 60,
                'error' => 'Sicherheitsprüfung vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.'
            ];
        }
    }

    /**
     * Attempt login with strict password verification and rate limiting.
     */
    public static function login(string $username, string $password): array
    {
        $ip = self::getClientIp();
        try {
            $db = Database::getConnection();
            $config = Database::getConfig();
        } catch (Throwable $e) {
            error_log('[CMS Security] Login security storage unavailable: ' . $e->getMessage());
            return self::securityUnavailable();
        }

        // 1. Configurable Rate Limiting
        $maxAttempts = (int)($config['rate_limit_max_attempts'] ?? self::DEFAULT_MAX_ATTEMPTS);
        $windowSeconds = (int)($config['rate_limit_window_seconds'] ?? self::DEFAULT_WINDOW_SECONDS);

        $rateCheck = self::checkRateLimit($db, $ip, $username, $maxAttempts, $windowSeconds);
        if (!$rateCheck['allowed']) {
            $status = $rateCheck['status'] ?? 429;
            http_response_code($status);
            if (!empty($rateCheck['retry_after'])) {
                header('Retry-After: ' . $rateCheck['retry_after']);
            }
            return [
                'success' => false,
                'status' => $status,
                'error' => $rateCheck['error']
            ];
        }

        // 2. Load the single persistent administrator. Configuration is never a credential source.
        try {
            $admin = AdminCredentials::current($db);
        } catch (Throwable $e) {
            error_log('[CMS Security] Admin credential storage unavailable: ' . $e->getMessage());
            return self::securityUnavailable();
        }
        $expectedUser = (string)($admin['username'] ?? '');
        $adminHash = (string)($admin['password_hash'] ?? '');

        // 3. Verify credentials strictly against configured hash
        $userMatches = $expectedUser !== '' && hash_equals($expectedUser, $username);
        $passMatches = $adminHash !== '' && password_verify($password, $adminHash);

        if (!$userMatches || !$passMatches) {
            // Log failed attempt for rate limiting
            try {
                $logStmt = $db->prepare("INSERT INTO login_attempts (ip, username, attempted_at) VALUES (?, ?, ?)");
                if (!$logStmt->execute([$ip, $username, time()])) {
                    throw new RuntimeException('Failed login attempt was not stored.');
                }
            } catch (Throwable $e) {
                error_log('[CMS Security] Failed to log login attempt: ' . $e->getMessage());
                return self::securityUnavailable();
            }

            http_response_code(401);
            return [
                'success' => false,
                'status' => 401,
                'error' => 'Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.'
            ];
        }

        // A failed security-storage write must never create an authenticated session.
        try {
            $clearStmt = $db->prepare("DELETE FROM login_attempts WHERE ip = ? AND username = ?");
            if (!$clearStmt->execute([$ip, $username])) {
                throw new RuntimeException('Failed login attempts could not be cleared.');
            }
        } catch (Throwable $e) {
            error_log('[CMS Security] Failed to clear login attempts: ' . $e->getMessage());
            return self::securityUnavailable();
        }

        // 4. Success: only now create and rotate the authenticated session.
        self::startSession();
        if (!session_regenerate_id(true)) {
            throw new RuntimeException('Session rotation failed.');
        }
        $now = time();
        $_SESSION['auth_user'] = $expectedUser;
        $_SESSION['auth_credential_version'] = (int)$admin['credential_version'];
        $_SESSION['auth_password_change_required'] = (int)$admin['must_change_password'] === 1;
        $_SESSION['auth_created_at'] = $now;
        $_SESSION['auth_last_activity'] = $now;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

        return [
            'success' => true,
            'status' => 200,
            'authenticated' => true,
            'passwordChangeRequired' => $_SESSION['auth_password_change_required'],
            'csrf_token' => $_SESSION['csrf_token'],
            'username' => $expectedUser
        ];
    }

    public static function changePassword(string $newPassword, string $confirmation): array
    {
        if (!self::isAuthenticated()) {
            http_response_code(401);
            return ['error' => 'Nicht autorisiert. Bitte melden Sie sich an.'];
        }
        if (empty($_SESSION['auth_password_change_required'])) {
            http_response_code(403);
            return ['error' => 'Passwortänderung nur im Erstzugang möglich.'];
        }
        try {
            $db = Database::getConnection();
            $username = (string)$_SESSION['auth_user'];
            $ip = self::getClientIp();
            $config = Database::getConfig();
            $limit = self::checkRateLimit($db, $ip, $username,
                (int)($config['rate_limit_max_attempts'] ?? self::DEFAULT_MAX_ATTEMPTS),
                (int)($config['rate_limit_window_seconds'] ?? self::DEFAULT_WINDOW_SECONDS));
            if (!$limit['allowed']) {
                http_response_code($limit['status']);
                header('Retry-After: ' . $limit['retry_after']);
                return ['error' => $limit['error']];
            }
            $admin = AdminCredentials::current($db);
            if ($admin === null || (int)$admin['credential_version'] !== (int)$_SESSION['auth_credential_version']) {
                return self::securityUnavailable();
            }
            $valid = $newPassword === $confirmation && strlen($newPassword) >= 16 &&
                strlen($newPassword) <= 72 && preg_match('/[A-Za-z]/', $newPassword) &&
                preg_match('/[0-9]/', $newPassword) && !password_verify($newPassword, $admin['password_hash']);
            if (!$valid) {
                self::recordFailure($db, $ip, $username);
                http_response_code(400);
                return ['error' => 'Neues Passwort: 16 bis 72 Byte, Buchstaben und Ziffern; Bestätigung muss übereinstimmen und es darf nicht das Einmalpasswort sein.'];
            }
            $hash = password_hash($newPassword, PASSWORD_DEFAULT);
            if (!is_string($hash)) return self::securityUnavailable();
            $db->beginTransaction();
            try {
                $stmt = $db->prepare('UPDATE admin_credentials SET password_hash = ?, must_change_password = 0, credential_version = credential_version + 1, updated_at = CURRENT_TIMESTAMP, password_changed_at = CURRENT_TIMESTAMP WHERE id = 1 AND credential_version = ? AND must_change_password = 1');
                $stmt->execute([$hash, (int)$admin['credential_version']]);
                if ($stmt->rowCount() !== 1) throw new RuntimeException('Credential version changed.');
                $clear = $db->prepare('DELETE FROM login_attempts WHERE ip = ? AND username = ?');
                $clear->execute([$ip, $username]);
                $db->commit();
            } catch (Throwable $e) {
                if ($db->inTransaction()) $db->rollBack();
                throw $e;
            }
            if (!session_regenerate_id(true)) throw new RuntimeException('Session rotation failed.');
            $_SESSION['auth_credential_version'] = (int)$admin['credential_version'] + 1;
            $_SESSION['auth_password_change_required'] = false;
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            return ['success' => true, 'authenticated' => true, 'passwordChangeRequired' => false,
                'csrf_token' => $_SESSION['csrf_token']];
        } catch (Throwable $e) {
            error_log('[CMS Security] Password change unavailable: ' . $e->getMessage());
            return self::securityUnavailable();
        }
    }

    private static function recordFailure(PDO $db, string $ip, string $username): void
    {
        $stmt = $db->prepare('INSERT INTO login_attempts (ip, username, attempted_at) VALUES (?, ?, ?)');
        if (!$stmt->execute([$ip, $username, time()])) throw new RuntimeException('Security attempt not stored.');
    }

    private static function securityUnavailable(): array
    {
        http_response_code(503);
        header('Retry-After: 60');
        return [
            'success' => false,
            'status' => 503,
            'error' => 'Sicherheitsprüfung vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.'
        ];
    }

    /**
     * Destroy the current session and clear cookie.
     */
    public static function logout(): void
    {
        self::startSession();

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();
    }

    /**
     * Resolve client IP address safely, trusting forward headers ONLY from configured proxies.
     */
    public static function getClientIp(): string
    {
        $rawClientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $config = Database::getConfig();
        $trustedProxies = (array)($config['trusted_proxies'] ?? []);

        if (in_array($rawClientIp, $trustedProxies, true) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $forwarded = array_reverse(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
            foreach ($forwarded as $value) {
                $candidateIp = trim($value);
                if (!filter_var($candidateIp, FILTER_VALIDATE_IP)) return $rawClientIp;
                if (!in_array($candidateIp, $trustedProxies, true)) return $candidateIp;
            }
        }

        return $rawClientIp;
    }
}
