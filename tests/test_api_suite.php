<?php
/**
 * Fully Isolated End-to-End API, Security & Hardening Integration Test Suite
 * 
 * Strict isolation:
 * - NEVER touches or opens data/content.sqlite
 * - Runs against isolated ephemeral database with runtime-generated credentials
 * - Verifies zero path leakage, strict rate limiting, 413/415 media checks,
 *   CSRF enforcement, session invalidation, and XSS neutralization.
 */

declare(strict_types=1);

// The Node runner owns the isolated database and loopback PHP process.
// Do not inherit local application configuration in a standalone invocation.
$testPort = filter_var(getenv('CMS_TEST_PORT'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
$testUser = getenv('CMS_ADMIN_USER');
$testPassword = getenv('CMS_ADMIN_PASSWORD');
if (!$testPort || !$testUser || !$testPassword || !getenv('CMS_DB_PATH') || !getenv('CMS_CONFIG_PATH')) {
    fwrite(STDERR, "Run npm test to provide an isolated API test environment.\n");
    exit(1);
}
$baseUrl = "http://127.0.0.1:{$testPort}";
$cookieFile = tempnam(sys_get_temp_dir(), 'cms_cookie_');
if ($cookieFile === false) throw new RuntimeException('Cannot create test cookie file.');
register_shutdown_function(static function () use ($cookieFile) {
    if (is_file($cookieFile)) unlink($cookieFile);
});

// Wait up to 5 seconds for server to be responsive
$ready = false;
for ($i = 0; $i < 50; $i++) {
    usleep(100000); // 100ms
    $ch = curl_init("{$baseUrl}/api/auth/session");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 1);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && is_string($res)) {
        $parsed = json_decode($res, true);
        if (is_array($parsed) && isset($parsed['csrf_token'])) {
            $ready = true;
            break;
        }
    }
}

if (!$ready) {
    echo "❌ FATAL: Test server did not start properly.\n";
    exit(1);
}

echo "\n========================================================\n";
echo "  CMS_SFREIBE - End-to-End API & Security Test Suite    \n";
echo "========================================================\n";
echo "  Server:   {$baseUrl} (ISOLATED TEST INSTANCE)\n";
echo "  User:     {$testUser}\n\n";

$passCount = 0;
$failCount = 0;

function assertTest(string $name, bool $condition, string $detail = ''): void
{
    global $passCount, $failCount;
    if ($condition) {
        echo "  [PASS] {$name}\n";
        $passCount++;
    } else {
        echo "  [FAIL] {$name}" . ($detail ? " ({$detail})" : "") . "\n";
        $failCount++;
    }
}

function httpReq(string $method, string $url, $body = null, array $headers = [], string $cookieJar = null): array
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);

    if ($cookieJar) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
    }

    $reqHeaders = [];
    if ($body !== null) {
        if (is_array($body)) {
            $json = json_encode($body);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            $reqHeaders[] = 'Content-Type: application/json';
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, (string)$body);
        }
    }

    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    foreach ($headers as $k => $v) {
        $reqHeaders[] = "{$k}: {$v}";
    }

    if (!empty($reqHeaders)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);
    }

    $raw = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $headerStr = substr((string)$raw, 0, $headerSize);
    $bodyStr = substr((string)$raw, $headerSize);
    $data = json_decode($bodyStr, true);

    return [
        'code' => $httpCode,
        'headers' => $headerStr,
        'body' => $bodyStr,
        'json' => $data
    ];
}

// -------------------------------------------------------------
// Test Group 1: Public Endpoints & Privacy Filtering
// -------------------------------------------------------------
echo "1. Testing Public Endpoints & Privacy Filtering...\n";

// 1.1 GET /api/sections (Public)
$res = httpReq('GET', "{$baseUrl}/api/sections?lang=de");
assertTest('Public /api/sections returns HTTP 200', $res['code'] === 200);
assertTest('Public /api/sections returns an array', is_array($res['json']));

$sectionIds = array_column($res['json'] ?? [], 'id');
assertTest('Public list contains "home"', in_array('home', $sectionIds, true));
assertTest('Public list excludes "impressum"', !in_array('impressum', $sectionIds, true));
assertTest('Public list excludes "datenschutz"', !in_array('datenschutz', $sectionIds, true));

// Verify home section retains background image
$homeSec = null;
foreach ($res['json'] as $s) {
    if ($s['id'] === 'home') {
        $homeSec = $s;
        break;
    }
}
assertTest('Home section contains bg_image_url "/home_bg.jpg"', ($homeSec['bg_image_url'] ?? '') === '/home_bg.jpg');

