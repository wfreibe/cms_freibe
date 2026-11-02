<?php
declare(strict_types=1);
// Passwords never appear in command arguments; hashes are written only to a private new file.
if ($argc !== 3 || $argv[1] !== '--output') {
    fwrite(STDERR, "Usage: php bin/generate_hash.php --output PRIVATE_NEW_FILE\nRead password from stdin supplied by your local secret store, or use the hidden POSIX terminal prompt.\n");
    exit(1);
}
$hidden = false;
$exitCode = 0;
try {
    if (stream_isatty(STDIN)) {
        if (DIRECTORY_SEPARATOR === '\\') throw new RuntimeException('Use a local secret store to pipe the password to stdin on Windows.');
        exec('stty -echo', $unused, $code);
        if ($code !== 0) throw new RuntimeException('Cannot hide terminal input.');
        $hidden = true;
        fwrite(STDERR, 'Password: ');
    }
    $password = rtrim((string)fgets(STDIN, 1026), "\r\n");
    if (strlen($password) < 12 || strlen($password) > 72) throw new RuntimeException('Use 12 to 72 bytes for bcrypt.');
    $oldMask = umask(0077);
    $file = fopen($argv[2], 'x');
    umask($oldMask);
    if (!$file) throw new RuntimeException('Output must be a new private file.');
    $hash = password_hash($password, PASSWORD_BCRYPT) . "\n";
    if (fwrite($file, $hash) !== strlen($hash)) throw new RuntimeException('Hash write failed.');
    fclose($file);
    fwrite(STDERR, "\nHash written to the private output file. Transfer it locally into configuration and remove the temporary file.\n");
} catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . "\n"); $exitCode = 1; }
finally { if ($hidden) exec('stty echo'); }

exit($exitCode);
