<?php
declare(strict_types=1);
/** One submenu level, shared by all translations of a page. */
final class MenuHierarchy
{
 public static function input($parent): string {
  if(!is_string($parent)||($parent!==''&&$parent!=='@projects'&&!preg_match('/^[a-zA-Z0-9_-]{1,100}$/D',$parent)))throw new InvalidArgumentException('Ungültiger übergeordneter Menüpunkt.');
  return $parent;
 }
 public static function parent(PDO $db,string $id): string {
  $q=$db->prepare('SELECT parent_id FROM page_navigation WHERE section_id=?');$q->execute([$id]);$parent=$q->fetchColumn();
  return $parent!==false?$parent:(str_starts_with($id,'project-')?'@projects':'');
 }
 public static function save(PDO $db,string $id,string $parent): void {
  self::input($parent);
  if($id==='home'&&$parent!=='')throw new InvalidArgumentException('Die Startseite bleibt im Hauptmenü.');
  if($parent===$id)throw new InvalidArgumentException('Eine Seite kann nicht ihr eigener übergeordneter Menüpunkt sein.');
  if($parent!==''&&$parent!=='@projects'){
   $q=$db->prepare('SELECT id FROM sections WHERE id=?');$q->execute([$parent]);
   if(!$q->fetchColumn())throw new InvalidArgumentException('Der übergeordnete Menüpunkt existiert nicht.');
   if(self::parent($db,$parent)!=='')throw new InvalidArgumentException('Als übergeordneten Menüpunkt bitte eine Seite im Hauptmenü wählen.');
  }
  if($parent!==''){
   $q=$db->prepare('SELECT section_id FROM page_navigation WHERE parent_id=? LIMIT 1');$q->execute([$id]);
   if($q->fetchColumn())throw new InvalidArgumentException('Diese Seite hat Unterseiten. Ordnen Sie zuerst die Unterseiten neu zu.');
  }
  $q=$db->prepare('INSERT INTO page_navigation(section_id,parent_id) VALUES(?,?) ON CONFLICT(section_id) DO UPDATE SET parent_id=excluded.parent_id');$q->execute([$id,$parent]);
 }
 public static function remove(PDO $db,string $id): void {
  $q=$db->prepare("UPDATE page_navigation SET parent_id='' WHERE parent_id=?");$q->execute([$id]);
  $q=$db->prepare('DELETE FROM page_navigation WHERE section_id=?');$q->execute([$id]);
 }
}
