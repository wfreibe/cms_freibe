<?php
/**
 * Hardened Server-Side HTML Sanitizer for cms_sfreibe
 * 
 * Powered by ezyang/htmlpurifier with fail-closed security:
 * - Strips dangerous elements (<script>, <style>, <iframe>, <object>, <embed>, <svg>, <math>, etc.)
 * - Disarms event handlers (onerror, onload, onclick, on*)
 * - Neutralizes pseudo-protocols (javascript:, data:, vbscript:)
 * - Rejects protocol-relative URLs (//evil.example)
 * - Restricts inline CSS: blocks url(), expressions, and unsafe properties
 * - Enforces rel="noopener noreferrer" on target="_blank"
 * - FAIL-CLOSED: If the sanitizer cannot be initialized or fails,
 *   throws RuntimeException, triggering HTTP 500 without leaking raw unescaped content.
 */

declare(strict_types=1);

class HtmlSanitizer
{
    private static ?HTMLPurifier $purifier = null;
    private static bool $initialized = false;

    /**
     * Initialize the HTMLPurifier singleton.
     * Throws RuntimeException if HTMLPurifier cannot be loaded.
     */
    public static function init(): void
    {
        if (self::$initialized && self::$purifier !== null) {
            return;
        }

        // Load Composer autoload if not already loaded
        if (!class_exists('HTMLPurifier')) {
            $autoload = dirname(__DIR__) . '/vendor/autoload.php';
            if (is_file($autoload)) require_once $autoload;
        }

        if (!class_exists('HTMLPurifier')) {
            error_log('[CMS Security Error] HTMLPurifier library is missing or cannot be loaded.');
            throw new RuntimeException('HTML Sanitizer service unavailable.');
        }

        try {
            $config = HTMLPurifier_Config::createDefault();
            $config->set('Core.Encoding', 'UTF-8');
            $config->set('HTML.Doctype', 'HTML 4.01 Transitional');

            // Strictly allowed HTML elements
            $config->set('HTML.AllowedElements', [
                'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'span', 'div', 'img', 'small', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
            ]);

            // Strictly allowed attributes
            $config->set('HTML.AllowedAttributes', [
                'a.href', 'a.target', 'a.title', 'a.rel', 'a.class',
                'p.class', 'span.class', 'ul.class', 'ol.class', 'li.class',
                'h1.class', 'h2.class', 'h3.class', 'h4.class', 'h5.class', 'h6.class',
                'blockquote.class', 'div.class', 'div.id', 'span.id', 'i.class', 'b.class', 'img.src', 'img.alt', 'img.title', 'img.class', 'img.width', 'img.height', 'table.class', 'thead.class', 'tbody.class', 'tr.class', 'th.class', 'td.class'
            ]);

            // Automatic rel="noopener noreferrer" on target="_blank"
            $config->set('HTML.TargetNoopener', true);
            $config->set('HTML.TargetNoreferrer', true);
            $config->set('Attr.AllowedFrameTargets', ['_blank']);

            // Strictly allowed URI schemes
            $config->set('URI.AllowedSchemes', [
                'http' => true,
                'https' => true,
                'mailto' => true,
                'tel' => true
            ]);

            // Strictly disallow all custom inline CSS properties
            $config->set('CSS.AllowedProperties', []);

            // Avoid shared writable caches across installations.
            $config->set('Cache.DefinitionImpl', null);

            self::$purifier = new HTMLPurifier($config);
            self::$initialized = true;
        } catch (Throwable $e) {
            error_log('[CMS Security Error] Failed to initialize HTMLPurifier: ' . $e->getMessage());
            throw new RuntimeException('HTML Sanitizer service unavailable.');
        }
    }

    /**
     * Sanitize an HTML string according to strict allowlist.
     * Guaranteed FAIL-CLOSED: throws RuntimeException on failure.
     */
    public static function clean(string $html): string
    {
        $trimmed = trim($html);
        if ($trimmed === '') {
            return '';
        }

        // Step 1: Pre-process with DOMDocument to completely discard dangerous elements and their children
        $prevLibXmlErrors = libxml_use_internal_errors(true);
        $doc = new DOMDocument();
        $wrapped = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' . $trimmed . '</body></html>';
        $loaded = $doc->loadHTML($wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prevLibXmlErrors);

        if ($loaded && $doc->getElementsByTagName('body')->item(0)) {
            $body = $doc->getElementsByTagName('body')->item(0);
            $dangerousTags = [
                'script', 'style', 'iframe', 'frame', 'frameset', 'object',
                'embed', 'applet', 'svg', 'canvas', 'form', 'input', 'button',
                'select', 'textarea', 'keygen', 'meta', 'link', 'base',
                'math', 'mtext', 'annotation', 'xml'
            ];

            foreach ($dangerousTags as $tag) {
                $elements = $body->getElementsByTagName($tag);
                while ($elements->length > 0) {
                    $el = $elements->item(0);
                    $el->parentNode->removeChild($el);
                }
            }

            // Disarm protocol-relative URLs and obfuscated pseudo-protocols on any element
            $xpath = new DOMXPath($doc);
            $nodesWithUrl = $xpath->query('//*[@href or @src]');
            if ($nodesWithUrl) {
                foreach ($nodesWithUrl as $node) {
                    if ($node instanceof DOMElement) {
                        foreach (['href', 'src'] as $attr) {
                            if ($node->hasAttribute($attr)) {
                                $val = trim($node->getAttribute($attr));
                                $val = str_replace(chr(92), '/', preg_replace('/[\x00-\x20]/', '', $val));
                                if (str_starts_with($val, '//') || str_starts_with($val, '\\\\')) {
                                    $node->removeAttribute($attr);
                                    continue;
                                }

                                // Check for obfuscated pseudo-protocols
                                $rawVal = urldecode($val);
                                $normalized = preg_replace('/[\x00-\x20\s]+/u', '', strtolower($rawVal));
                                if (str_starts_with($normalized, 'javascript:') || str_starts_with($normalized, 'vbscript:') || str_starts_with($normalized, 'data:')) {
                                    $node->removeAttribute($attr);
                                }
                            }
                        }
                    }
                }
            }

            $precleaned = '';
            foreach ($body->childNodes as $child) {
                $precleaned .= $doc->saveHTML($child);
            }
            $trimmed = $precleaned;
        }

        // Step 2: Purify with HTMLPurifier
        self::init();

        try {
            $cleaned = self::$purifier->purify($trimmed);
        } catch (Throwable $e) {
            error_log('[CMS Security Error] HTML purification failed: ' . $e->getMessage());
            throw new RuntimeException('HTML Sanitizer service unavailable.');
        }

        // Step 3: Defense-in-depth safety checks
        // Ensure no protocol-relative URLs or javascript: remained
        $cleaned = preg_replace('/href\s*=\s*["\']\/\/[^"\']*["\']/i', '', $cleaned);
        $cleaned = preg_replace('/src\s*=\s*["\']\/\/[^"\']*["\']/i', '', $cleaned);

        return $cleaned;
    }

    /**
     * For testing fail-closed behavior: allows resetting or mocking sanitizer state.
     */
    public static function resetForTesting(): void
    {
        self::$purifier = null;
        self::$initialized = false;
    }
}
