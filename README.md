# freiberger.design – lokaler CMS-Aufbau

Technische Basis: cms_sfreibe (Preact/Vite, PHP 8.1+, PDO-SQLite, HTMLPurifier, DOMPurify). Bestehende Texte, Seitenadressen, Bilder und Semantic-UI/Bootstrap-Gestaltung stammen aus dem öffentlichen Stand vom 30.10.2026. Elf Seiten und 48 lokale Medien-/CSS-/Schriftdateien wurden übernommen. Die bisherige Slideshow läuft lokal ohne das proprietäre MagicSlideshow-Skript.

## Start

Im Projektordner: npm run dev

- Webseite: http://127.0.0.1:3011/
- CMS: http://127.0.0.1:3011/cms
- PHP-API: http://127.0.0.1:8011/api/ready

Konfiguration, SQLite, Sessions und Backups sind von cms_sfreibe getrennt. Die aktive Konfiguration ist ausschließlich für lokales HTTP eingerichtet. Keine Veröffentlichung wurde eingerichtet oder ausgeführt.

## CMS-Zugang

php bin/provision_admin.php erstellt einen eigenen Administrator mit einmaligem Passwort. Der lokale Administrator admin wurde angelegt. Das Einmalpasswort steht in tmp/admin-bootstrap.txt (ignoriert durch Git). Nach erfolgreichem Passwortwechsel diese Datei entfernen. Das Passwort muss bei der ersten Anmeldung geändert werden. Der Provisionierungsbefehl überschreibt keinen vorhandenen Zugang.

## Neuaufbau und Prüfung

npm ci; npm --prefix frontend ci; composer install

Konfiguration aus config/cms_config.sample.php erstellen, lokale HTTP-Cookies und private Session-/DB-Pfade einstellen. Dann php bin/migrate.php und bei leerer lokaler Datenbank php bin/import_design.php. Öffentliche Ausgangsinhalte liegen in seeds/design-pages.json; importierte Texte und Bilder werden durch beide Sanitizer geschützt. Bilder und Strukturklassen wurden hierfür eng begrenzt in die Allowlisten aufgenommen.

npm run build prüft Build und Isolation. Bei laufender Vorschau prüft npm test alle elf Seiten auf Text- und Bilderhaltung, API-Zugriffsschutz, Readiness, API-Routing und DOMPurify. Die übernommenen weiteren Frameworktests bleiben unter npm run test:framework verfügbar; diese enthalten vorbildspezifische Annahmen und sind kein zugesicherter Projekt-Gesamttest.

## Stand und Grenzen

Seiteninhalte werden als CMS-Sektionen bearbeitet. Das vorhandene Navigationslayout und die bisherigen URLs sind in frontend/src/site-shell.json und page-routes.json abgebildet. Neue CMS-Sektionen sind über /section/ID erreichbar; eine freie Änderung der historischen URL-Struktur ist noch nicht Teil dieses Aufbaus. Vorhandene Copyright- und Rechtstexte wurden unverändert übernommen. Die alten Tracking-/Cookie- und Drittanbieter-Skripte wurden nicht übernommen; CSS, Bilder und Schriften liegen lokal. Verlinkte externe Webseiten bleiben externe Ziele.

Die Lockdateien wurden zunächst ohne Versionsänderung übernommen. Die Frontend-Abhängigkeiten wurden für die Deployment-Vorbereitung aktualisiert; npm audit meldet am 2. November 2026 keine bekannten Befunde. Lokaler Node-Stand bei Aufbau: 18.20.8; das Vorbild empfiehlt Node 20+.

## Slideshow-Editor

Im CMS einen Seitenbereich auswählen und Inhalt bearbeiten öffnen. Unter Slideshow lassen sich JPEG-, PNG- und WebP-Bilder hinzufügen oder austauschen, Bildtitel und Bildunterschriften ändern sowie Bilder am Griff sortieren. Alternativ dienen Pfeile zur Sortierung auf Touchgeräten oder per Tastatur. Speichern übernimmt Reihenfolge und Texte mit der Seite; Abbrechen verwirft diese Eingaben. Uploads werden sofort als geprüfte und neu kodierte Bilddateien im privaten Verzeichnis neben der SQLite-Datei unter uploads/ gespeichert und über /api/media/ID ausgeliefert. Maximal 8 MB und 12 Megapixel pro Bild; PHP benötigt GD. Entfernen aus der Slideshow oder Abbrechen löscht bereits hochgeladene Dateien nicht. Bei Sicherung oder späterem Hostingwechsel müssen Datenbank und uploads/ gemeinsam gesichert und übertragen werden. Die bestehenden Backup-Befehle sichern bislang ausschließlich die Datenbank.

## Cookies und öffentliche Webseite

