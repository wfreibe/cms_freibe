<?php
/**
 * Consolidated Production REST API for Sandra Freiberger CMS
 *
 * Powered by native PHP & PDO SQLite.
 * Compatible with standard Apache/PHP hosting (e.g. DomainFactory).
 */

declare(strict_types=1);

// Error handling settings
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function cmsSendJsonError(int $statusCode, string $publicMessage, ?Throwable $exception = null): void
{
    if (!headers_sent()) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
    }
    echo json_encode(['error' => $publicMessage]);
    exit;
}

set_exception_handler(function (Throwable $e) {
    error_log('[CMS Exception] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    cmsSendJsonError(500, 'Internal server error.', $e);
});

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    error_log("[CMS PHP Error] $message in $file:$line");
    if ($severity === E_USER_ERROR || $severity === E_RECOVERABLE_ERROR) {
        cmsSendJsonError(500, 'Internal server error.');
    }
    return true;
});

if (array_key_exists('__cms_route', $_GET)) {
    $route = $_GET['__cms_route'];
    unset($_GET['__cms_route']);
    // This is a routing hint, never an authorization or trust boundary.
    if (!is_string($route) || strlen($route) > 512
        || !preg_match('#\A/*[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/*\z#D', $route)) {
        cmsSendJsonError(400, 'Ungültige API-Route.');
    }
    $apiPath = $route;
} else {
    $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
    $pathOnly = parse_url($requestUri, PHP_URL_PATH);
    $apiPath = preg_replace('#^.*?/api#', '', (string)$pathOnly);
}
$apiPath = '/' . trim((string)$apiPath, '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
// Retired message routes always return 404, regardless of configuration or request body.
if ($method === 'POST' && in_array($apiPath, ['/contact', '/messages'], true)) {
    cmsSendJsonError(404, 'API-Endpunkt nicht gefunden.');
}

// Resolve lib directory strictly without document root walking
$libDir = getenv('CMS_LIB_PATH');
if (!$libDir) {
    $candidates = [
        dirname(__DIR__, 2) . '/server/lib', // Production deploy layout: webroot + server sibling
        basename(dirname(__DIR__)) === 'public' && basename(dirname(__DIR__, 2)) === 'frontend' ? dirname(__DIR__, 3) . '/lib' : '', // Own source layout only
    ];
    foreach ($candidates as $cand) {
        if (file_exists($cand . '/Database.php')) {
            $libDir = realpath($cand);
            break;
        }
    }
}

if ($method === 'GET' && $apiPath === '/ready') {
    $status = 503;
    if ($libDir && is_file($libDir . '/Readiness.php')) {
        require_once $libDir . '/Readiness.php';
        $status = Readiness::status();
    }
    http_response_code($status);
    echo json_encode(['ready' => $status === 200]);
    exit;
}

if (!$libDir || !is_file($libDir . '/Database.php')) {
    error_log('[CMS Error] Library directory could not be located.');
    cmsSendJsonError(500, 'Internal server error.');
}

require_once $libDir . '/Database.php';
require_once $libDir . '/Auth.php';
require_once $libDir . '/Validator.php';
require_once $libDir . '/HtmlSanitizer.php';

// Configure CORS for development origins if configured
$config = Database::getConfig();
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = $config['cors_allowed_origins'] ?? [];

if ($origin && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, Authorization');
    header('Vary: Origin');
}

// Handle preflight OPTIONS request
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Image transport is separate from JSON requests; the existing auth/CSRF checks apply.
require_once $libDir . '/MediaUpload.php';
if ($method === 'GET' && preg_match('#^/media/([a-f0-9]{32})$#D', $apiPath, $mediaMatch)) {
    MediaUpload::serve($mediaMatch[1]);
}
if ($method === 'POST' && $apiPath === '/media') {
    Auth::requireAdmin();
    Auth::requireCsrf();
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data;') !== 0) cmsSendJsonError(415, 'Ein Bild als Datei hochladen.');
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > MediaUpload::MAX_BYTES + 1024 * 1024) cmsSendJsonError(413, 'Bilder dürfen höchstens 8 MB groß sein.');
    $upload = $_FILES['image'] ?? null;
    if (!is_array($upload) || !isset($upload['error']) || !is_int($upload['error']) || $upload['error'] !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null) || !is_uploaded_file($upload['tmp_name'])) cmsSendJsonError(400, 'Bild-Upload fehlgeschlagen. Bitte Dateigröße prüfen (maximal 8 MB).');
    try {
        $url = MediaUpload::store($upload['tmp_name']);
        http_response_code(201); echo json_encode(['url' => $url]);
    } catch (InvalidArgumentException $e) { cmsSendJsonError(400, $e->getMessage()); }
    exit;
}

