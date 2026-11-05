# freiberger.design

Portfolio-Webseite mit eigenem, modular aufgebautem CMS für Architektur und Webdevelopment. Die Anwendung basiert auf `cms_sfreibe` und wurde für die Inhalte und Gestaltung von freiberger.design weiterentwickelt. Die Architekturleistungen umfassen LP 1–4.

- Öffentliche Webseite: [freiberger.design](https://freiberger.design)
- Redaktionsbereich: [freiberger.design/cms](https://freiberger.design/cms)
- Repository: [wfreibe/cms_freibe](https://github.com/wfreibe/cms_freibe)

## Technologie im Überblick

| Bereich | Technologie | Aufgabe |
| --- | --- | --- |
| Frontend | Preact 10, JavaScript und JSX | Öffentliche Webseite, CMS-Oberfläche und Inhaltsvorschau |
| Entwicklung und Build | Vite 6, npm | Entwicklungsserver und produktive JavaScript-/CSS-Dateien |
| Gestaltung | CSS, responsive Komponenten, lokal ausgelieferte Schriften | Portfolio-Layout und CMS-Bedienoberfläche |
| Backend | PHP, JSON-API | Inhalte lesen und speichern, Anmeldung, Validierung und Medienauslieferung |
| Datenbank | SQLite über PDO | Seiten, Inhaltselemente, Menüstruktur, Seitenadressen und Administratorzugang |
| HTML-Bereinigung | DOMPurify im Browser, HTMLPurifier im Backend | Bereinigung formatierter Texte und übernommener HTML-Strukturen |
| Bildverarbeitung | PHP GD | Prüfung, Dekodierung und Neukodierung von Bild-Uploads |
| PHP-Abhängigkeiten | Composer | Installation der Backend-Bibliotheken |
| Hosting und Deployment | DomainFactory, Apache/PHP, GitHub Actions, SSH und rsync | Automatische Prüfung und Veröffentlichung |

Node.js wird zum Entwickeln, Testen und Bauen benötigt. In Produktion laufen statische Frontend-Dateien und die PHP-API; dort wird kein Node.js- oder Vite-Prozess benötigt. Die CI verwendet Node.js 22 und PHP 8.3. Das Deployment setzt PHP ab 8.2 voraus und nutzt auf dem eingerichteten Server ausdrücklich `/usr/bin/php83`.

## Frontend

Die öffentliche Webseite und der Redaktionsbereich sind Komponenten derselben Preact-Anwendung. Die Inhalte werden über `/api` geladen. Öffentliche Seiten zeigen ausschließlich veröffentlichte Inhalte; die geschützte CMS-Vorschau kann auch Entwürfe darstellen.

| Komponente | Aufgabe |
| --- | --- |
| `PublicWebsite.jsx` | Öffentliche Webseite mit Navigation und Projektseiten |
| `CMSDashboard.jsx` | Anmeldung und Anbindung der CMS-Verwaltung |
| `CMSWorkspace.jsx` | Seitenauswahl, gespeicherte Seitenübersicht und Vorschau |
| `AdminModal.jsx` | Editor für Seiteneinstellungen und Inhaltselemente |
| `ContentBlocksEditor.jsx` | Inhaltselemente hinzufügen, bearbeiten, sortieren und entfernen |
| `ContentBlocks.jsx` | Gemeinsame Darstellung für Webseite und ungespeicherte Editor-Vorschau |
| `RichTextEditor.jsx` | Formatierter Texteditor mit HTML-Ansicht |
| `SlideshowEditor.jsx` | Bild-Uploads, Bildunterschriften, Reihenfolge und Slideshow-Vorschau |

Die Komponenten liegen in `frontend/src/components/`. Bilder, CSS und Schriften werden lokal ausgeliefert. Slideshows verwenden eine eigene Komponente mit weichem Bildwechsel ohne Zoom; das ursprüngliche proprietäre MagicSlideshow-Skript wird nicht benötigt.

## Backend und Datenhaltung

Der zentrale Einstiegspunkt `frontend/public/api/api.php` stellt eine JSON-API bereit. Die PHP-Klassen in `lib/` übernehmen unter anderem Datenbankzugriff, Authentifizierung, Inhaltsvalidierung, Bildverarbeitung, Seitenadressen und Navigation.

- **SQLite:** Seiten und sprachabhängige Inhalte liegen in `sections`. Die sortierte Elementliste wird im JSON-Feld `content_blocks` gespeichert. Weitere Tabellen verwalten unter anderem Akkordeons, URL-Zuordnungen, Menüzuordnungen, Administratorzugang und Schema-Migrationen.
- **Migrationen:** Nummerierte SQL-Dateien unter `migrations/` entwickeln das Schema weiter. Bestehende Inhaltsdaten werden beim normalen Deployment erhalten.
- **Uploads:** Hochgeladene Bilder liegen in einem privaten Upload-Verzeichnis neben der Datenbank. Die API liefert sie über `/api/media/ID` aus.
- **Konfiguration:** Die aktive `config/cms_config.php` definiert private Pfade und Sitzungseinstellungen und gehört nicht ins Repository oder Deployment-Paket.
- **Code und Inhalte:** Git verwaltet den Programmcode. Lokale und produktive CMS-Inhalte werden durch einen Push nicht synchronisiert.

In Produktion sind `webroot/` für öffentlich erreichbare Dateien und `server/` für Bibliotheken, Konfiguration, Datenbank, Uploads, Sitzungen und Backups getrennt.

## CMS und Inhaltselemente

Eine Seite besitzt Seiteneinstellungen und eine gemeinsame Liste von Inhaltselementen. Vorhandene Elemente sind zunächst einzeln zugeklappt. Sie lassen sich unabhängig öffnen, am Griff oder mit Pfeilen sortieren, ein-/ausblenden und nach Bestätigung einzeln entfernen. Neue Elemente werden unten angehängt und automatisch geöffnet. Eine Seite unterstützt bis zu 50 Elemente.

| Inhaltselement | Funktionen |
| --- | --- |
| **Text** | Optionale Überschrift und formatierter Text mit Überschriften, Fett/Kursiv, Listen und Links; HTML-Ansicht sowie Rückgängig/Wiederholen |
| **Bild / Bild mit Text** | Upload oder lokaler Bildpfad, Alternativtext, Bildunterschrift und optionaler Text; Originalformat als Standard, außerdem 16:9, 3:2, 4:3, 1:1 und 3:4; Bild über oder neben dem Text, Ausrichtung, Breite und Bildfokus |
| **Slideshow** | Bilder hochladen oder austauschen, Titel und Bildunterschriften bearbeiten, Reihenfolge per Ziehen oder Pfeilen ändern und Standzeit einstellen; Vorschau vor dem Speichern |
| **Akkordeon** | Aufklappbare Themen mit Überschrift, formatiertem Text und eigener Sichtbarkeit |
| **YouTube-Video** | Video-Adresse oder ID, eigenes lokales Vorschaubild und Bildunterschrift; Verbindung zu YouTube erst nach Klick auf „YouTube-Video laden“ |
| **Audio** | HTML-Audioplayer für MP3, OGG, WAV oder M4A vom eigenen Webspace; die Datei wird vorher auf dem Webspace abgelegt, ein Audio-Upload ist nicht eingebaut |
| **Link / Schaltfläche** | Beschriftung und internes Ziel oder externe HTTPS-Adresse; Darstellung als Textlink oder Schaltfläche |

Die Seitengestaltung mit Hintergrundfarbe und Hintergrundbild ist eine eigene Seiteneinstellung. Auf kleinen Bildschirmen werden Bild und Text untereinander dargestellt.

Beim Öffnen älterer Seiten werden die bisherigen Texte, Bilder, Slideshows und Akkordeons zunächst im Editor-Entwurf in einzelne Elemente überführt. Erst **Speichern** legt diese Liste ab. Die ursprünglichen Inhaltsfelder bleiben als Rückfallebene erhalten; es erfolgt keine automatische Massenumstellung der Datenbank. Bereinigte Layout-Rahmen erhalten dabei die vorhandene Bild-/Textanordnung.

Die Seitenübersicht zeigt den gespeicherten Stand ohne Eingabefeld-Optik. Änderungen erfolgen über **Inhalt bearbeiten**. **Abbrechen** verwirft ungespeicherte Inhaltsänderungen.

### Seitenadressen und Navigation

Menüname und URL-Name können unabhängig vergeben werden. Bei neuen Seiten erzeugt ein leeres URL-Feld den Namen aus dem Menüeintrag, mit deutschen Umlauten als `ae`, `oe`, `ue` und `ß` als `ss`. Bestehende Adressen bleiben bei einer reinen Umbenennung des Menüpunkts stabil; geänderte registrierte Adressen können auf die neue Adresse weiterleiten.

Veröffentlichung, Menü-Sichtbarkeit, Reihenfolge und Zuordnung zum Hauptmenü oder zu einem übergeordneten Menüpunkt steuern die öffentliche Navigation. Die Inhaltsbearbeitung unterstützt Deutsch, Englisch und Französisch.

### Bild-Uploads

Für Bildbausteine, Slideshows, Video-Vorschaubilder und Seitenhintergründe wird dieselbe geschützte Upload-Verarbeitung verwendet:

- JPEG, PNG und WebP; maximal 8 MiB und 12 Millionen Pixel pro Bild.
- Prüfung und Neukodierung mit GD, anschließend Speicherung mit zufälligem Dateinamen.
- Die Datei wird sofort hochgeladen; ihre Zuordnung zum Inhalt wird erst mit der Seite gespeichert.
- Entfernen einer Zuordnung oder Abbrechen löscht die hochgeladene Datei nicht automatisch.

Für einen Umzug müssen Datenbank und Upload-Verzeichnis gemeinsam übernommen werden. Der Datenbank-Backup-Befehl allein sichert keine Bilddateien; der Deployment-Prozess sichert zusätzlich die Uploads.

## Anmeldung und Datenschutz

Öffentliche Inhaltsabrufe starten keine CMS-Sitzung. Das CMS verwendet ein Session-Cookie mit `Path=/api`, `HttpOnly` und `SameSite=Strict`, in Produktion zusätzlich `Secure`. Schreibzugriffe benötigen Anmeldung und CSRF-Token; fehlgeschlagene Anmeldungen werden begrenzt.

YouTube wird erst nach ausdrücklichem Laden des Videos eingebunden. Dabei entsteht eine Verbindung zu YouTube/Google; die vorgelagerte Ansicht verwendet ein eigenes lokales Vorschaubild. Die App besitzt kein aktives Kontaktformular zum Versand von Nachrichten.

## Lokal entwickeln

Voraussetzungen: Node.js und npm, Composer sowie PHP mit PDO_SQLite, DOM, mbstring, Sessions, GD und ZIP. Für eine zur CI passende Umgebung Node.js 22 und PHP 8.3 verwenden.

```sh
npm ci
npm --prefix frontend ci
composer install
```

Für eine neue lokale Installation `config/cms_config.sample.php` als `config/cms_config.php` übernehmen, private Datenbank-, Backup- und Sitzungspfade einrichten und für lokales HTTP `cookie_secure` auf `false` setzen. Vorhandene Konfigurationen und Inhaltsdatenbanken beibehalten.

```sh
php bin/migrate.php
# Nur für eine neue, leere Inhaltsdatenbank:
php bin/import_design.php
# Nur wenn noch kein Administrator vorhanden ist:
php bin/provision_admin.php
npm run dev
```

Die Provisionierung erzeugt ein Einmalpasswort, das bei der ersten Anmeldung geändert werden muss. Sie überschreibt keinen vorhandenen Zugang. `seeds/design-pages.json` enthält die ursprünglichen öffentlichen Inhalte und ist kein Export des aktuellen produktiven CMS.

- Webseite: [127.0.0.1:3011](http://127.0.0.1:3011/)
- CMS: [127.0.0.1:3011/cms](http://127.0.0.1:3011/cms)
- API-Readiness: [127.0.0.1:8011/api/ready](http://127.0.0.1:8011/api/ready)

## Tests, Build und Deployment

| Befehl | Zweck |
| --- | --- |
| `npm test` | Inhalts-, API-, Sicherheits-, Upload-, URL-, Navigations- und Elementtests |
| `npm run build` | Produktionsbuild mit Build- und Isolationsprüfung |
| `npm run package:deploy` | Frischer Build und geprüftes Deployment-ZIP ohne aktive Konfiguration oder Laufzeitdaten |
| `php bin/backup.php` | Sicherung der Inhaltsdatenbank |

Der Originalseiten-Vergleich in `npm test` benötigt eine laufende Anwendung mit den unveränderten Seed-Inhalten. Bearbeitete lokale Seiten können von diesen Vergleichsdaten abweichen. GitHub führt die Tests deshalb mit einer getrennten Testdatenbank aus; viele weitere Tests erzeugen selbst isolierte Testumgebungen.

- **`development`:** Entwicklung; ein Push startet Tests und erstellt ein geprüftes Deployment-Artefakt.
- **Pull Request:** Prüfung vor der Übernahme nach `master`, ohne Produktionsdeployment.
- **`master`:** Nach erfolgreichen Prüfungen veröffentlicht GitHub Actions automatisch auf DomainFactory.

Der Workflow sichert Datenbank, Uploads und Programmdateien vor der Aktualisierung. Er überträgt das geprüfte Paket per SSH und rsync ohne Löschabgleich. Produktive Datenbank, Uploads, aktive Konfiguration und vorhandene Backups werden nicht durch lokale Daten ersetzt. Anschließend laufen Migrationen sowie Readiness- und HTTPS-Prüfungen. Maßgeblich ist `.github/workflows/deploy.yml`.

## Weiterführende Dokumentation

- [Technische Übersicht und Deployment-Prozess](docs/TECHNIK_UND_DEPLOYMENT.md)
- [Inhaltselemente, Datenmodell und Bedienung](docs/INHALTSBAUSTEINE.md)
- [Automatisches GitHub-Deployment](docs/GITHUB_DEPLOYMENT.md)
- [Hosting und Deployment-Paket](docs/DEPLOYMENT.md)
