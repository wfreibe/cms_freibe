<?php
declare(strict_types=1);
final class MediaUpload
{
    public const MAX_BYTES = 8 * 1024 * 1024;
    public static function directory(): string
    {
        return dirname(Database::getConfig()['db_path']) . '/uploads';
    }
    public static function store(string $source): string
    {
        if (!function_exists('imagecreatefromstring')) throw new RuntimeException('Bildverarbeitung ist nicht verfügbar.');
        $size = filesize($source);
        if (!$size || $size > self::MAX_BYTES) throw new InvalidArgumentException('Bilder dürfen höchstens 8 MB groß sein.');
        $info = @getimagesize($source);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) throw new InvalidArgumentException('Bitte ein JPEG-, PNG- oder WebP-Bild wählen.');
        if ($info[0] * $info[1] > 12000000) throw new InvalidArgumentException('Das Bild darf höchstens 12 Millionen Pixel enthalten.');
        $image = @imagecreatefromstring((string)file_get_contents($source));
        if (!$image) throw new InvalidArgumentException('Die Bilddatei ist beschädigt.');
        $directory = self::directory();
        if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new RuntimeException('Bildspeicher konnte nicht angelegt werden.');
        $id = bin2hex(random_bytes(16));
        $extension = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]];
        $temporary = tempnam($directory, 'upload_');
        if ($temporary === false) throw new RuntimeException('Bildspeicher nicht verfügbar.');
        try {
            // Re-encode only the image pixels; never publish the uploaded file bytes.
            imagealphablending($image, false); imagesavealpha($image, true);
            $saved = match ($info[2]) {
                IMAGETYPE_JPEG => imagejpeg($image, $temporary, 90),
                IMAGETYPE_PNG => imagepng($image, $temporary),
                IMAGETYPE_WEBP => imagewebp($image, $temporary, 90),
            };
            if (!$saved || !rename($temporary, $directory . '/' . $id . '.' . $extension)) throw new RuntimeException('Bild konnte nicht gespeichert werden.');
            chmod($directory . '/' . $id . '.' . $extension, 0600);
        } finally {
            imagedestroy($image);
            if (is_file($temporary)) unlink($temporary);
        }
        return '/api/media/' . $id;
    }
    public static function serve(string $id): void
    {
        if (!preg_match('/^[a-f0-9]{32}$/D', $id)) { http_response_code(404); exit; }
        foreach (['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'] as $extension => $mime) {
            $file = self::directory() . '/' . $id . '.' . $extension;
            if (!is_file($file)) continue;
            header('Content-Type: ' . $mime);
            header('Cache-Control: public, max-age=31536000, immutable');
            header('Content-Length: ' . filesize($file));
            header('X-Content-Type-Options: nosniff');
            readfile($file); exit;
        }
        http_response_code(404); exit;
    }
}
