<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit(1); }
require_once dirname(__DIR__) . '/lib/Database.php';
require_once dirname(__DIR__) . '/lib/HtmlSanitizer.php';
$db=Database::getConnection();
if ((int)$db->query('SELECT COUNT(*) FROM sections')->fetchColumn() !== 0) throw new RuntimeException('Import requires an empty local content database.');
$pages=json_decode(file_get_contents(dirname(__DIR__).'/seeds/design-pages.json'),true,512,JSON_THROW_ON_ERROR);
$db->beginTransaction();
try {
 $stmt=$db->prepare('INSERT INTO sections (id,lang,sort_order,nav_label,title,content,is_active,is_published,show_in_navigation) VALUES (?,\'de\',?,?,?,?,1,1,1)');
 foreach($pages as $i=>$page) $stmt->execute([$page['id'],$i+1,$page['title'],$page['title'],HtmlSanitizer::clean($page['content'])]);
 $db->commit(); echo count($pages)." pages imported.\n";
} catch(Throwable $e) { $db->rollBack(); throw $e; }