// 1.2 GET /api/sections?all=true without authentication must be denied
$res = httpReq('GET', "{$baseUrl}/api/sections?all=true");
assertTest('Unauthenticated ?all=true returns HTTP 401 Unauthorized', $res['code'] === 401);

// -------------------------------------------------------------
// Test Group 2: Dedicated Legal Endpoints
// -------------------------------------------------------------
echo "\n2. Testing Dedicated Legal Endpoints...\n";

$res = httpReq('GET', "{$baseUrl}/api/legal/impressum?lang=de");
assertTest('Draft imprint returns HTTP 404', $res['code'] === 404);

$res = httpReq('GET', "{$baseUrl}/api/legal/datenschutz?lang=de");
assertTest('Draft privacy text returns HTTP 404', $res['code'] === 404);

$res = httpReq('GET', "{$baseUrl}/api/legal/invalid_legal_type");
assertTest('Invalid legal type returns HTTP 404', $res['code'] === 404);

// -------------------------------------------------------------
// Test Group 3: Authentication, Password Checks & Session Flow
// -------------------------------------------------------------
echo "\n3. Testing Authentication & Session Management...\n";

// 3.1 Initial session state
$res = httpReq('GET', "{$baseUrl}/api/auth/session", null, [], $cookieFile);
assertTest('Initial session check returns HTTP 200', $res['code'] === 200);
assertTest('Initial session authenticated is false', ($res['json']['authenticated'] ?? null) === false);
$csrfToken = $res['json']['csrf_token'] ?? '';
assertTest('Initial session returns valid CSRF token', !empty($csrfToken) && strlen($csrfToken) >= 32);

// 3.2 Login with wrong password
$res = httpReq('POST', "{$baseUrl}/api/auth/login", [
    'username' => $testUser,
    'password' => 'definitely_wrong_password_123'
], [], $cookieFile);
assertTest('Login with incorrect password returns HTTP 401', $res['code'] === 401);
assertTest('Login failure message provided without leaking credential details', ($res['json']['success'] ?? true) === false);

// 3.3 Login with invalid synthetic password must be REJECTED
$res = httpReq('POST', "{$baseUrl}/api/auth/login", [
    'username' => $testUser,
    'password' => 'synthetic_wrong_pass_' . bin2hex(random_bytes(4))
], [], $cookieFile);
assertTest('Synthetic wrong password is rejected with HTTP 401', $res['code'] === 401);

// 3.4 Login with configured runtime test password
$res = httpReq('POST', "{$baseUrl}/api/auth/login", [
    'username' => $testUser,
    'password' => $testPassword
], [], $cookieFile);
assertTest('Login with configured credentials returns HTTP 200', $res['code'] === 200);
assertTest('Login success flag is true', ($res['json']['success'] ?? false) === true);
$csrfToken = $res['json']['csrf_token'] ?? $csrfToken;

// 3.5 Verify authenticated session state
$res = httpReq('GET', "{$baseUrl}/api/auth/session", null, [], $cookieFile);
assertTest('Session check after login returns authenticated = true', ($res['json']['authenticated'] ?? null) === true);
assertTest('Session user matches test username', ($res['json']['user'] ?? null) === $testUser);

// 3.6 Authorized GET /api/sections?all=true
$res = httpReq('GET', "{$baseUrl}/api/sections?all=true", null, [], $cookieFile);
assertTest('Authenticated ?all=true returns HTTP 200', $res['code'] === 200);
assertTest('Authenticated ?all=true returns all sections', count($res['json'] ?? []) >= 4);

// French content uses the same authenticated editing and publication rules.
$res = httpReq('POST', "{$baseUrl}/api/sections", [
    'id' => 'synthetic-french', 'lang' => 'fr', 'nav_label' => 'Exemple',
    'title' => 'Exemple français', 'content' => '<p>Texte de test.</p>', 'is_published' => 1
], ['X-CSRF-Token' => $csrfToken], $cookieFile);
assertTest('Create French section returns 201', $res['code'] === 201);
assertTest('Created section has French language', ($res['json']['section']['lang'] ?? null) === 'fr');
$res = httpReq('PUT', "{$baseUrl}/api/sections/synthetic-french", [
    'lang' => 'fr', 'title' => 'Texte modifié', 'content' => '<p>Contenu modifié.</p>',
    'accordions' => [['id' => 'synthetic-fr-topic', 'title' => 'Thème', 'content' => '<p>Détails.</p>', 'is_published' => 1]]
], ['X-CSRF-Token' => $csrfToken], $cookieFile);
assertTest('Edit French section and accordion returns 200', $res['code'] === 200);
$res = httpReq('GET', "{$baseUrl}/api/sections/synthetic-french?lang=fr");
assertTest('Published French content and accordion are readable', $res['code'] === 200 && ($res['json']['title'] ?? '') === 'Texte modifié' && count($res['json']['accordions'] ?? []) === 1);
foreach (['de','en'] as $language) {
    $res = httpReq('GET', "{$baseUrl}/api/sections/synthetic-french?lang={$language}");
    assertTest('Other language stays draft: ' . $language, $res['code'] === 404);
}

