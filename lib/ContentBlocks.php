<?php
declare(strict_types=1);
require_once __DIR__ . '/HtmlSanitizer.php';

/** Typed page blocks; HTML never controls embed URLs or iframe attributes. */
final class ContentBlocks
{
    public const TYPES = ['legacy', 'text', 'image', 'slideshow', 'accordion', 'youtube', 'audio', 'link'];

    public static function defaults(): array
    {
        return [['id' => 'existing-content', 'type' => 'legacy', 'enabled' => true, 'data' => []]];
    }

    public static function response($stored, bool $admin): array
    {
        $blocks = $stored === null ? self::defaults() : json_decode($stored, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($blocks) || !array_is_list($blocks)) throw new RuntimeException('Invalid stored blocks.');
        return $admin ? $blocks : array_values(array_filter($blocks, static fn($b) => $b['enabled'] === true));
    }

    public static function normalize($blocks): array
    {
        if (!is_array($blocks) || !array_is_list($blocks) || count($blocks) > 50) self::fail('Höchstens 50 Inhaltsbausteine sind möglich.');
        if (strlen(json_encode($blocks, JSON_THROW_ON_ERROR)) > 450000) self::fail('Die Inhaltsbausteine sind zusammen zu groß.');
        $result = []; $ids = []; $legacy = false;
        foreach ($blocks as $block) {
            if (!is_array($block) || !is_string($block['id'] ?? null) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $block['id'])) self::fail('Ungültige Baustein-ID.');
            if (isset($ids[$block['id']])) self::fail('Baustein-IDs müssen eindeutig sein.');
            $ids[$block['id']] = true;
            $type = $block['type'] ?? null;
            if (!in_array($type, self::TYPES, true)) self::fail('Unbekannter Bausteintyp.');
            if (!is_bool($block['enabled'] ?? null)) self::fail('Der Sichtbarkeitsstatus muss wahr oder falsch sein.');
            $d = $block['data'] ?? [];
            if (!is_array($d) || ($d !== [] && array_is_list($d))) self::fail('Ungültige Bausteindaten.');
            $clean = [];
            if ($type === 'legacy') {
                if ($legacy) self::fail('Der bestehende Seiteninhalt darf nur einmal vorkommen.');
                $legacy = true;
            } else {
                $clean['title'] = self::text($d, 'title', 255);
                if (in_array($type, ['text','image'], true)) $clean['html'] = HtmlSanitizer::clean(self::text($d, 'html', 100000));
                if ($type === 'image') {
                    $clean['src'] = self::image(self::text($d, 'src', 500));
                    $clean['alt'] = self::text($d, 'alt', 500);
                    $clean['caption'] = self::text($d, 'caption', 500);
                    $o = $d['options'] ?? [];
                    if (!is_array($o)) self::fail('Ungültige Bildoptionen.');
                    $clean['options'] = [
                        'format' => self::choice($o, 'format', ['original','16:9','3:2','4:3','1:1','3:4'], 'original'),
                        'layout' => self::choice($o, 'layout', ['above','beside'], 'above'),
                        'align' => self::choice($o, 'align', ['left','center','right'], 'center'),
                        'width' => self::number($o, 'width', 25, 100, 100),
                        'focus_x' => self::number($o, 'focus_x', 0, 100, 50),
                        'focus_y' => self::number($o, 'focus_y', 0, 100, 50),
                    ];
                    if ($clean['options']['layout'] === 'beside' && $clean['options']['align'] === 'center') $clean['options']['align'] = 'left';
                }
                if ($type === 'slideshow') {
                    $clean['interval'] = self::number($d, 'interval', 3, 20, 5);
                    $clean['images'] = [];
                    foreach (self::list($d, 'images', 50) as $image) {
                        if (!is_array($image)) self::fail('Ungültiges Slideshow-Bild.');
                        $clean['images'][] = ['src' => self::image(self::text($image, 'src', 500)), 'caption' => self::text($image, 'caption', 500), 'title' => self::text($image, 'title', 200)];
                    }
                }
                if ($type === 'accordion') {
                    $clean['items'] = []; $itemIds = [];
                    foreach (self::list($d, 'items', 50) as $item) {
                        if (!is_array($item)) self::fail('Ungültiger Akkordeon-Eintrag.');
                        $id = self::text($item, 'id', 64);
                        if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $id) || isset($itemIds[$id])) self::fail('Ungültige oder doppelte Akkordeon-ID.');
                        $itemIds[$id] = true;
                        $clean['items'][] = ['id' => $id, 'title' => self::text($item, 'title', 255), 'html' => HtmlSanitizer::clean(self::text($item, 'html', 50000))];
                    }
                }
                if ($type === 'youtube') {
                    $clean['video'] = self::youtube(self::text($d, 'video', 500));
                    $clean['cover'] = self::image(self::text($d, 'cover', 500));
                    $clean['caption'] = self::text($d, 'caption', 500);
                }
                if ($type === 'audio') {
                    $src = self::text($d, 'src', 500);
                    if ($src !== '' && (!self::localPath($src) || !preg_match('#^/[a-zA-Z0-9_./%\-]+\.(mp3|ogg|wav|m4a)$#iD', $src))) self::fail('Audio benötigt eine lokale MP3-, OGG-, WAV- oder M4A-Datei.');
                    $clean['src'] = $src;
                    $clean['caption'] = self::text($d, 'caption', 500);
                }
                if ($type === 'link') {
                    $href = self::text($d, 'href', 500);
                    if ($href !== '' && (!Validator::isValidSafeUrl($href) || preg_match('/[\x00-\x20\\\\]/', $href) || parse_url($href, PHP_URL_USER) !== null)) self::fail('Der Link muss ein lokaler Pfad oder eine gültige HTTPS-Adresse sein.');
                    $clean['href'] = $href;
                    $clean['label'] = self::text($d, 'label', 150);
                    $clean['style'] = self::choice($d, 'style', ['link','button'], 'button');
                }
            }
            $result[] = ['id' => $block['id'], 'type' => $type, 'enabled' => $block['enabled'], 'data' => $clean];
        }
        return $result;
    }

    public static function youtube(string $value): string
    {
        $value = trim($value);
        if ($value === '' || preg_match('/^[a-zA-Z0-9_-]{11}$/D', $value)) return $value;
        $url = parse_url($value);
        if (!$url || !in_array(strtolower($url['scheme'] ?? ''), ['https','http'], true) || isset($url['user']) || isset($url['pass']) || isset($url['port'])) self::fail('Bitte eine gültige YouTube-Adresse oder Video-ID eingeben.');
        $host = strtolower($url['host'] ?? ''); $path = $url['path'] ?? ''; $id = '';
        if ($host === 'youtu.be') $id = trim($path, '/');
        elseif (in_array($host, ['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'], true)) {
            if ($path === '/watch') { parse_str($url['query'] ?? '', $q); $id = $q['v'] ?? ''; }
            elseif (preg_match('~^/(?:embed|shorts|live)/([^/]+)/?$~', $path, $m)) $id = $m[1];
        }
        if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{11}$/D', $id)) self::fail('Bitte eine gültige YouTube-Adresse oder Video-ID eingeben.');
        return $id;
    }

    private static function image(string $src): string
    {
        if ($src !== '' && (!self::localPath($src) || !Validator::isValidSafeUrl($src, true))) self::fail('Bitte ein Bild hochladen oder einen lokalen Bildpfad verwenden.');
        return $src;
    }

    private static function localPath(string $src): bool
    {
        $decoded = rawurldecode($src);
        return str_starts_with($src, '/') && !str_starts_with($src, '//') && !preg_match('/[\x00-\x20\\\\]/', $decoded) && !str_starts_with($decoded, '//') && !preg_match('~(^|/)\.\.?(/|$)~', $decoded);
    }

    private static function text(array $data, string $key, int $limit): string
    {
        $value = $data[$key] ?? '';
        if (!is_string($value) || mb_strlen($value) > $limit || str_contains($value, "\0")) self::fail('Ungültiges oder zu langes Bausteinfeld: '.$key);
        return $value;
    }

    private static function choice(array $d, string $k, array $values, string $fallback): string
    {
        $v = $d[$k] ?? $fallback;
        if (!in_array($v, $values, true)) self::fail('Ungültige Option: '.$k);
        return $v;
    }

    private static function number(array $d, string $k, int $min, int $max, int $fallback): int
    {
        $v = $d[$k] ?? $fallback;
        if (!is_int($v) || $v < $min || $v > $max) self::fail('Ungültiger Zahlenwert: '.$k);
        return $v;
    }

    private static function list(array $d, string $k, int $max): array
    {
        $v = $d[$k] ?? [];
        if (!is_array($v) || !array_is_list($v) || count($v) > $max) self::fail('Ungültige oder zu lange Liste: '.$k);
        return $v;
    }

    private static function fail(string $message): never { throw new InvalidArgumentException($message); }
}
