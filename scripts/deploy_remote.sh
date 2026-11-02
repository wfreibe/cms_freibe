#!/usr/bin/env bash
set -euo pipefail
umask 077
base=${1:?}; php=${2:?}; release=${3:?}; digest=${4:?}
[[ "$base" =~ ^/kunden/[0-9]+_[0-9]+/webseiten/[a-zA-Z0-9_-]+$ ]] || exit 2
[[ "$php" =~ ^/[a-zA-Z0-9_./-]+$ ]] || exit 2
[[ "$release" =~ ^[a-zA-Z0-9-]+$ ]] || exit 2
[[ "$digest" =~ ^[a-f0-9]{64}$ ]] || exit 2
test -d "$base"
test "$(readlink -f "$base")" = "$base"
command -v flock > /dev/null
command -v rsync > /dev/null
command -v tar > /dev/null
mkdir -p "$base/.deploy"
exec 9>"$base/.deploy/deploy.lock"
flock -w 120 9
archive="$base/.deploy/packages/$release.zip"
test -f "$archive"
printf '%s  %s\n' "$digest" "$archive" | sha256sum -c -
stage="$base/.deploy/releases/$release"
history="$base/.deploy/history/$release"
# Never reuse or overwrite an earlier release or backup.
test ! -e "$stage"
test ! -e "$history"
mkdir -p "$stage" "$history"
printf 'Require all denied\n' > "$base/.deploy/.htaccess"
# Only audited application files may enter the deployment staging directory.
"$php" -r '
$zip = new ZipArchive();
if ($zip->open($argv[1]) !== true) exit(1);
$names = [];
for ($i=0; $i<$zip->numFiles; $i++) {
 $n = $zip->getNameIndex($i);
 if (isset($names[$n]) || str_contains($n, "\\") || str_contains($n, "\0") || preg_match("#(^|/)\\.\\.(/|$)#", $n)) exit(1);
 $names[$n] = true;
 if (!preg_match("#^(webroot/|server/(lib/|bin/|migrations/|seeds/|vendor/|docs/|config/cms_config\\.sample\\.php$|data/(\\.gitkeep)?$|backups/$))#", $n)) exit(1);
 if (preg_match("#(^|/)(cms_config\\.php|sessions|uploads)(/|$)|\\.(sqlite|db|log|env|key|pem)$#i", $n)) exit(1);
 $mode = ($zip->getExternalAttributesIndex($i, $opsys, $attributes)) ? (($attributes >> 16) & 0170000) : 0;
 if ($mode === 0120000) exit(1);
}
foreach (["webroot/index.html","webroot/api/api.php","server/lib/Database.php","server/bin/migrate.php"] as $required) if (!isset($names[$required])) exit(1);
if (!$zip->extractTo($argv[2])) exit(1);
' "$archive" "$stage"
test -f "$base/server/config/cms_config.php"
# This deployment is for the existing installation, never a fresh/empty database.
"$php" -r '
require $argv[1]."/server/lib/Database.php";
$c=Database::getConfig();
if (($c["db_path"] ?? "") !== $argv[1]."/server/data/content.sqlite" || !is_file($c["db_path"]) || empty($c["cookie_secure"])) exit(1);
' "$base"
"$php" "$base/server/bin/backup.php" | tee "$history/database-backup.txt"
if test -d "$base/server/data/uploads"; then
  tar -cf "$history/uploads.tar" -C "$base/server/data" uploads
fi
# Keep a complete application snapshot; runtime data and configuration stay private in place.
tar -cf "$history/application.tar" --exclude='server/data' --exclude='server/backups' --exclude='server/config' -C "$base" webroot server
# No --delete: existing data and extra host files must remain untouched.
rsync -rltp --chmod=D755,F644 --delay-updates --backup --backup-dir="$history/replaced-files" --exclude='/server/data/***' --exclude='/server/backups/***' --exclude='/server/config/cms_config.php' "$stage/" "$base/"
"$php" "$base/server/bin/migrate.php"
"$php" -r 'require $argv[1]."/server/lib/Readiness.php"; exit(Readiness::status() === 200 ? 0 : 1);' "$base"
printf '%s\n' "$release" > "$history/complete"
printf 'Application updated; database, uploads and configuration retained. Backup: %s\n' "$history"