Öffentliche Seiten und Inhaltsabfragen öffnen keine CMS-Sitzung und verwenden keine lokale Sprachspeicherung. Die CMS-Anmeldung verwendet ein Session-Cookie mit Path=/api. Öffentliche Inhaltsabfragen ignorieren vorhandene CMS-Sitzungen; Entwürfe können ausschließlich mit einer authentifizierten CMS-Vorschau unter /cms/preview/ID und explizitem API-Preview-Parameter betrachtet werden. Ein früheres Cookie mit Path=/ wird beim nächsten CMS-Aufruf entfernt. Der Cookie-Abschnitt der deutschen Datenschutzerklärung wurde nach verifizierter Datenbanksicherung angepasst. Die Aussage gilt für diese lokale Anwendung; ein späteres Hosting muss zusätzlich auf eigene Cookies geprüft werden.

## Öffentliche Gestaltung (1. November 2026)

Die öffentliche Webseite verwendet ein dunkles, zurückhaltendes Portfolio-Layout nach dem Stitch-Entwurf. Der rote Punkt im Logo, eigene Fotos und vorhandene Projekttexte bleiben erhalten. Die Startseite nennt ausschließlich Architekturleistungen in LP 1–4 (Grundlagenermittlung, Vorplanung, Entwurfsplanung, Genehmigungsplanung). Projektkarten werden aus den veröffentlichten CMS-Sektionen erzeugt; Texte und Slideshows stammen weiterhin aus der Datenbank. Bestehende Seitenadressen, cookiearme öffentliche Verarbeitung und CMS-Funktionen bleiben angebunden. Technische Koordinaten, erfundene Referenzen und unbelegte Leistungsversprechen des Entwurfs wurden nicht übernommen.

## Formatierter Texteditor

Seiteninhalte und Akkordeontexte lassen sich direkt formatiert bearbeiten: Überschriften, Fett/Kursiv, Listen, Links und Rückgängig/Wiederholen. Die HTML-Schaltfläche öffnet weiterhin den Quelltext. Aus Word eingefügte Inhalte werden bereinigt; eingefügte externe Bilder werden nicht übernommen (dafür dient der Slideshow-Upload). Slideshows werden im Texteditor als geschützte Platzhalter dargestellt und bleiben auch beim vollständigen Ersetzen des Textes erhalten. Die bestehende Live-Vorschau und das Speichern über die PHP-API bleiben angebunden. Es wird kein externer Editor-Dienst geladen. Die native Formatierung wurde im integrierten Chromium-Browser geprüft. Die synthetische Testseite liegt unter frontend/tests und wird nicht in den normalen Vite-Build aufgenommen.

Das Feld Seitenbild (16:9) unterstützt ebenfalls direkten Upload, Austausch, Vorschau und Entfernen. Es nutzt dieselbe geschützte Upload-API wie die Slideshow; die Zuordnung zur Seite wird erst beim Speichern übernommen. Während eines Uploads ist Speichern gesperrt. Die öffentliche Webseite zeigt das gespeicherte Seitenbild vor dem Inhalt an.

Das Hintergrundbild unterstützt ebenfalls Upload, Austausch, Entfernen und eine Vorschau mit Lesefilter. Die Zuordnung wird mit der Seite gespeichert; die öffentliche Seite zeigt den Hintergrund hinter dem Seiteninhalt mit einem dunklen Filter. Die hochgeladene Datei wird beim Entfernen der Zuordnung nicht gelöscht.

Für Seitenbilder ist Originalformat ohne Beschnitt der Standard. Im CMS stehen zusätzlich 16:9 und Bild neben Text mit Position links/rechts zur Auswahl. Die Einstellung image_layout wird je Seite gespeichert; Schema-Migration 010 ergänzt dafür eine eigene validierte Spalte. Vorschau und öffentliche Darstellung nutzen dieselbe Layout-Komponente. Auf Smartphones werden Bild und Text untereinander angeordnet.

## Deployment vorbereiten

Siehe [DomainFactory-Anleitung](docs/DEPLOYMENT.md). Die Paketierung erstellt geprüfte Archive ohne Konfiguration, Datenbank und Uploads. GitHub-Ziel: https://github.com/wfreibe/cms_freibe. Der automatische GitHub-Workflow veröffentlicht nach erfolgreichen Prüfungen von master; Details stehen in docs/GITHUB_DEPLOYMENT.md.

## Modulare Inhaltsbausteine (5. November 2026)

Seiten können unter „Inhalt bearbeiten“ aus sortierbaren Bausteinen aufgebaut werden: Text, Bild mit Text und erweiterten Bildoptionen, Slideshow, Akkordeon, YouTube mit Freigabe, Audio vom eigenen Webspace sowie Link/Schaltfläche. Bestehende Seiten bleiben als verschiebbarer und wiederherstellbarer Baustein erhalten. Vorschau und Webseite verwenden dieselbe Darstellung. Hinzu kommen eigene Seitenadressen, wählbare Menüzuordnung und Hintergrundfarben mit Kontrastanpassung. Details zu Bedienung, Datenmodell, Migrationen 011–013 und Tests: [docs/INHALTSBAUSTEINE.md](docs/INHALTSBAUSTEINE.md). Schema-Migrationen erhalten bestehende Inhalte; Laufzeitdaten sind nicht Bestandteil des Deployment-Pakets.
