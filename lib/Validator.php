<?php
/**
 * Central Input & Request Validator for cms_sfreibe
 * 
 * Enforces uniform server-side validation for all write operations:
 * - Content-Type and payload size checks (413, 415)
 * - Strict type checks (Arrays or objects where scalar expected -> HTTP 400)
 * - Maximum field lengths and allowed characters
 * - Strict language restrictions ('de', 'en', 'fr')
 * - Image URL validation (disallowing protocol-relative // URLs)
 * - Numeric boundaries for sorting and list lengths
 */

declare(strict_types=1);
require_once __DIR__ . '/ContentBlocks.php';
require_once __DIR__ . '/MenuHierarchy.php';
require_once __DIR__ . '/PageUrls.php';

class Validator
{
    public const MAX_PAYLOAD_BYTES = 1048576; // 1 MB
    public const MAX_ID_LENGTH = 64;
    public const MAX_TITLE_LENGTH = 255;
    public const MAX_NAV_LABEL_LENGTH = 100;
    public const MAX_SUBTITLE_LENGTH = 500;
    public const MAX_CONTENT_LENGTH = 100000;
    public const MAX_ACCORDION_TITLE_LENGTH = 255;
    public const MAX_ACCORDION_CONTENT_LENGTH = 50000;
    public const MAX_ACCORDIONS_PER_SECTION = 50;
    public const MAX_IMAGE_URL_LENGTH = 500;

    public const ALLOWED_LANGUAGES = ['de', 'en', 'fr'];