// Validate request media and payload size (413 / 415)
Validator::validateRequestMedia();

// Parse JSON body for mutating requests
$body = [];
if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    $rawInput = file_get_contents('php://input', false, null, 0, Validator::MAX_PAYLOAD_BYTES + 1);
    if (strlen((string)$rawInput) > Validator::MAX_PAYLOAD_BYTES) cmsSendJsonError(413, 'Request too large.');
    if ($rawInput !== false && trim($rawInput) !== '') {
        $decoded = json_decode($rawInput, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            echo json_encode(['error' => 'Ungültiges JSON-Format.']);
            exit;
        }
        $body = is_array($decoded) ? $decoded : [];
    }
}

// Helper to format a section with its accordions
function formatSectionWithAccordions(array $section, PDO $db, string $lang, bool $includeInactive = false): array
{
    $secId = $section['id'];
    $sql = "SELECT id, section_id, lang, sort_order, title, content, is_published, is_active, updated_at
            FROM section_accordions
            WHERE section_id = ? AND lang = ?";
    if (!$includeInactive) {
        $sql .= " AND (is_published = 1 OR (is_published IS NULL AND is_active = 1))";
    }
    $sql .= " ORDER BY sort_order ASC";

    $stmt = $db->prepare($sql);
    $stmt->execute([$secId, $lang]);
    $accordions = $stmt->fetchAll();

    foreach ($accordions as &$acc) {
        $pub = isset($acc['is_published']) ? (int)$acc['is_published'] : (int)($acc['is_active'] ?? 1);
        $acc['is_published'] = $pub;
        $acc['is_active'] = $pub;
        $acc['sort_order'] = (int)($acc['sort_order'] ?? 1);
    }
    unset($acc);
    $section['accordions'] = $accordions;

    if (!empty($section['contact_info'])) {
        $decoded = json_decode($section['contact_info'], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $section['contact_info'] = $decoded;
        }
    }

    $isPublished = isset($section['is_published']) ? (int)$section['is_published'] : (int)($section['is_active'] ?? 1);
    $showInNav = isset($section['show_in_navigation'])
        ? (int)$section['show_in_navigation']
        : (!in_array($secId, ['impressum', 'datenschutz'], true) ? $isPublished : 0);

    $section['is_published'] = $isPublished;
    $section['show_in_navigation'] = $showInNav;
    $section['is_active'] = $isPublished; // Retain alias for backwards compatibility
    $section['sort_order'] = (int)($section['sort_order'] ?? 1);

    return $section;
}

