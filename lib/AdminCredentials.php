<?php
declare(strict_types=1);

final class AdminCredentials
{
    public static function current(PDO $db): ?array
    {
        $stmt = $db->query('SELECT username, password_hash, must_change_password, credential_version FROM admin_credentials WHERE id = 1');
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    public static function oneTimePassword(): string
    {
        // 24 random bytes provide 192 bits of entropy; base64url is easy to transfer.
        return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    }

    public static function provision(PDO $db, string $username, bool $recover): string
    {
        if (!preg_match('/^[A-Za-z0-9_.-]{1,100}$/D', $username)) {
            throw new RuntimeException('Invalid admin username.');
        }
        $db->beginTransaction();
        try {
            $current = self::current($db);
            if ($current !== null && !$recover) throw new RuntimeException('Admin already provisioned.');
            if ($current === null && $recover) throw new RuntimeException('No admin exists for recovery.');

            if ($recover) {
                $limit = Auth::checkRateLimit($db, 'local-cli-reset', $username, Auth::DEFAULT_MAX_ATTEMPTS, Auth::DEFAULT_WINDOW_SECONDS);
                if (!$limit['allowed']) throw new RuntimeException('Admin recovery temporarily unavailable.');
            }

            $password = self::oneTimePassword();
            $hash = password_hash($password, PASSWORD_DEFAULT);
            if (!is_string($hash)) throw new RuntimeException('Password hashing failed.');
            if ($current === null) {
                $stmt = $db->prepare('INSERT INTO admin_credentials (id, username, password_hash, must_change_password, credential_version) VALUES (1, ?, ?, 1, 1)');
                $stmt->execute([$username, $hash]);
            } else {
                $stmt = $db->prepare('UPDATE admin_credentials SET username = ?, password_hash = ?, must_change_password = 1, credential_version = credential_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1');
                $stmt->execute([$username, $hash]);
                $attempt = $db->prepare('INSERT INTO login_attempts (ip, username, attempted_at) VALUES (?, ?, ?)');
                $attempt->execute(['local-cli-reset', $username, time()]);
            }
            $db->commit();
            return $password;
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }
}