// -------------------------------------------------------------
// Test Group 4: CSRF Protection on Mutating Requests
// -------------------------------------------------------------
echo "\n4. Testing CSRF Protection...\n";

// 4.1 Update without CSRF token must return 403 Forbidden
$res = httpReq('PUT', "{$baseUrl}/api/sections/ueber-mich", [
    'lang' => 'de',
    'title' => 'Test Without CSRF',
    'content' => '<p>Content</p>'
], [], $cookieFile);
assertTest('PUT without CSRF token returns HTTP 403 Forbidden', $res['code'] === 403);

// 4.2 Update with invalid CSRF token must return 403
$res = httpReq('PUT', "{$baseUrl}/api/sections/ueber-mich", [
    'lang' => 'de',
    'title' => 'Test Invalid CSRF',
    'content' => '<p>Content</p>'
], ['X-CSRF-Token' => 'invalid_csrf_token_value'], $cookieFile);
assertTest('PUT with invalid CSRF token returns HTTP 403 Forbidden', $res['code'] === 403);

// -------------------------------------------------------------
// Test Group 5: Request Media & Payload Validation (413 / 415)
// -------------------------------------------------------------
echo "\n5. Testing Request Media & Payload Validation...\n";

// 5.1 Content-Type not application/json on mutating endpoint returns 415
$res = httpReq('POST', "{$baseUrl}/api/sections", "not_json_data", ['Content-Type' => 'text/plain'], $cookieFile);
assertTest('POST with text/plain returns HTTP 415 Unsupported Media Type', $res['code'] === 415);

// 5.2 Malformed JSON returns 400 Bad Request
$res = httpReq('POST', "{$baseUrl}/api/sections", "{malformed_json: missing_quotes}", ['Content-Type' => 'application/json'], $cookieFile);
assertTest('POST with malformed JSON returns HTTP 400 Bad Request', $res['code'] === 400);

// 5.3 Payload too large returns 413
$hugeData = json_encode(['data' => str_repeat('A', 1050000)]);
$res = httpReq('POST', "{$baseUrl}/api/sections", $hugeData, ['Content-Type' => 'application/json']);
assertTest('Payload exceeding 1 MB returns HTTP 413 Payload Too Large (got ' . $res['code'] . ')', $res['code'] === 413);

// 5.4 Unexpected Array/Object instead of String returns HTTP 400
$typePayload = json_encode(['username' => ['invalid_array'], 'password' => 'pass']);
$res = httpReq('POST', "{$baseUrl}/api/auth/login", $typePayload, ['Content-Type' => 'application/json']);
assertTest('Login with array instead of string returns HTTP 400 Bad Request', $res['code'] === 400);

$contactTypePayload = json_encode(['name' => ['not', 'a', 'string'], 'email' => 'test@example.com', 'message' => 'Hello']);
$res = httpReq('POST', "{$baseUrl}/api/contact", $contactTypePayload, ['Content-Type' => 'application/json']);
assertTest('Unavailable contact route returns HTTP 404', $res['code'] === 404);

$sectionTypePayload = json_encode(['title' => ['array_title'], 'lang' => 'de']);
$res = httpReq('PUT', "{$baseUrl}/api/sections/angebot", $sectionTypePayload, ['Content-Type' => 'application/json', 'X-CSRF-Token' => $csrfToken], $cookieFile);
assertTest('Section update with array instead of string returns HTTP 400 Bad Request', $res['code'] === 400);

// -------------------------------------------------------------
// Test Group 6: Error Responses & Zero Path Disclosure
// -------------------------------------------------------------
echo "\n6. Testing Zero Path Disclosure in Errors...\n";