try {
    $db = Database::getConnection();

    // ==========================================
    // 1. Authentication Endpoints
    // ==========================================

    // GET /api/auth/session
    if ($method === 'GET' && ($apiPath === '/auth/session' || $apiPath === '/session')) {
        $isAuth = Auth::isAuthenticated();
        echo json_encode([
            'authenticated' => $isAuth,
            'passwordChangeRequired' => $isAuth && Auth::passwordChangeRequired(),
            'csrf_token' => Auth::getCsrfToken(),
            'user' => $isAuth ? ($_SESSION['auth_user'] ?? 'admin') : null
        ]);
        exit;
    }

    // POST /api/auth/login
    if ($method === 'POST' && ($apiPath === '/auth/login' || $apiPath === '/login')) {
        if (!isset($body['username']) || !is_scalar($body['username']) || !isset($body['password']) || !is_scalar($body['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Benutzername und Passwort müssen Zeichenketten sein.']);
            exit;
        }

        $username = trim((string)$body['username']);
        $password = (string)$body['password'];

        if ($username === '' || $password === '' || strlen($username) > 100 || strlen($password) > 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'Benutzername und Passwort sind erforderlich.']);
            exit;
        }

        $result = Auth::login($username, $password);
        echo json_encode($result);
        exit;
    }

    // POST /api/auth/logout
    if ($method === 'POST' && ($apiPath === '/auth/logout' || $apiPath === '/logout')) {
        Auth::requireCsrf();
        Auth::logout();
        echo json_encode(['success' => true, 'message' => 'Erfolgreich abgemeldet.']);
        exit;
    }

    // POST /api/auth/change-password: the only protected action allowed to a restricted session.
    if ($method === 'POST' && $apiPath === '/auth/change-password') {
        Auth::requireCsrf();
        $new = $body['newPassword'] ?? null;
        $confirm = $body['confirmPassword'] ?? null;
        if (!is_string($new) || !is_string($confirm)) {
            http_response_code(400);
            echo json_encode(['error' => 'Neues Passwort und Bestätigung erforderlich.']);
            exit;
        }
        echo json_encode(Auth::changePassword($new, $confirm));
        exit;
    }

    // ==========================================
    // 2. Legal Section Endpoints (Strictly Impressum & Datenschutz)
    // GET /api/legal/{type}?lang=de|en
    // ==========================================
    if ($method === 'GET' && preg_match('#^/legal/([a-zA-Z0-9_-]+)$#', $apiPath, $matches)) {
        $legalType = strtolower($matches[1]);
        if (!in_array($legalType, ['impressum', 'datenschutz'], true)) {
            http_response_code(404);
            echo json_encode(['error' => 'Rechtlicher Abschnitt nicht gefunden.']);
            exit;
        }

        $lang = Validator::validateLanguage($_GET['lang'] ?? 'de');

        $stmt = $db->prepare("
            SELECT id, lang, sort_order, nav_label, title, subtitle, content, image_url, image_layout, bg_color, bg_image_url, contact_info, is_published, show_in_navigation, is_active, updated_at
            FROM sections
            WHERE id = ? AND lang = ?
        ");
        $stmt->execute([$legalType, $lang]);
        $section = $stmt->fetch();

        if (!$section) {
            http_response_code(404);
            echo json_encode(['error' => 'Rechtlicher Abschnitt nicht gefunden.']);
            exit;
        }

        // Unpublished legal sections return 404 to unauthenticated guests
        $isPublished = isset($section['is_published']) ? ((int)$section['is_published'] === 1) : ((int)($section['is_active'] ?? 0) === 1);
        $isAdmin = false;
        if (($_GET['preview'] ?? '') === '1') { Auth::requireAdmin(); $isAdmin = true; }
        if (!$isPublished && !$isAdmin) {
            http_response_code(404);
            echo json_encode(['error' => 'Rechtlicher Abschnitt befindet sich in Prüfung.']);
            exit;
        }

        echo json_encode(formatSectionWithAccordions($section, $db, $lang, $isAdmin));
        exit;
    }

    // ==========================================
    // 3. Sections Endpoints
    // ==========================================

    // GET /api/sections
    if ($method === 'GET' && $apiPath === '/sections') {
        $lang = Validator::validateLanguage($_GET['lang'] ?? 'de');
        $requestAll = isset($_GET['all']) && $_GET['all'] === 'true';

        if ($requestAll) {
            Auth::requireAdmin();

            $stmt = $db->prepare("
                SELECT id, lang, sort_order, nav_label, title, subtitle, content, image_url, image_layout, bg_color, bg_image_url, contact_info, is_published, show_in_navigation, is_active, updated_at
                FROM sections
                WHERE lang = ?
                ORDER BY sort_order ASC
            ");
            $stmt->execute([$lang]);
            $sections = $stmt->fetchAll();

            $result = array_map(function ($s) use ($db, $lang) {
                return formatSectionWithAccordions($s, $db, $lang, true);
            }, $sections);

            echo json_encode($result);
            exit;
        }

        // Public list: only published sections with show_in_navigation=1, excluding standalone legal sections
        $stmt = $db->prepare("
            SELECT id, lang, sort_order, nav_label, title, subtitle, content, image_url, image_layout, bg_color, bg_image_url, contact_info, is_published, show_in_navigation, is_active, updated_at
            FROM sections
            WHERE lang = ?
              AND (is_published = 1 OR (is_published IS NULL AND is_active = 1))
              AND (show_in_navigation = 1 OR (show_in_navigation IS NULL AND is_active = 1))
              AND id NOT IN ('impressum', 'datenschutz')
            ORDER BY sort_order ASC
        ");
        $stmt->execute([$lang]);
        $sections = $stmt->fetchAll();

        $result = array_map(function ($s) use ($db, $lang) {
            return formatSectionWithAccordions($s, $db, $lang, false);
        }, $sections);

        echo json_encode($result);
        exit;
    }

    // GET /api/sections/{id}
    if ($method === 'GET' && preg_match('#^/sections/([a-zA-Z0-9_-]+)$#', $apiPath, $matches)) {
        $id = strtolower($matches[1]);
        $lang = Validator::validateLanguage($_GET['lang'] ?? 'de');
        $isAdmin = false;
        if (($_GET['preview'] ?? '') === '1') { Auth::requireAdmin(); $isAdmin = true; }

        $stmt = $db->prepare("
            SELECT id, lang, sort_order, nav_label, title, subtitle, content, image_url, image_layout, bg_color, bg_image_url, contact_info, is_published, show_in_navigation, is_active, updated_at
            FROM sections
            WHERE id = ? AND lang = ?
        ");
        $stmt->execute([$id, $lang]);
        $sec = $stmt->fetch();

        if (!$sec) {
            http_response_code(404);
            echo json_encode(['error' => 'Sektion nicht gefunden.']);
            exit;
        }

        // Unpublished sections are strictly hidden from public callers
        $isPublished = isset($sec['is_published']) ? ((int)$sec['is_published'] === 1) : ((int)($sec['is_active'] ?? 1) === 1);
        if (!$isPublished && !$isAdmin) {
            http_response_code(404);
            echo json_encode(['error' => 'Sektion nicht gefunden.']);
            exit;
        }

        echo json_encode(formatSectionWithAccordions($sec, $db, $lang, $isAdmin));
        exit;
    }

    // POST /api/sections (Create new section, Admin only)
    if ($method === 'POST' && $apiPath === '/sections') {
        Auth::requireAdmin();
        Auth::requireCsrf();

        $validationErrors = Validator::validateSectionPayload($body, true);
        if (!empty($validationErrors)) {
            http_response_code(400);
            echo json_encode(['error' => $validationErrors[0], 'errors' => $validationErrors]);
            exit;
        }

        $createdLang = $body['lang'] ?? 'de';
        if (Validator::checkStrictLanguage($createdLang) !== null) cmsSendJsonError(400, 'Invalid language.');
        $cleanId = Validator::cleanSectionId((string)($body['id'] ?? ''));
        $nav_label = trim((string)($body['nav_label'] ?? ''));
        $title = trim((string)($body['title'] ?? ''));
        $subtitle = trim((string)($body['subtitle'] ?? ''));
        $content = (string)($body['content'] ?? '<p>Neuer Inhalt...</p>');
        $image_url = !empty($body['image_url']) ? trim((string)$body['image_url']) : null;
        $image_layout = (string)($body['image_layout'] ?? 'original');
        $bg_color = !empty($body['bg_color']) ? trim((string)$body['bg_color']) : null;
        $bg_image_url = !empty($body['bg_image_url']) ? trim((string)$body['bg_image_url']) : null;
        $is_published = isset($body['is_published']) ? ($body['is_published'] ? 1 : 0) : 0;
        $show_in_navigation = isset($body['show_in_navigation']) ? ($body['show_in_navigation'] ? 1 : 0) : 1;

        $cleanContent = HtmlSanitizer::clean($content);

        $db->beginTransaction();
        try {
            $checkStmt = $db->prepare("SELECT COUNT(*) FROM sections WHERE id = ?");
            $checkStmt->execute([$cleanId]);
            if ((int)$checkStmt->fetchColumn() > 0) {
                $db->rollBack();
                http_response_code(409);
                echo json_encode(['error' => "Eine Sektion mit der ID '{$cleanId}' existiert bereits."]);
                exit;
            }

            $sortStmt = $db->query("SELECT COALESCE(MAX(sort_order), 0) FROM sections WHERE lang = 'de'");
            $nextSort = (int)$sortStmt->fetchColumn() + 1;

            $ins = $db->prepare("
                INSERT INTO sections (id, lang, sort_order, nav_label, title, subtitle, content, image_url, image_layout, bg_color, bg_image_url, is_published, show_in_navigation, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ");

            foreach (Validator::ALLOWED_LANGUAGES as $targetLang) {
                $published = $createdLang === $targetLang ? $is_published : 0;
                $ins->execute([$cleanId, $targetLang, $nextSort, $nav_label, $title, $subtitle, $cleanContent, $image_url, $image_layout, $bg_color, $bg_image_url, $published, $show_in_navigation, $published]);
            }

            $db->commit();

            $sel = $db->prepare("SELECT * FROM sections WHERE id = ? AND lang = ?");
            $sel->execute([$cleanId, $createdLang]);
            $created = formatSectionWithAccordions($sel->fetch(), $db, $createdLang, true);

            http_response_code(201);
            echo json_encode(['success' => true, 'section' => $created]);
            exit;

        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('[CMS Error] Failed to create section: ' . $e->getMessage());
            cmsSendJsonError(500, 'Internal server error.', $e);
        }
    }

    // PUT /api/sections/{id} (Update section & accordions, Admin only)
    if (in_array($method, ['PUT', 'PATCH'], true) && preg_match('#^/sections/([a-zA-Z0-9_-]+)$#', $apiPath, $matches)) {
        Auth::requireAdmin();
        Auth::requireCsrf();

        $id = strtolower($matches[1]);
        $langCheck = Validator::checkStrictLanguage($body['lang'] ?? 'de');
        if ($langCheck !== null) {
            http_response_code(400);
            echo json_encode(['error' => $langCheck]);
            exit;
        }

        $lang = $body['lang'] ?? 'de';

        $validationErrors = Validator::validateSectionPayload($body, false);
        if (!empty($validationErrors)) {
            http_response_code(400);
            echo json_encode(['error' => $validationErrors[0], 'errors' => $validationErrors]);
            exit;
        }

        $existingStmt = $db->prepare('SELECT * FROM sections WHERE id = ? AND lang = ?');
        $existingStmt->execute([$id, $lang]);
        $existing = $existingStmt->fetch();
        if (!$existing) cmsSendJsonError(404, 'Sektion nicht gefunden.');
        $body = array_replace($existing, $body);
        $title = trim((string)($body['title'] ?? ''));
        $content = (string)($body['content'] ?? '');
        $nav_label = isset($body['nav_label']) ? trim((string)$body['nav_label']) : null;
        $subtitle = isset($body['subtitle']) ? trim((string)$body['subtitle']) : '';
        $image_url = array_key_exists('image_url', $body) ? (!empty($body['image_url']) ? trim((string)$body['image_url']) : null) : null;
        $image_layout = (string)($body['image_layout'] ?? 'original');
        $bg_color = array_key_exists('bg_color', $body) ? (!empty($body['bg_color']) ? trim((string)$body['bg_color']) : null) : null;
        $bg_image_url = array_key_exists('bg_image_url', $body) ? (!empty($body['bg_image_url']) ? trim((string)$body['bg_image_url']) : null) : null;
        $is_published = isset($body['is_published']) ? ($body['is_published'] ? 1 : 0) : (isset($body['is_active']) ? ($body['is_active'] ? 1 : 0) : 1);
        $show_in_navigation = isset($body['show_in_navigation']) ? ($body['show_in_navigation'] ? 1 : 0) : (in_array($id, ['impressum', 'datenschutz'], true) ? 0 : 1);
        $is_active = $is_published;
        $sort_order = isset($body['sort_order']) ? max(0, (int)$body['sort_order']) : null;

        $cleanContent = HtmlSanitizer::clean($content);

        $contact_info = null;
        if (isset($body['contact_info'])) {
            $contact_info = is_array($body['contact_info'])
                ? json_encode($body['contact_info'], JSON_UNESCAPED_UNICODE)
                : (string)$body['contact_info'];
        }

        $db->beginTransaction();
        try {
            $update = $db->prepare("
                UPDATE sections
                SET nav_label = COALESCE(?, nav_label),
                    title = ?,
                    subtitle = ?,
                    content = ?,
                    image_url = ?,
                    image_layout = ?,
                    bg_color = ?,
                    bg_image_url = ?,
                    contact_info = COALESCE(?, contact_info),
                    is_published = ?,
                    show_in_navigation = ?,
                    is_active = ?,
                    sort_order = COALESCE(?, sort_order),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND lang = ?
            ");
            $update->execute([$nav_label, $title, $subtitle, $cleanContent, $image_url, $image_layout, $bg_color, $bg_image_url, $contact_info, $is_published, $show_in_navigation, $is_active, $sort_order, $id, $lang]);

            if (array_key_exists('bg_color', $body) || array_key_exists('bg_image_url', $body)) {
                $syncStmt = $db->prepare("UPDATE sections SET bg_color = ?, bg_image_url = ? WHERE id = ?");
                $syncStmt->execute([$bg_color, $bg_image_url, $id]);
            }

            // Save Accordions atomically if provided
            if (isset($body['accordions']) && is_array($body['accordions'])) {
                $oldAccStmt = $db->prepare('SELECT * FROM section_accordions WHERE section_id=? AND lang=?');
                $oldAccStmt->execute([$id, $lang]);
                $oldAccordions = array_column($oldAccStmt->fetchAll(), null, 'id');
                $delAcc = $db->prepare("DELETE FROM section_accordions WHERE section_id = ? AND lang = ?");
                $delAcc->execute([$id, $lang]);

                $insAcc = $db->prepare("
                    INSERT INTO section_accordions (id, section_id, lang, sort_order, title, content, is_published, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
                ");

                foreach ($body['accordions'] as $idx => $acc) {
                    if (!is_array($acc)) continue;
                    $accTitle = trim((string)($acc['title'] ?? ''));
                    if ($accTitle === '') continue;

                    $accId = !empty($acc['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$acc['id']) : "acc_{$id}_" . time() . "_{$idx}";
                    $accSort = isset($acc['sort_order']) ? (int)$acc['sort_order'] : $idx + 1;
                    $accCleanContent = HtmlSanitizer::clean((string)($acc['content'] ?? ''));
                    $accPub = isset($acc['is_published']) ? ($acc['is_published'] ? 1 : 0) : (isset($acc['is_active']) ? ($acc['is_active'] ? 1 : 0) : (int)($oldAccordions[$accId]['is_published'] ?? 0));

                    $insAcc->execute([$accId, $id, $lang, $accSort, $accTitle, $accCleanContent, $accPub, $accPub, $oldAccordions[$accId]['created_at'] ?? null]);
                }
            }

            $sel = $db->prepare("SELECT * FROM sections WHERE id = ? AND lang = ?");
            $sel->execute([$id, $lang]);
            $row = $sel->fetch();
            if (!$row) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                http_response_code(404);
                echo json_encode(['error' => 'Sektion nicht gefunden.']);
                exit;
            }

            $db->commit();
            $updated = formatSectionWithAccordions($row, $db, $lang, true);

            echo json_encode(['success' => true, 'section' => $updated]);
            exit;

        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('[CMS Error] Failed to update section: ' . $e->getMessage());
            cmsSendJsonError(500, 'Internal server error.', $e);
        }
    }

    // PATCH /api/sections/{id}/toggle (Toggle active/published, Admin only)
    if ($method === 'PATCH' && preg_match('#^/sections/([a-zA-Z0-9_-]+)/toggle$#', $apiPath, $matches)) {
        Auth::requireAdmin();
        Auth::requireCsrf();

        $id = strtolower($matches[1]);

        try {
            $errors = Validator::validateSectionPayload($body);
            if ($errors) cmsSendJsonError(400, $errors[0]);
            $updates = [];
            $params = [];
            $response = ['success' => true, 'id' => $id];

            if (isset($body['show_in_navigation'])) {
                $showNav = !empty($body['show_in_navigation']) ? 1 : 0;
                $updates[] = 'show_in_navigation = ?';
                $params[] = $showNav;
                $response['show_in_navigation'] = (bool)$showNav;
            }

            if (isset($body['is_published']) || isset($body['is_active'])) {
                $is_published = !empty($body['is_published']) ? 1 : (!empty($body['is_active']) ? 1 : 0);
                $updates[] = 'is_published = ?';
                $updates[] = 'is_active = ?';
                $params[] = $is_published;
                $params[] = $is_published;
                $response['is_published'] = (bool)$is_published;
                $response['is_active'] = (bool)$is_published;
            }

            if (empty($updates)) {
                http_response_code(400);
                echo json_encode(['error' => 'Kein Statusfeld zum Umschalten übergeben.']);
                exit;
            }

            $updates[] = 'updated_at = CURRENT_TIMESTAMP';
            $params[] = $id;
            if (Validator::checkStrictLanguage($body['lang'] ?? 'de') !== null) cmsSendJsonError(400, 'Invalid language.');
            $params[] = $body['lang'] ?? 'de';

            $sql = "UPDATE sections SET " . implode(', ', $updates) . " WHERE id = ? AND lang = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            echo json_encode($response);
            exit;
        } catch (Throwable $e) {
            error_log('[CMS Error] Failed to toggle section: ' . $e->getMessage());
            cmsSendJsonError(500, 'Internal server error.', $e);
        }
    }

    // DELETE /api/sections/{id} (Admin only)
    if ($method === 'DELETE' && preg_match('#^/sections/([a-zA-Z0-9_-]+)$#', $apiPath, $matches)) {
        Auth::requireAdmin();
        Auth::requireCsrf();

        $id = strtolower($matches[1]);

        if ($id === 'home' || $id === 'kontakt') {
            http_response_code(400);
            echo json_encode(['error' => 'Die Standard-Sektionen Home und Kontakt können nicht gelöscht werden.']);
            exit;
        }

        $db->beginTransaction();
        try {
            // Delete accordions and section (cascade will also handle it)
            $delAcc = $db->prepare("DELETE FROM section_accordions WHERE section_id = ?");
            $delAcc->execute([$id]);

            $delSec = $db->prepare("DELETE FROM sections WHERE id = ?");
            $delSec->execute([$id]);
            $affected = $delSec->rowCount();

            $db->commit();

            echo json_encode(['success' => true, 'changes' => $affected]);
            exit;
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('[CMS Error] Failed to delete section: ' . $e->getMessage());
            cmsSendJsonError(500, 'Internal server error.', $e);
        }
    }

    // Fallback 404 for unknown API endpoints
    http_response_code(404);
    echo json_encode(['error' => 'API-Endpunkt nicht gefunden.']);
    exit;

} catch (Throwable $e) {
    error_log('[CMS Fatal Error] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    cmsSendJsonError(500, 'Internal server error.', $e);
}
