<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/Auth.php';
$dir = sys_get_temp_dir() . '/cms_sfreibe_sessions_' . bin2hex(random_bytes(6));
mkdir($dir, 0700);
$config = $dir . '/config.php';
$sessionPathLiteral = var_export($dir, true);
file_put_contents($config, "<?php return ['session_save_path'=>{$sessionPathLiteral}, 'cookie_secure'=>true, 'session_lifetime'=>1800, 'session_max_lifetime'=>28800, 'trusted_proxies'=>['127.0.0.1']];");
putenv('CMS_CONFIG_PATH=' . $config);
try {
    Auth::startSession();
    if (session_save_path() !== $dir) throw new RuntimeException('Session storage path');
    if (session_name() !== 'CMS_SFREIBE_SESSION') throw new RuntimeException('Session name');
    $params = session_get_cookie_params();
    if (!$params['secure'] || !$params['httponly'] || $params['samesite'] !== 'Strict') throw new RuntimeException('Cookie flags');
    $_SESSION['auth_user'] = 'synthetic'; $_SESSION['auth_last_activity'] = time()-1801; $_SESSION['auth_created_at'] = time();
    session_write_close(); Auth::startSession();
    if (Auth::isAuthenticated()) throw new RuntimeException('Idle timeout failed');
    $_SESSION['auth_user'] = 'synthetic'; $_SESSION['auth_last_activity'] = time(); $_SESSION['auth_created_at'] = time()-28801;
    session_write_close(); Auth::startSession();
    if (Auth::isAuthenticated()) throw new RuntimeException('Absolute timeout failed');
    $_SERVER['REMOTE_ADDR'] = '203.0.113.1'; $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.2';
    if (Auth::getClientIp() !== '203.0.113.1') throw new RuntimeException('Untrusted proxy accepted');
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1'; $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.2, 203.0.113.1';
    if (Auth::getClientIp() !== '203.0.113.1') throw new RuntimeException('Proxy chain spoof accepted');
    session_destroy();
    echo "Session tests: Secure/HttpOnly/Strict, idle/absolute expiry, untrusted proxy and spoofed chain passed.\n";
} finally { foreach (glob($dir . '/*') as $file) unlink($file); rmdir($dir); }
