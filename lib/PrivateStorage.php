<?php
declare(strict_types=1);

/** Restrict private runtime files on systems with POSIX permission bits. */
final class PrivateStorage
{
    public static function file(string $path): void
    {
        self::protect($path, 0600, false);
    }

    public static function directory(string $path): void
    {
        self::protect($path, 0700, true);
    }

    private static function protect(string $path, int $mode, bool $directory): void
    {
        if (DIRECTORY_SEPARATOR !== '/') return;
        if ($directory ? !is_dir($path) : !is_file($path)) {
            throw new RuntimeException('Private storage path unavailable.');
        }
        if (!chmod($path, $mode)) {
            throw new RuntimeException('Cannot protect private storage permissions.');
        }
        clearstatcache(true, $path);
        if ((fileperms($path) & 0777) !== $mode) {
            throw new RuntimeException('Private storage permissions were not applied.');
        }
    }
}