$res = httpReq('GET', "{$baseUrl}/api/non_existent_route");
assertTest('Unknown route returns HTTP 404', $res['code'] === 404);
assertTest('Error message does not leak absolute server paths', !str_contains($res['body'], 'c:\\') && !str_contains($res['body'], 'C:/'));

// -------------------------------------------------------------
// Test Group 7: Publication vs Navigation Toggling Privacy
// -------------------------------------------------------------
echo "\n7. Testing Publication and Navigation Filtering...\n";

// 7.1 Toggle show_in_navigation to 0
$res = httpReq('PATCH', "{$baseUrl}/api/sections/anfahrt/toggle", ['show_in_navigation' => 0], ['X-CSRF-Token' => $csrfToken], $cookieFile);
assertTest('Toggle show_in_navigation to 0 succeeded', ($res['json']['success'] ?? false) === true);

// Section is still published, so direct GET succeeds
$pubRes = httpReq('GET', "{$baseUrl}/api/sections/anfahrt?lang=de");
assertTest('Section with show_in_navigation=0 is still directly viewable if published', $pubRes['code'] === 200);

// But public navigation list /api/sections excludes it
$listRes = httpReq('GET', "{$baseUrl}/api/sections?lang=de");
$visibleNavIds = array_column($listRes['json'] ?? [], 'id');
assertTest('Public navigation list excludes section when show_in_navigation=0', !in_array('anfahrt', $visibleNavIds, true));

// 7.2 Toggle is_published to 0
$res = httpReq('PATCH', "{$baseUrl}/api/sections/anfahrt/toggle", ['is_published' => 0], ['X-CSRF-Token' => $csrfToken], $cookieFile);
assertTest('Toggle is_published to 0 succeeded', ($res['json']['success'] ?? false) === true);

// Direct public request now returns 404
$pubRes = httpReq('GET', "{$baseUrl}/api/sections/anfahrt?lang=de");
assertTest('Unpublished section returns HTTP 404 for unauthenticated public requests', $pubRes['code'] === 404);

// 7.3 Reactivate anfahrt (published=1, show_in_navigation=1)
httpReq('PATCH', "{$baseUrl}/api/sections/anfahrt/toggle", ['is_published' => 1, 'show_in_navigation' => 1], ['X-CSRF-Token' => $csrfToken], $cookieFile);
$pubRes = httpReq('GET', "{$baseUrl}/api/sections/anfahrt?lang=de");
assertTest('Re-published section returns HTTP 200 for public requests', $pubRes['code'] === 200);

// -------------------------------------------------------------
// Test Group 8: HTML Sanitization on Updates (Stored XSS Defense)
// -------------------------------------------------------------
echo "\n8. Testing HTML Sanitization on Section Update...\n";

$origRes = httpReq('GET', "{$baseUrl}/api/sections/ueber-mich?lang=de", null, [], $cookieFile);
$origContent = $origRes['json']['content'] ?? '<p>Über mich Inhalt</p>';
$origTitle = $origRes['json']['title'] ?? 'Über mich';
$origSub = $origRes['json']['subtitle'] ?? '';

// Update with malicious payloads including protocol-relative link and style url()
$xssPayload = '<p>Sicherer Text</p><script>alert("hacked")</script><a href="javascript:alert(1)">Link</a><a href="//evil.example">Evil</a><div style="background-image:url(javascript:alert(1))">Div</div>';
$res = httpReq('PUT', "{$baseUrl}/api/sections/ueber-mich", [
    'lang' => 'de',
    'title' => 'Über mich Sicher',
    'subtitle' => $origSub,
    'content' => $xssPayload,
    'nav_label' => 'Über mich'
], ['X-CSRF-Token' => $csrfToken], $cookieFile);

assertTest('PUT with valid CSRF token returns HTTP 200', $res['code'] === 200);
$savedContent = $res['json']['section']['content'] ?? '';
assertTest('Sanitizer stripped <script> tags', !str_contains($savedContent, '<script>'));
assertTest('Sanitizer stripped javascript: URI', !str_contains($savedContent, 'javascript:'));
assertTest('Sanitizer stripped protocol-relative //evil.example', !str_contains($savedContent, '//evil.example'));
assertTest('Sanitizer stripped style url() expression', !str_contains($savedContent, 'url('));
assertTest('Sanitizer preserved valid safe paragraph', str_contains($savedContent, '<p>Sicherer Text</p>'));

