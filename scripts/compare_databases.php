<?php
/**
 * Read-Only Database Comparison Tool for cms_sfreibe
 * 
 * Compares two SQLite databases without modifying either database.
 * 
 * Usage:
 *   php scripts/compare_databases.php <db_a> <db_b> [--json]
 */

declare(strict_types=1);

if ($argc < 3) {
    echo "Usage: php " . basename(__FILE__) . " <database-a> <database-b> [--json]\n";
    exit(1);
}

$dbPathA = $argv[1];
$dbPathB = $argv[2];
$jsonOutput = in_array('--json', $argv, true);

if (!file_exists($dbPathA)) {
    fwrite(STDERR, "ERROR: Database A does not exist: {$dbPathA}\n");
    exit(1);
}
if (!file_exists($dbPathB)) {
    fwrite(STDERR, "ERROR: Database B does not exist: {$dbPathB}\n");
    exit(1);
}

try {
    // Open both databases strictly READ-ONLY
    $pdoA = new PDO("sqlite:{$dbPathA}", null, null, [
        PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $pdoB = new PDO("sqlite:{$dbPathB}", null, null, [
        PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (Throwable $e) {
    fwrite(STDERR, "ERROR: Failed to open database: " . $e->getMessage() . "\n");
    exit(1);
}

function getTables(PDO $pdo): array
{
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function getTableSchema(PDO $pdo, string $table): array
{
    $stmt = $pdo->query("PRAGMA table_info('{$table}')");
    $columns = [];
    foreach ($stmt->fetchAll() as $col) {
        $columns[$col['name']] = [
            'type' => $col['type'],
            'notnull' => (int)$col['notnull'],
            'dflt_value' => $col['dflt_value'],
            'pk' => (int)$col['pk']
        ];
    }
    return $columns;
}

$tablesA = getTables($pdoA);
$tablesB = getTables($pdoB);

$allTables = array_unique(array_merge($tablesA, $tablesB));
sort($allTables);

$report = [
    'database_a' => [
        'path' => realpath($dbPathA) ?: $dbPathA,
        'size' => filesize($dbPathA),
        'tables' => $tablesA
    ],
    'database_b' => [
        'path' => realpath($dbPathB) ?: $dbPathB,
        'size' => filesize($dbPathB),
        'tables' => $tablesB
    ],
    'missing_tables_in_a' => array_values(array_diff($tablesB, $tablesA)),
    'missing_tables_in_b' => array_values(array_diff($tablesA, $tablesB)),
    'schema_differences' => [],
    'record_counts' => [],
    'sections_comparison' => [
        'missing_in_a' => [],
        'missing_in_b' => [],
        'field_differences' => []
    ],
    'accordions_comparison' => [
        'missing_in_a' => [],
        'missing_in_b' => [],
        'field_differences' => []
    ]
];

// Compare table schemas and record counts
foreach ($allTables as $t) {
    $inA = in_array($t, $tablesA, true);
    $inB = in_array($t, $tablesB, true);

    $countA = $inA ? (int)$pdoA->query("SELECT COUNT(*) FROM {$t}")->fetchColumn() : null;
    $countB = $inB ? (int)$pdoB->query("SELECT COUNT(*) FROM {$t}")->fetchColumn() : null;

    $report['record_counts'][$t] = [
        'count_a' => $countA,
        'count_b' => $countB,
        'matches' => ($countA === $countB)
    ];

    if ($inA && $inB) {
        $schemaA = getTableSchema($pdoA, $t);
        $schemaB = getTableSchema($pdoB, $t);
        if ($schemaA !== $schemaB) {
            $report['schema_differences'][$t] = [
                'columns_in_a_only' => array_diff_key($schemaA, $schemaB),
                'columns_in_b_only' => array_diff_key($schemaB, $schemaA)
            ];
        }
    }
}

// Compare sections table
if (in_array('sections', $tablesA, true) && in_array('sections', $tablesB, true)) {
    $rowsA = $pdoA->query("SELECT * FROM sections ORDER BY id, lang")->fetchAll();
    $rowsB = $pdoB->query("SELECT * FROM sections ORDER BY id, lang")->fetchAll();

    $mapA = [];
    foreach ($rowsA as $r) {
        $mapA[$r['id'] . '::' . $r['lang']] = $r;
    }
    $mapB = [];
    foreach ($rowsB as $r) {
        $mapB[$r['id'] . '::' . $r['lang']] = $r;
    }

    $keysA = array_keys($mapA);
    $keysB = array_keys($mapB);

    $report['sections_comparison']['missing_in_a'] = array_values(array_diff($keysB, $keysA));
    $report['sections_comparison']['missing_in_b'] = array_values(array_diff($keysA, $keysB));

    $commonKeys = array_intersect($keysA, $keysB);
    foreach ($commonKeys as $k) {
        $rowA = $mapA[$k];
        $rowB = $mapB[$k];
        $diffs = [];

        foreach ($rowA as $col => $valA) {
            $valB = $rowB[$col] ?? null;
            if ($valA !== $valB) {
                $diffs[$col] = [
                    'val_a_preview' => is_string($valA) ? (strlen($valA) > 60 ? substr($valA, 0, 57) . '...' : $valA) : $valA,
                    'val_b_preview' => is_string($valB) ? (strlen($valB) > 60 ? substr($valB, 0, 57) . '...' : $valB) : $valB,
                    'length_a' => is_string($valA) ? strlen($valA) : null,
                    'length_b' => is_string($valB) ? strlen($valB) : null
                ];
            }
        }

        if (!empty($diffs)) {
            $report['sections_comparison']['field_differences'][$k] = [
                'updated_at_a' => $rowA['updated_at'] ?? 'N/A',
                'updated_at_b' => $rowB['updated_at'] ?? 'N/A',
                'differences' => $diffs
            ];
        }
    }
}

// Compare section_accordions table
if (in_array('section_accordions', $tablesA, true) && in_array('section_accordions', $tablesB, true)) {
    $rowsA = $pdoA->query("SELECT * FROM section_accordions ORDER BY id, lang")->fetchAll();
    $rowsB = $pdoB->query("SELECT * FROM section_accordions ORDER BY id, lang")->fetchAll();

    $mapA = [];
    foreach ($rowsA as $r) {
        $mapA[$r['id'] . '::' . $r['lang']] = $r;
    }
    $mapB = [];
    foreach ($rowsB as $r) {
        $mapB[$r['id'] . '::' . $r['lang']] = $r;
    }

    $keysA = array_keys($mapA);
    $keysB = array_keys($mapB);

    $report['accordions_comparison']['missing_in_a'] = array_values(array_diff($keysB, $keysA));
    $report['accordions_comparison']['missing_in_b'] = array_values(array_diff($keysA, $keysB));

    $commonKeys = array_intersect($keysA, $keysB);
    foreach ($commonKeys as $k) {
        $rowA = $mapA[$k];
        $rowB = $mapB[$k];
        $diffs = [];

        foreach ($rowA as $col => $valA) {
            $valB = $rowB[$col] ?? null;
            if ($valA !== $valB) {
                $diffs[$col] = [
                    'val_a_preview' => is_string($valA) ? (strlen($valA) > 60 ? substr($valA, 0, 57) . '...' : $valA) : $valA,
                    'val_b_preview' => is_string($valB) ? (strlen($valB) > 60 ? substr($valB, 0, 57) . '...' : $valB) : $valB,
                ];
            }
        }

        if (!empty($diffs)) {
            $report['accordions_comparison']['field_differences'][$k] = [
                'updated_at_a' => $rowA['updated_at'] ?? 'N/A',
                'updated_at_b' => $rowB['updated_at'] ?? 'N/A',
                'differences' => $diffs
            ];
        }
    }
}

if ($jsonOutput) {
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    exit(0);
}

// Terminal Human-Readable Report
echo "====================================================================\n";
echo "   READ-ONLY DATABASE COMPARISON REPORT                             \n";
echo "====================================================================\n";
echo "Database A: {$dbPathA} (" . number_format(filesize($dbPathA)) . " bytes)\n";
echo "Database B: {$dbPathB} (" . number_format(filesize($dbPathB)) . " bytes)\n\n";

echo "1. TABLES & RECORD COUNTS:\n";
printf("  %-25s | %-12s | %-12s | %s\n", "Table", "Count in A", "Count in B", "Status");
echo "  " . str_repeat("-", 65) . "\n";
foreach ($report['record_counts'] as $table => $info) {
    $cA = $info['count_a'] !== null ? (string)$info['count_a'] : 'MISSING';
    $cB = $info['count_b'] !== null ? (string)$info['count_b'] : 'MISSING';
    $status = $info['matches'] ? 'OK (Identical)' : 'MISMATCH';
    printf("  %-25s | %-12s | %-12s | %s\n", $table, $cA, $cB, $status);
}

echo "\n2. SCHEMA DIFFERENCES:\n";
if (empty($report['schema_differences'])) {
    echo "  None. Existing common tables share identical column definitions.\n";
} else {
    foreach ($report['schema_differences'] as $t => $d) {
        echo "  Table '{$t}': differences detected in columns.\n";
    }
}

echo "\n3. SECTIONS COMPARISON:\n";
if (!empty($report['sections_comparison']['missing_in_a'])) {
    echo "  Missing in A: " . implode(', ', $report['sections_comparison']['missing_in_a']) . "\n";
}
if (!empty($report['sections_comparison']['missing_in_b'])) {
    echo "  Missing in B: " . implode(', ', $report['sections_comparison']['missing_in_b']) . "\n";
}
if (empty($report['sections_comparison']['field_differences'])) {
    echo "  All common sections are 100% IDENTICAL in content.\n";
} else {
    echo "  Found " . count($report['sections_comparison']['field_differences']) . " section(s) with differences:\n";
    foreach ($report['sections_comparison']['field_differences'] as $key => $diffInfo) {
        echo "    * Section '{$key}' (updated_at A: {$diffInfo['updated_at_a']}, B: {$diffInfo['updated_at_b']}):\n";
        foreach ($diffInfo['differences'] as $col => $vals) {
            echo "        - {$col}:\n";
            echo "            A: {$vals['val_a_preview']} (len: {$vals['length_a']})\n";
            echo "            B: {$vals['val_b_preview']} (len: {$vals['length_b']})\n";
        }
    }
}

echo "\n4. ACCORDIONS COMPARISON:\n";
if (!empty($report['accordions_comparison']['missing_in_a'])) {
    echo "  Missing in A: " . implode(', ', $report['accordions_comparison']['missing_in_a']) . "\n";
}
if (!empty($report['accordions_comparison']['missing_in_b'])) {
    echo "  Missing in B: " . implode(', ', $report['accordions_comparison']['missing_in_b']) . "\n";
}
if (empty($report['accordions_comparison']['field_differences'])) {
    echo "  All common accordions are 100% IDENTICAL in content.\n";
} else {
    echo "  Found " . count($report['accordions_comparison']['field_differences']) . " accordion(s) with differences:\n";
    foreach ($report['accordions_comparison']['field_differences'] as $key => $diffInfo) {
        echo "    * Accordion '{$key}':\n";
        foreach ($diffInfo['differences'] as $col => $vals) {
            echo "        - {$col}: A='{$vals['val_a_preview']}' vs B='{$vals['val_b_preview']}'\n";
        }
    }
}

echo "\n====================================================================\n";
echo "END OF REPORT\n";
