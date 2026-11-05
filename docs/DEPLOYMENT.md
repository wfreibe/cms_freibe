# Bereitstellung von freiberger.design

GitHub-Ziel: https://github.com/wfreibe/cms_freibe . Noch kein automatisches Hosting oder Deployment eingerichtet.

## Lokal prüfen und Paket erstellen

Node.js und PHP müssen im PATH verfügbar sein. PHP benötigt PDO_SQLite, mbstring, GD und für die Paketierung ZipArchive.

    npm ci
    npm --prefix frontend ci
    composer install --no-dev --prefer-dist --optimize-autoloader

Für die lokalen Seitentests zuerst in einem zweiten Terminal npm run dev starten, dann:

    npm test
    npm run package:deploy
    npm run package:source

Das geprüfte Hosting-Paket liegt unter dist-packages/cms_sfreibe-deploy.zip. Der Dateiname stammt vom Framework. Es enthält webroot/ und server/, aber keine aktive Konfiguration, Datenbank, Uploads, Sitzungen oder Backups. Source-Paket und GitHub enthalten Quellcode und öffentliche Ausgangsinhalte, keine privaten Laufzeitdaten.

## DomainFactory: Verzeichnisstruktur

Beide Ordner als Geschwister übertragen. Die Domain muss ausschließlich auf webroot/ zeigen. server/ darf nicht öffentlich erreichbar sein. PHP 8.4 oder neuer mit PDO_SQLite, mbstring und GD verwenden. Apache benötigt mod_rewrite und AllowOverride für die mitgelieferte .htaccess. HTTPS aktivieren.

server/config/cms_config.sample.php privat nach cms_config.php kopieren. Absolute private Pfade für Datenbank, Sitzungen und Backups prüfen; cookie_secure bleibt true. Keine lokalen HTTP-Einstellungen übernehmen. PHP benötigt Schreibrechte auf die privaten Daten-, Upload-, Session- und Backupverzeichnisse. Keine pauschalen 777-Rechte verwenden.

PHP-Uploadlimits müssen zusammenpassen: upload_max_filesize mindestens 8M, post_max_size größer als 8M (beispielsweise 16M). Die Anwendung begrenzt jedes Bild auf 8 MB und 12 Megapixel und akzeptiert JPEG, PNG und WebP. GD muss die verwendeten Formate unterstützen.

## Erstinstallation mit den derzeitigen CMS-Inhalten

Die aktuellen Änderungen stehen in der lokalen SQLite-Datenbank, nicht vollständig im Seed. Datenbank und das benachbarte uploads/-Verzeichnis müssen gemeinsam privat übertragen werden. Den lokalen Admin nicht versehentlich öffentlich verteilen: Zugang für Produktion bewusst übernehmen und Passwort ändern oder auf einem isolierten Import einen eigenen Zugang einrichten.

Für einen konsistenten Transfer Schreibzugriffe stoppen, mit php bin/backup.php eine SQLite-Sicherung erzeugen und diese sowie uploads/ in das private Server-Datenverzeichnis übertragen. Niemals eine laufende SQLite-Datei ohne passende Sicherung oder WAL-Beachtung kopieren. Backup und Uploads niemals in GitHub oder webroot ablegen. Die bestehende Backup-CLI sichert ausschließlich SQLite; Uploads zusätzlich sichern.

Dann auf dem Ziel aus server/ ausführen:

    php bin/migrate.php

Alternativ für einen ausdrücklich leeren Neuaufbau: Migrationen, php bin/import_design.php, dann php bin/provision_admin.php. Das Importskript verweigert eine vorhandene Inhaltsdatenbank. Das Einmalpasswort nur lokal im Terminal entgegennehmen und beim ersten Login ändern. Ein leerer Neuaufbau enthält nur die öffentlichen Seed-Inhalte, keine nachträglichen CMS-Uploads.

## Updates und Rückfallweg

Vor jedem Update Datenbank, Uploads und bisherige Programmversion sichern. Nur Programmdateien aktualisieren. server/config/cms_config.php, server/data, Uploads und Backups erhalten. Migrationen bewusst ausführen; keine Seed- oder Bootstrap-Kommandos auf bestehenden Daten starten. Bei Rückfall Programmversion und dazu passende gesicherte Daten gemeinsam wiederherstellen.

## Abnahme auf dem Zielhost

/api/ready muss 200 melden. Startseite, /aboutme, eine /project/-Adresse, /dsgvo und /cms direkt aufrufen und neu laden. Öffentliche Aufrufe dürfen kein Session-Cookie setzen. CMS über HTTPS anmelden und Passwortwechsel prüfen. Bild in Slideshow, Seitenbild und Hintergrund hochladen, speichern und nach Neuladen kontrollieren; auch Bildunterschriften, Reihenfolge und Original/16:9/links/rechts prüfen. Uploads müssen nach Programmupdates erhalten bleiben. Private Serverdateien dürfen über HTTP nicht abrufbar sein.

Die Apache-Konfiguration, Dateirechte, HTTPS und PHP-Limits bei DomainFactory können erst auf dem tatsächlichen Zielhost abschließend geprüft werden. Es wurde noch nichts veröffentlicht.