    /**
     * Validate incoming HTTP request headers and payload size for writing endpoints.
     */
    public static function validateRequestMedia(): void
    {
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > self::MAX_PAYLOAD_BYTES) {
            http_response_code(413);
            echo json_encode([
                'success' => false,
                'error' => 'Anfrage zu groß (max. 1 MB erlaubt).'
            ]);
            exit;
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
            if (strtolower(trim(explode(';', $contentType)[0])) !== 'application/json') {
                http_response_code(415);
                echo json_encode([
                    'success' => false,
                    'error' => 'Inhaltstyp muss application/json sein.'
                ]);
                exit;
            }
        }
    }

    /**
     * Validate and clean a section ID.
     */
    public static function cleanSectionId(string $rawId): string
    {
        $clean = preg_replace('/[^a-z0-9_-]/', '-', strtolower(trim($rawId)));
        return trim((string)$clean, '-');
    }

    /**
     * Validate language parameter.
     */
    public static function validateLanguage(?string $lang): string
    {
        $l = strtolower(trim((string)$lang));
        if (!in_array($l, self::ALLOWED_LANGUAGES, true)) {
            return 'de'; // Safe default
        }
        return $l;
    }

    /**
     * Strictly validate language; returns error string or null if valid.
     */
    public static function checkStrictLanguage($lang): ?string
    {
        if (!is_string($lang)) {
            return "Sprache muss eine Zeichenkette sein ('de', 'en' oder 'fr').";
        }
        $l = strtolower(trim($lang));
        if (!in_array($l, self::ALLOWED_LANGUAGES, true)) {
            return "Ungültige Sprache: '{$lang}'. Erlaubt sind ausschließlich: 'de', 'en', 'fr'.";
        }
        return null;
    }

    /**
     * Validate section data for POST / PUT.
     * Returns array of error messages (empty if valid).
     */
    public static function validateSectionPayload(array $data, bool $isNew = false): array
    {
        $errors = [];
        if (array_key_exists('url_slug', $data)) {
            try { PageUrls::input($data['url_slug']); }
            catch (InvalidArgumentException $e) { $errors[] = $e->getMessage(); }
        }
        if (array_key_exists('content_blocks', $data)) {
            try { ContentBlocks::normalize($data['content_blocks']); }
            catch (InvalidArgumentException $e) { $errors[] = $e->getMessage(); }
        }
        foreach (['is_published', 'is_active', 'show_in_navigation'] as $field) {
            if (array_key_exists($field, $data) && !in_array($data[$field], [0, 1, false, true], true)) $errors[] = 'Ungültiger Statuswert.';
        }
        if (array_key_exists('contact_info', $data) && $data['contact_info'] !== null) {
            $info = $data['contact_info'];
            $limits = ['company' => 150, 'role' => 250, 'email' => 255, 'phone' => 50, 'web' => 500, 'note' => 1000];
            if (!is_array($info) || (array_is_list($info) && $info !== [])) {
                $errors[] = 'contact_info muss ein Objekt sein.';
            } else {
                foreach ($info as $key => $value) {
                    if (!isset($limits[$key]) || !is_string($value) || mb_strlen($value) > $limits[$key] || preg_match('/[<>\x00-\x1f]/u', $value)) {
                        $errors[] = 'Ungültiges Kontaktfeld.';
                        continue;
                    }
                    if ($value === '') continue;
                    if ($key === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) $errors[] = 'Ungültige E-Mail-Adresse.';
                    if ($key === 'phone' && !preg_match('/^\+?[0-9 ()\/.\-]{5,49}$/D', $value)) $errors[] = 'Ungültige Telefonnummer.';
                    if ($key === 'web' && (!str_starts_with($value, 'https://') || !filter_var($value, FILTER_VALIDATE_URL) || parse_url($value, PHP_URL_USER) !== null)) $errors[] = 'Webadresse muss eine HTTPS-URL sein.';
                }
            }
        }

        // Check ID for new section
        if ($isNew) {
            if (!isset($data['id'])) {
                $errors[] = 'Sektions-ID ist erforderlich.';
            } elseif (!is_scalar($data['id'])) {
                $errors[] = 'Sektions-ID muss eine Zeichenkette sein.';
            } else {
                $rawId = trim((string)$data['id']);
                $cleanId = self::cleanSectionId($rawId);
                if ($cleanId === '') {
                    $errors[] = 'Sektions-ID ist erforderlich.';
                } elseif (strlen($cleanId) > self::MAX_ID_LENGTH) {
                    $errors[] = 'Sektions-ID darf maximal ' . self::MAX_ID_LENGTH . ' Zeichen lang sein.';
                }
            }
        }

        // Title
        if (isset($data['title']) || $isNew) {
            if (isset($data['title']) && !is_scalar($data['title'])) {
                $errors[] = 'Titel muss eine Zeichenkette sein.';
            } else {
                $title = trim((string)($data['title'] ?? ''));
                if ($title === '') {
                    $errors[] = 'Titel darf nicht leer sein.';
                } elseif (mb_strlen($title) > self::MAX_TITLE_LENGTH) {
                    $errors[] = 'Titel überschreitet die maximale Länge von ' . self::MAX_TITLE_LENGTH . ' Zeichen.';
                }
            }
        }

        // Navigation label
        if (isset($data['nav_label']) || $isNew) {
            if (isset($data['nav_label']) && !is_scalar($data['nav_label'])) {
                $errors[] = 'Menüname muss eine Zeichenkette sein.';
            } else {
                $navLabel = trim((string)($data['nav_label'] ?? ''));
                if ($navLabel === '' && $isNew) {
                    $errors[] = 'Menüname ist erforderlich.';
                } elseif (mb_strlen($navLabel) > self::MAX_NAV_LABEL_LENGTH) {
                    $errors[] = 'Menüname überschreitet die maximale Länge von ' . self::MAX_NAV_LABEL_LENGTH . ' Zeichen.';
                }
            }
        }

        // Subtitle
        if (isset($data['subtitle'])) {
            if (!is_scalar($data['subtitle'])) {
                $errors[] = 'Untertitel muss eine Zeichenkette sein.';
            } else {
                $sub = trim((string)$data['subtitle']);
                if (mb_strlen($sub) > self::MAX_SUBTITLE_LENGTH) {
                    $errors[] = 'Untertitel überschreitet die maximale Länge von ' . self::MAX_SUBTITLE_LENGTH . ' Zeichen.';
                }
            }
        }

        // HTML Content
        if (isset($data['content']) || $isNew) {
            if (isset($data['content']) && !is_scalar($data['content'])) {
                $errors[] = 'Inhalt muss eine Zeichenkette sein.';
            } else {
                $content = (string)($data['content'] ?? '');
                if (strlen($content) > self::MAX_CONTENT_LENGTH) {
                    $errors[] = 'Inhalt überschreitet die maximale Größe von ' . self::MAX_CONTENT_LENGTH . ' Bytes.';
                }
            }
        }

        if (array_key_exists('menu_parent', $data)) {
            try { MenuHierarchy::input($data['menu_parent']); } catch (InvalidArgumentException $e) { $errors[] = $e->getMessage(); }
        }

        // Sort order
        if (isset($data['sort_order'])) {
            if (!is_numeric($data['sort_order'])) {
                $errors[] = 'Sortierreihenfolge muss eine Zahl sein.';
            } else {
                $sort = (int)$data['sort_order'];
                if ($sort < 0 || $sort > 999) {
                    $errors[] = 'Sortierreihenfolge muss zwischen 0 und 999 liegen.';
                }
            }
        }

        if (array_key_exists('image_layout', $data) && !in_array($data['image_layout'], ['original','wide','left','right'], true)) $errors[] = 'Ungültige Bilddarstellung.';

        // Images
        if (isset($data['image_url']) && $data['image_url'] !== null && $data['image_url'] !== '') {
            if (!is_scalar($data['image_url'])) {
                $errors[] = 'Bild-URL muss eine Zeichenkette sein.';
            } else {
                $img = trim((string)$data['image_url']);
                if (strlen($img) > self::MAX_IMAGE_URL_LENGTH || !self::isValidSafeUrl($img, true)) {
                    $errors[] = 'Ungültige oder unsichere Bild-URL (image_url).';
                }
            }
        }

        if (isset($data['bg_image_url']) && $data['bg_image_url'] !== null && $data['bg_image_url'] !== '') {
            if (!is_scalar($data['bg_image_url'])) {
                $errors[] = 'Hintergrundbild-URL muss eine Zeichenkette sein.';
            } else {
                $bgImg = trim((string)$data['bg_image_url']);
                if (strlen($bgImg) > self::MAX_IMAGE_URL_LENGTH || !self::isValidSafeUrl($bgImg, true)) {
                    $errors[] = 'Ungültige oder unsichere Hintergrundbild-URL (bg_image_url).';
                }
            }
        }

        if (isset($data['bg_color']) && $data['bg_color'] !== null && $data['bg_color'] !== '') {
            if (!is_scalar($data['bg_color'])) {
                $errors[] = 'Hintergrundfarbe muss eine Zeichenkette sein.';
            } elseif (strlen((string)$data['bg_color']) > 50) {
                $errors[] = 'Hintergrundfarbe ist zu lang.';
            }
        }

        // Publication & Navigation status (Migration 005)
        if (isset($data['is_published'])) {
            if (!is_numeric($data['is_published']) && !is_bool($data['is_published'])) {
                $errors[] = 'is_published muss ein boolescher Wert oder 0/1 sein.';
            } else {
                $pub = (int)$data['is_published'];
                if ($pub !== 0 && $pub !== 1) {
                    $errors[] = 'is_published muss 0 oder 1 sein.';
                }
            }
        }

        if (isset($data['show_in_navigation'])) {
            if (!is_numeric($data['show_in_navigation']) && !is_bool($data['show_in_navigation'])) {
                $errors[] = 'show_in_navigation muss ein boolescher Wert oder 0/1 sein.';
            } else {
                $nav = (int)$data['show_in_navigation'];
                if ($nav !== 0 && $nav !== 1) {
                    $errors[] = 'show_in_navigation muss 0 oder 1 sein.';
                }
            }
        }

        // Accordions
        if (isset($data['accordions'])) {
            if (!is_array($data['accordions'])) {
                $errors[] = 'Akkordeons müssen als Array übergeben werden.';
            } else {
                if (count($data['accordions']) > self::MAX_ACCORDIONS_PER_SECTION) {
                    $errors[] = 'Maximale Anzahl an Akkordeons (' . self::MAX_ACCORDIONS_PER_SECTION . ') überschritten.';
                }

                foreach ($data['accordions'] as $idx => $acc) {
                    if (!is_array($acc)) {
                        $errors[] = "Akkordeon an Index {$idx} ist ungültig (Array erwartet).";
                        continue;
                    }

                    foreach (['is_published', 'is_active'] as $field) {
                        if (array_key_exists($field, $acc) && !in_array($acc[$field], [0, 1, false, true], true)) $errors[] = 'Ungültiger Akkordeonstatus.';
                    }
                    if (isset($acc['title']) && !is_scalar($acc['title'])) {
                        $errors[] = "Titel des Akkordeons an Index {$idx} muss eine Zeichenkette sein.";
                    } elseif (isset($acc['title']) && mb_strlen(trim((string)$acc['title'])) > self::MAX_ACCORDION_TITLE_LENGTH) {
                        $errors[] = "Titel des Akkordeons an Index {$idx} ist zu lang.";
                    }

                    if (isset($acc['content']) && !is_scalar($acc['content'])) {
                        $errors[] = "Inhalt des Akkordeons an Index {$idx} muss eine Zeichenkette sein.";
                    } elseif (isset($acc['content']) && strlen((string)$acc['content']) > self::MAX_ACCORDION_CONTENT_LENGTH) {
                        $errors[] = "Inhalt des Akkordeons an Index {$idx} ist zu groß.";
                    }

                    if (isset($acc['sort_order']) && !is_numeric($acc['sort_order'])) {
                        $errors[] = "Sortierung des Akkordeons an Index {$idx} muss eine Zahl sein.";
                    }

                    if (isset($acc['is_published'])) {
                        if (!is_numeric($acc['is_published']) && !is_bool($acc['is_published'])) {
                            $errors[] = "is_published des Akkordeons an Index {$idx} muss ein boolescher Wert oder 0/1 sein.";
                        }
                    }
                }
            }
        }

        return $errors;
    }

    /**
     * Validate whether a URL is strictly safe.
     * Rejects protocol-relative URLs (e.g. '//evil.example').
     * Allows relative paths starting with a single '/' (e.g. '/images/pic.jpg').
     * Allows explicit https:// URLs.
     */
    public static function isValidSafeUrl(?string $url, bool $isImage = false): bool
    {
        if ($url === null || trim($url) === '') {
            return true;
        }

        $trimmed = trim($url);

        // Disallow dangerous URI schemes
        if (preg_match('/^\s*(javascript|data|vbscript):/i', $trimmed)) {
            return false;
        }

        // Disallow protocol-relative URLs (//example.com or \\example.com)
        if (str_starts_with($trimmed, '//') || str_starts_with($trimmed, '\\\\')) {
            return false;
        }

        // Relative path starting with single /
        if (str_starts_with($trimmed, '/')) {
            if ($isImage) {
                // Uploaded images are served through this exact validated endpoint.
                if (preg_match('#^/api/media/[a-f0-9]{32}$#D', $trimmed)) return true;
                // Must have safe image file extension
                return (bool)preg_match('#^/[a-zA-Z0-9_\-\./%]+\.(jpg|jpeg|png|gif|webp|svg)$#i', $trimmed);
            }
            return (bool)preg_match('#^/[a-zA-Z0-9_\-\./%#?=&]*$#', $trimmed);
        }

        // Explicit HTTPS URL
        if (str_starts_with($trimmed, 'https://')) {
            if (!filter_var($trimmed, FILTER_VALIDATE_URL)) {
                return false;
            }
            if ($isImage) {
                $parsed = parse_url($trimmed, PHP_URL_PATH);
                return (bool)preg_match('#\.(jpg|jpeg|png|gif|webp|svg)$#i', (string)$parsed);
            }
            return true;
        }

        return false;
    }
}
