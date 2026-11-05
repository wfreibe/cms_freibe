<?php
declare(strict_types=1);
class PageUrlConflict extends RuntimeException {}

/** URL ownership includes former addresses, so a rename cannot break another page. */
final class PageUrls
{
    public const LEGACY = [
        'home'=>'/','aboutme'=>'/aboutme','contact'=>'/contact',
        'project-l1_p'=>'/project/L1_p','project-f_m'=>'/project/F_m',
        'project-z_n'=>'/project/Z_n','project-k_m'=>'/project/K_m',
        'project-wh'=>'/project/wh','project-pc'=>'/project/pc',
        'legalnotice'=>'/legalnotice','dsgvo'=>'/dsgvo',
        'impressum'=>'/impressum','datenschutz'=>'/datenschutz'
    ];
    public const RESERVED = ['api','cms','assets','media','files','licenses','section','project','tests','src','node_modules'];

    public static function slug(string $value): string
    {
        $value = strtr(trim($value), ['Ä'=>'Ae','Ö'=>'Oe','Ü'=>'Ue','ä'=>'ae','ö'=>'oe','ü'=>'ue','ß'=>'ss','ẞ'=>'SS']);
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = strtolower($ascii === false ? $value : $ascii);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $value), '-');
    }

    public static function input($value): string
    {
        if (!is_string($value) || mb_strlen($value)>200 || preg_match('~[/\\\\?#:\x00-\x1f]~', $value)) throw new InvalidArgumentException('URL-Name ohne Schrägstriche, Protokoll oder Parameter eingeben.');
        if (trim($value)==='') return '';
        $slug=self::slug($value);
        if ($slug==='' || strlen($slug)>100) throw new InvalidArgumentException('URL-Name muss 1 bis 100 Buchstaben/Ziffern oder Bindestriche ergeben.');
        if (in_array($slug,self::RESERVED,true)) throw new InvalidArgumentException('Diese Adresse ist für eine technische Funktion reserviert.');
        return $slug;
    }

    public static function path(PDO $db,string $id): string
    {
        $q=$db->prepare('SELECT path FROM page_urls WHERE section_id=? AND is_current=1');$q->execute([$id]);
        return $q->fetchColumn() ?: (self::LEGACY[$id] ?? '/section/'.rawurlencode($id));
    }

    public static function fields(PDO $db,string $id): array
    {
        $path=self::path($db,$id);
        return ['url_path'=>$path,'url_slug'=>preg_match('~^/[a-z0-9-]+$~D',$path)?substr($path,1):''];
    }

    public static function claim(PDO $db,string $id,string $input,string $menuName,bool $new): void
    {
        if ($id==='home') {
            if (trim($input)!=='') throw new PageUrlConflict('Die Startseite behält die Adresse /.');
            return;
        }
        $slug=self::input($input);
        $q=$db->prepare('SELECT path FROM page_urls WHERE section_id=? AND is_current=1');$q->execute([$id]);$current=$q->fetchColumn();
        if ($slug==='') {
            // A later menu rename must never silently change an established URL.
            if ($current || (!$new && isset(self::LEGACY[$id]))) return;
            $slug=self::input(self::slug($menuName));
            if ($slug==='') throw new PageUrlConflict('Aus dem Menünamen lässt sich keine Adresse bilden. Bitte einen URL-Namen eingeben.');
        }
        $path='/'.$slug;
        foreach(self::LEGACY as $owner=>$legacy) if(strcasecmp($path,$legacy)===0 && $owner!==$id) throw new PageUrlConflict('Diese Adresse gehört bereits zu einer bestehenden Seite.');
        $q=$db->prepare('SELECT section_id FROM page_urls WHERE path=?');$q->execute([$path]);$owner=$q->fetchColumn();
        if($owner!==false && $owner!==$id) throw new PageUrlConflict('Diese Adresse wird bereits verwendet – auch frühere Seitenadressen bleiben geschützt.');
        $q=$db->prepare('UPDATE page_urls SET is_current=0 WHERE section_id=?');$q->execute([$id]);
        $q=$db->prepare('INSERT INTO page_urls(path,section_id,is_current) VALUES(?,?,1) ON CONFLICT(path) DO UPDATE SET is_current=1');$q->execute([$path,$id]);
    }

    public static function resolve(PDO $db,string $path,string $lang='de'): ?array
    {
        if(strlen($path)>500 || !str_starts_with($path,'/') || str_starts_with($path,'//') || preg_match('~[\\\\\x00-\x20?#]~',$path)) return null;
        $lookup=rtrim($path,'/') ?: '/';$id=null;
        foreach(self::LEGACY as $owner=>$old) if(strcasecmp($lookup,$old)===0){$id=$owner;break;}
        if($id===null && preg_match('~^/section/([a-zA-Z0-9_-]+)$~D',$lookup,$m)) $id=$m[1];
        if($id===null){$q=$db->prepare('SELECT section_id FROM page_urls WHERE path=?');$q->execute([$lookup]);$id=$q->fetchColumn();}
        if(!$id)return null;
        $q=$db->prepare('SELECT id FROM sections WHERE id=? AND lang=? AND (is_published=1 OR (is_published IS NULL AND is_active=1))');$q->execute([$id,$lang]);
        if(!$q->fetchColumn())return null;
        $canonical=self::path($db,$id);
        return ['id'=>$id,'url_path'=>$canonical,'redirect'=>$path!==$canonical];
    }
}
