<?php
declare(strict_types=1);
// The legacy bulk writer bypassed editorial publication and sanitizer controls.
// Keep read-only comparison available; changes go through the authenticated CMS.
if (in_array('--apply', $argv, true)) {
    fwrite(STDERR, "Bulk writes are retired. Review differences, then edit through the authenticated CMS.\n");
    exit(1);
}
require __DIR__ . '/compare_databases.php';