// Restore original content
httpReq('PUT', "{$baseUrl}/api/sections/ueber-mich", [
    'lang' => 'de',
    'title' => $origTitle,
    'subtitle' => $origSub,
    'content' => $origContent,
    'nav_label' => 'Über mich'
], ['X-CSRF-Token' => $csrfToken], $cookieFile);

// -------------------------------------------------------------
// Test Group 9: Contact Form Endpoint & Security Toggles
// -------------------------------------------------------------
echo "\n9. Testing Contact Form Endpoint & Security Toggles...\n";

$beforeMessages = (new PDO('sqlite:' . getenv('CMS_DB_PATH')))->query('SELECT COUNT(*) FROM contact_messages')->fetchColumn();
for ($i = 0; $i < 20; $i++) {
    $res = httpReq('POST', "{$baseUrl}/api/contact", ['name' => 'Synthetic', 'email' => 'test@example.com', 'message' => 'Test']);
    assertTest('Contact route is unavailable', $res['code'] === 404);
}
$afterMessages = (new PDO('sqlite:' . getenv('CMS_DB_PATH')))->query('SELECT COUNT(*) FROM contact_messages')->fetchColumn();
assertTest('Contact storage remains unchanged', $beforeMessages === $afterMessages);

// Test Group 10: Rate Limiting & Anti-Lockout Isolation
// -------------------------------------------------------------
echo "\n10. Testing Login Rate Limiting & Anti-Lockout Isolation...\n";

$targetUser = 'lockout_target_' . time();
$attackerIp = '203.0.113.10';
$legitIp = '203.0.113.20';

$got429 = false;
for ($attempt = 1; $attempt <= 6; $attempt++) {
    $r = httpReq('POST', "{$baseUrl}/api/auth/login", [
        'username' => $targetUser,
        'password' => 'wrong_pass_' . $attempt
    ], ['X-Forwarded-For' => $attackerIp]);
    if ($r['code'] === 429) {
        $got429 = true;
        break;
    }
}
assertTest('Failed login attempts from attacker IP trigger HTTP 429', $got429);

// Anti-lockout: Legit user from distinct IP can still attempt login without being locked out
$rLegit = httpReq('POST', "{$baseUrl}/api/auth/login", [
    'username' => $targetUser,
    'password' => 'attempt_from_legit_ip'
], ['X-Forwarded-For' => $legitIp]);
assertTest('Legit IP is not locked out by attacker IP (HTTP 401, not 429)', $rLegit['code'] === 401);

// -------------------------------------------------------------
// Test Group 11: Logout CSRF & Session Invalidation
// -------------------------------------------------------------
echo "\n11. Testing Logout CSRF & Session Invalidation...\n";

// 11.1 Logout without CSRF token must return 403 Forbidden
$resNoCsrf = httpReq('POST', "{$baseUrl}/api/auth/logout", [], [], $cookieFile);
assertTest('Logout without CSRF token returns HTTP 403 Forbidden', $resNoCsrf['code'] === 403);

// 11.2 Logout with invalid CSRF token must return 403 Forbidden
$resBadCsrf = httpReq('POST', "{$baseUrl}/api/auth/logout", [], ['X-CSRF-Token' => 'invalid_csrf_token_value'], $cookieFile);
assertTest('Logout with invalid CSRF token returns HTTP 403 Forbidden', $resBadCsrf['code'] === 403);

// 11.3 Logout with valid CSRF token must succeed with HTTP 200
$resValid = httpReq('POST', "{$baseUrl}/api/auth/logout", [], ['X-CSRF-Token' => $csrfToken], $cookieFile);
assertTest('Logout with valid CSRF token returns HTTP 200', $resValid['code'] === 200);

// 11.4 Session check after logout confirms authentication is false
$res = httpReq('GET', "{$baseUrl}/api/auth/session", null, [], $cookieFile);
assertTest('Session after logout returns authenticated = false', ($res['json']['authenticated'] ?? null) === false);

// 11.5 Subsequent ?all=true request returns 401 Unauthorized
$res = httpReq('GET', "{$baseUrl}/api/sections?all=true", null, [], $cookieFile);
assertTest('Subsequent ?all=true request returns HTTP 401 Unauthorized', $res['code'] === 401);

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
echo "\n========================================================\n";
echo "  Test Results: {$passCount} Passed, {$failCount} Failed\n";
echo "========================================================\n";

if ($failCount > 0) {
    echo "❌ API Integration Test Suite FAILED!\n";
    exit(1);
} else {
    echo "✅ ALL API & Security Integration Tests PASSED successfully!\n";
    exit(0);
}
