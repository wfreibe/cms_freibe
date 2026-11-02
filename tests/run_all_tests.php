<?php
/**
 * Master Automated Test Runner for CMS_SFREIBE
 * 
 * Invokes tests/test_runner.js to ensure complete database isolation,
 * runtime credential generation, and working database integrity verification.
 */

declare(strict_types=1);

$testRunner = __DIR__ . '/test_runner.js';
passthru('node ' . escapeshellarg($testRunner), $exitCode);
exit($exitCode);
