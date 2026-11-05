# Modulare Inhaltsbausteine

Stand: 5. November 2026. Diese Erweiterung ist zunächst ausschließlich lokal umgesetzt. Es wurde kein Git-Push und kein Deployment ausgeführt.

## Bedienung

Im CMS eine Seite beziehungsweise einen Menüpunkt auswählen und „Inhalt bearbeiten“ öffnen. Unter „Inhaltsbausteine“ den Typ wählen und „Inhaltsbaustein hinzufügen“ anklicken.

Jeder Baustein besitzt passende Eingabefelder. Die Reihenfolge lässt sich am Griff ziehen oder mit den Pfeilen ändern. „Ausblenden“ nimmt ihn aus der öffentlichen Darstellung. „Entfernen“ entfernt ihn aus der Zusammenstellung. Erst „Speichern“ übernimmt Änderungen für diese Seite und Bearbeitungssprache. „Abbrechen“ verwirft ungespeicherte Eingaben.

Die Vorschau verwendet dieselbe Komponente wie die öffentliche Webseite und berücksichtigt aktuelle Inhalte, Reihenfolge und Sichtbarkeit.

| Typ | Möglichkeiten |
|---|---|
| Text | Optionale Überschrift und formatierter Text mit WYSIWYG-/HTML-Editor |
| Bild mit Text | Bildupload, Alternativtext, Unterschrift und Begleittext; Original, 16:9, 3:2, 4:3, 1:1 oder 3:4; über/neben Text, Ausrichtung, Breite und Fokus |
| Slideshow | Bilder hochladen/austauschen, Titel und Unterschriften, Sortierung, Standzeit und Vollbild; ohne Zoom |
| Akkordeon | Ergänzbare Themen mit formatierten Texten, Sortierung über Pfeile und aufklappbare Darstellung |
| YouTube-Video | Video-ID oder YouTube-Link, optional eigenes Vorschaubild und Beschreibung; Laden erst nach Klick |
| Audio | Native Steuerung für bereits auf dem eigenen Webspace vorhandene MP3-, OGG-, WAV- oder M4A-Dateien |
| Link / Schaltfläche | Beschriftung und internes Ziel oder HTTPS-Adresse |
| Bestehender Seiteninhalt | Bisherige HTML-Inhalte, Seitenbild, Hintergrund und Akkordeons mit ihren bisherigen Bearbeitungsfunktionen |

Die vorhandene Upload-API unterstützt Bilder. Die Audio-Komponente bietet zunächst einen Pfad zur vorhandenen Datei; ein Audio-Dateiupload wurde nicht hinzugefügt.

## Erhalt bestehender Inhalte

Migration `011_content_blocks.sql` ergänzt ausschließlich die nullable Spalte `sections.content_blocks`. Sie verändert keine bisherigen Text-, Bild- oder Akkordeonfelder.

Ein Datenbankwert `NULL` wird beim Lesen als ein sichtbarer Baustein „Bestehender Seiteninhalt“ interpretiert. Unveränderte Bestandsseiten behalten damit ihre ursprüngliche Darstellung.

Die vorhandenen Bearbeitungsfelder sind in diesem Baustein enthalten. Er kann zwischen neuen Bausteinen einsortiert werden. Entfernen oder Ausblenden dieses Bausteins löscht die Originalfelder nicht aus der Datenbank. Über den Typ „Bestehender Seiteninhalt“ lässt er sich wieder ergänzen oder wieder einblenden.

Eine ausdrücklich gespeicherte leere Liste `[]` bleibt leer. Authentifizierte Editorabfragen enthalten die Originalfelder weiterhin; öffentliche Abfragen geben diese nur aus, wenn der bestehende Inhaltsbaustein sichtbar eingebunden ist.

Vor der lokalen Migration wurde eine verifizierte Datenbanksicherung erstellt. Prüfsummen vergleichen die bisherigen Seiten- und Akkordeonfelder nach Abschluss erneut mit ihrem vorherigen Stand.

## Übernommene Muster

Die Referenzprojekte wurden ausschließlich gelesen und nicht verändert.

- `cms_sfreibe`: erweiterte Bildoptionen aus SectionImageOptions / SectionMediaContent und das vorhandene Akkordeon-/Texteditor-Muster.
- `freiberger-music`: YouTube-Freigabefläche aus YouTubeFacade, Normalisierung der Video-IDs aus lib/YouTube.php, Audio-Muster aus playerStore und Linkelemente aus BookLinks.
- `freiberger_design`: vorhandener Slideshow-Editor, Bild-Upload, Sanitizer und CMS-Anmeldung werden weiterverwendet.

Musikspezifische Kataloge, Künstler-, Buch- oder Kartenansichten und externe Übersetzungsdienste wurden nicht übernommen. Die Muster wurden an die bestehende Preact-/PHP-Anwendung angepasst. Es wurden keine zusätzlichen Bibliotheken installiert.

## Datenmodell und API

Die bestehenden Seiten-Endpunkte lesen und speichern zusätzlich `content_blocks` als JSON-Liste. Die Listenreihenfolge ist die Darstellungsreihenfolge. Die Daten liegen pro Seite und Sprache.

~~~json
{
  "id": "eindeutige-id",
  "type": "text",
  "enabled": true,
  "data": {
    "title": "Optionale Überschrift",
    "html": "<p>Formatierter Text</p>"
  }
}
~~~

- Höchstens 50 Bausteine je Seite und Sprache; höchstens ein Baustein für den bisherigen Seiteninhalt.
- Eindeutige IDs, geprüfte Typen, Sichtbarkeitswerte und typabhängige Feld-/Mengenlimits.
- Höchstens 450.000 Bytes für die eingehende Bausteinliste; die vorhandene allgemeine API-Größenbegrenzung bleibt bestehen.
- HTML wird durch HTMLPurifier im Backend und DOMPurify bei der Darstellung bereinigt.
- Anmeldung und CSRF-Prüfung schützen Schreibzugriffe.
- Teilaktualisierungen ohne `content_blocks` erhalten die Liste.
- Ausgeblendete Bausteine erscheinen nicht in öffentlichen API-Antworten. Authentifizierte CMS-Abfragen können sie weiterhin bearbeiten.

Die bisherige content-Spalte und section_accordions werden nicht automatisch in einzelne neue Bausteine zerlegt. Das vermeidet einen verlustbehafteten Umbau komplexer Bestandsseiten.

## Medien und YouTube

Neue Bild-/Vorschaubild- und Audiofelder akzeptieren lokale Pfade. Die Bildupload-API bleibt bei JPEG, PNG und WebP mit maximal 8 MiB und 12 Millionen Pixeln.

YouTube-Links werden zu geprüften elfstelligen Video-IDs normalisiert. Beliebige iframe-Adressen oder Embed-HTML sind nicht erlaubt. Vor Aktivierung werden keine YouTube-Thumbnails oder YouTube-iframes eingebunden. Ein optionales Vorschaubild kommt vom eigenen Webspace.

Nach „YouTube-Video laden“ wird ein Player von www.youtube-nocookie.com eingebunden. Die Freigabefläche erläutert die Datenübertragung und mögliche Speichertechniken. „Video schließen“ entfernt den Player. Die Freigabe wird nicht dauerhaft im Browser gespeichert.

## Dateien und Prüfungen

| Datei | Aufgabe |
|---|---|
| `lib/ContentBlocks.php` | Typprüfung, Normalisierung, HTML-Bereinigung und öffentliche Rückgabe |
| `migrations/011_content_blocks.sql` | Additive Schema-Erweiterung |
| `frontend/src/utils/contentBlocks.js` | Typkatalog, neue Bausteine, Sortierung und sichere URL-Verarbeitung |
| `frontend/src/components/ContentBlocksEditor.jsx` | Modularer Editor |
| `frontend/src/components/ContentBlocks.jsx` | Gemeinsame öffentliche Darstellung und Live-Vorschau |
| `frontend/src/components/SectionImageOptions.jsx` | Erweiterte Bildoptionen |
| `frontend/src/styles/content-blocks.css` | Responsive Darstellung und Editor-Stile |
| `tests/test_content_blocks.js` | Isolierte API-, Sicherheits- und Migrationstests |
| `tests/test_content_block_utils.js` | Frontend-/Backend-Vertrag und URL-Verarbeitung |
| `frontend/tests/content-blocks.html` | Lokaler Browser-Test mit synthetischen Daten und dem tatsächlichen CMS-Dialog |

Die Testseite speichert Eingaben nicht in der Inhaltsdatenbank und ist kein Bestandteil des normalen Vite-Produktionsbuilds.

Automatisch geprüft werden Migrationserhalt, Anmeldung/CSRF, typabhängige Speicherung, HTML-Bereinigung, ungültige URLs, öffentliche Sichtbarkeit, Reihenfolge, Teilaktualisierungen, Entfernen/Wiederherstellen und neue Seiten.

Im Browser wurden zusätzlich Live-Texte und Vorschau, Bildformate, Akkordeons, Slideshow-Unterschriften und Sortierung, neue Links, Ausblenden, Ziehen ganzer Bausteine, YouTube-Aktivierung/Schließen und eine schmale Darstellung geprüft.

Der produktive CMS-Zugang und die Referenzprojekte wurden nicht verändert. Für ein späteres Deployment muss die neue Migration mit übertragen und ausgeführt werden.

## Lokale dynamische Hauptnavigation

Die öffentliche Hauptnavigation übernimmt veröffentlichte Seiten mit aktivierter Einstellung „In Hauptnavigation anzeigen“. Menünamen und Reihenfolge stammen aus nav_label und sort_order; gleiche Sortierwerte behalten die Reihenfolge der API-Antwort. Bekannte Seiten behalten zunächst ihre historischen URLs. Neue Seiten erhalten beim Speichern einen eigenen URL-Namen; /section/ID bleibt als kompatible Adresse erreichbar.

Projektseiten werden unter „Projekte“ gebündelt. Die Gruppe steht an der Position des ersten sichtbaren Projekts; ihre Unterseiten werden ebenfalls nach den CMS-Sortierwerten geordnet. Die Projektübersicht wird angeboten, wenn die Startseite im Menü enthalten ist. Die Kontakt-Schaltfläche im Header erscheint nur bei einem sichtbaren veröffentlichten Kontakt-Menüpunkt. Die festen Informationslinks im Footer sind davon unabhängig.

Ein aus der Navigation ausgeblendeter veröffentlichter Inhalt bleibt über seine direkte Adresse erreichbar. Entwürfe werden nicht angeboten. Nach CMS-Änderungen eine bereits geöffnete öffentliche Seite neu laden. Das Deployment erfolgt über den regulären GitHub-Workflow.

## Eigene Seitenadressen

Beim Anlegen und Bearbeiten steht das optionale Feld „URL-Name“ zur Verfügung. Es ist unabhängig von Titel, Menüname und interner Seiten-ID. Die angezeigte Seitenadresse aktualisiert sich vor dem Speichern.

- Leer beim ersten Speichern: Der Menüname ergibt die Adresse, beispielsweise „Müller & Söhne“ → /mueller-soehne. Umlaute werden zu ae/oe/ue, ß zu ss, Leerzeichen und Sonderzeichen zu Bindestrichen.
- Bestehende ursprüngliche Seiten behalten ohne ausdrückliche Änderung ihre Adresse. Bereits angelegte zusätzliche Seiten mit /section/ID erhalten ihren URL-Namen beim nächsten Speichern.
- Nach Vergabe bleibt die Adresse bei späteren Änderungen am Menünamen bestehen. Eine neue Adresse ausdrücklich im URL-Feld eingeben, ohne Domain oder Schrägstrich.
- Vergebene und frühere Adressen sind für andere Seiten gesperrt. Doppelte Namen führen zu einer Fehlermeldung; die gesamte Speicherung wird zurückgerollt. Technische Pfade wie cms und api sind reserviert.
- Alte Adressen und /section/ID werden mit HTTP 301 direkt auf die aktuelle Adresse weitergeleitet. Nicht veröffentlichte oder gelöschte Seiten werden nicht öffentlich aufgelöst. Die Startseite behält /.
- Die Adresse gilt gemeinsam für alle Übersetzungen einer Seiten-ID. Navigation und Projektkarten verwenden die aktuelle Adresse.

Migration 012 ergänzt ausschließlich die separate Tabelle page_urls; vorhandene Inhalte und Seitenadressen werden beim Migrieren nicht umgeschrieben. Die Migration wurde lokal nach Sicherung angewendet. Für ein späteres Deployment sind Migration und aktualisierte Apache-Regeln gemeinsam erforderlich. Lokal übernimmt Vite die Weiterleitungen, auf dem Webspace der PHP-Router hinter .htaccess. Die Veröffentlichung erfolgt über den regulären GitHub-Workflow.

## Symbolaktionen im lokalen Backend

Wiederkehrende Aktionen verwenden gemeinsame SVG-Symbole: Ziehgriff, Pfeile, Auge, Stift, Papierkorb, Bild mit Plus und Bildaustausch. Die CMS-Übersicht und der Texteditor verwenden dieselbe Symbolsprache. Sichtbare Feldnamen, Statusangaben und die Beschriftungen Speichern, Abbrechen und Inhaltsbaustein hinzufügen bleiben erhalten.

Jede Symbolschaltfläche hat einen zugänglichen Namen und eine kurze Erklärung beim Darüberfahren. Bei Tastaturfokus zeigt sie die Erklärung direkt an; Upload-Felder bleiben mit der Tastatur erreichbar. Auf kleinen Bildschirmen sind die Symbolflächen mindestens 44 × 44 Pixel groß. Löschen verwendet eine rote Akzentfarbe; bestehende Bestätigungen und die Speicherung mit der Seite bleiben unverändert. Die mobilen Editor- und Vorschauzeilen wachsen mit dem Inhalt und überlagern sich nicht.

Es werden keine externen Symbolbibliotheken, Schriftarten oder zusätzlichen Netzwerkdienste benötigt. Das Deployment erfolgt über den regulären GitHub-Workflow.

## Hintergrundfarben und Kontrast

Die Hintergrundfarbe des bisherigen Seiteninhalts wird im gemeinsamen Renderer für die Live-Vorschau und die öffentliche Seite übernommen. Sie gehört zum Baustein „Bestehender Seiteninhalt“, unter dem sie auch bearbeitet wird; andere Bausteine erhalten dadurch keine Hintergrundfarbe. „Wie Webseite“ entfernt die eigene Farbfläche. Bestehende Daten werden nicht automatisch geändert.

Für gültige drei- oder sechsstellige HEX-Farben wird eine gut lesbare helle oder dunkle Textfarbe gewählt. Überschriften, Listen, Links und Akkordeons folgen diesem Kontrast. Dunkle Inhaltskarten und Slideshow-Unterschriften behalten ihre eigene Darstellung. Bei einem Hintergrundbild bleibt die dunkle Bildüberlagerung erhalten; das Bild liegt über der gewählten Grundfarbe.

Geprüft werden Speicherung und öffentliche API-Rückgabe mit isolierten Daten, die Palettenfarben sowie 256 Graustufen und die gemeinsame Darstellung mit synthetischen Daten unter frontend/tests/backgrounds.html. Diese lokale Testseite gehört nicht zum Produktionsbuild.

## Übergeordneter Menüpunkt

Beim Anlegen und Bearbeiten steht „Übergeordneter Menüpunkt“ zur Verfügung. Hauptmenü zeigt eine Seite direkt; Projekte ordnet sie der bestehenden Projektübersicht zu. Weitere Seiten im Hauptmenü können als übergeordneter Punkt gewählt werden. Dessen Untermenü enthält zusätzlich einen Link zum eigenen Inhalt, beispielsweise „Leistungen öffnen“.

Die Zuordnung gilt gemeinsam für alle Sprachen. Sichtbarkeit, Veröffentlichung und Reihenfolge gelten weiterhin; die Reihenfolge bestimmt die Position innerhalb des gewählten Menüs. Ein ausgeblendeter oder unveröffentlichter Hauptmenüpunkt verbirgt seine Unterseiten aus der Navigation. Direkte Seitenadressen bleiben unabhängig von der Menüzuordnung erhalten.

Es gibt eine Untermenüebene. Die Startseite bleibt im Hauptmenü. Seiten mit Unterseiten können erst verschoben werden, nachdem ihre Unterseiten neu zugeordnet wurden. Eigene Zuordnung, Kreise, unbekannte Ziele und tiefere Verschachtelungen werden auch im Backend abgewiesen. Beim Löschen eines übergeordneten Punktes bleiben seine Unterseiten erhalten und werden ins Hauptmenü verschoben.

Migration 013 legt die getrennte Tabelle page_navigation an und übernimmt die bisherige Projektgruppierung, ohne die gespeicherten Seiteninhalte zu ändern. Der Deployment-Workflow führt sie nach automatischer Sicherung auf dem Zielsystem aus.

## Aufklappbare und einzeln entfernbare Inhaltsbereiche

Beim Öffnen des Editors sind vorhandene Bausteine geschlossen. Jede Zeile zeigt Typ, Titel und eine kurze Zusammenfassung, beispielsweise Bildanzahl, Themenzahl oder einen Textauszug. Ein Klick auf die Zeile öffnet die Einstellungen. Mehrere Bausteine können unabhängig geöffnet bleiben; Alle aufklappen und Alle zuklappen steuern die gesamte Liste. Neu hinzugefügte Bausteine öffnen sich automatisch.

Die Eingabefelder bleiben beim Zuklappen im DOM, sodass Eingaben und Uploadzustand erhalten bleiben. Reihenfolge, Sichtbarkeit und Entfernen sind immer über die Symbolaktionen erreichbar. Offene Zustände hängen an der Baustein-ID und bleiben beim Sortieren erhalten; sie werden weder als Seiteninhalt noch im Browser dauerhaft gespeichert.

Native Eingabefehler öffnen den betroffenen Baustein und führen den Fokus zum ungültigen Feld. Neue Inline-Fehlermeldungen, etwa zu Video-Adressen oder Uploads, öffnen ihren Baustein ebenfalls. Die öffentliche Darstellung und die gespeicherten Inhaltsdaten werden dadurch nicht verändert. Die Veröffentlichung erfolgt über den regulären GitHub-Deployment-Workflow.

### Einzelbereiche bestehender Seiten

Bestehende Seiten zeigen die Bereiche Seitenbild, Hintergrund, Slideshow, Text und Akkordeons direkt als einzeln minimierte Zeilen. Der gemeinsame Bestandsinhalt muss nicht zuerst aufgeklappt werden. Kontaktdaten erscheinen bei den dafür vorgesehenen Seiten als eigener Bereich. Jeder Bereich öffnet unabhängig; Alle aufklappen und Alle zuklappen schließen diese Bereiche mit ein. Eingabefehler öffnen den konkreten Bereich, beispielsweise Akkordeons.

Die Symbolaktionen im Kopf des Bestandsinhalts gelten weiterhin für diesen gesamten Inhaltsbaustein. Die Einzelbereiche verändern nur die Bearbeitungsoberfläche; HTML, Bildpfade, Galerie und Akkordeons werden unverändert in den bisherigen Feldern gespeichert. Es erfolgt keine automatische Inhaltsaufteilung oder Datenmigration.

### Einzelne Bereiche entfernen

Jeder befüllte Bestandsbereich hat eine eigene Papierkorb-Aktion mit Bestätigung. Seitenbild leert nur image_url; Hintergrund leert Farbe und Hintergrundbild; Akkordeons leeren nur ihre Liste; Kontaktdaten leeren nur die Kontaktfelder. Slideshow entfernt ausschließlich die Galerie-Container aus dem HTML. Text entfernt den übrigen HTML-Inhalt und erhält vorhandene Galerie-Container. Andere Bausteine bleiben unverändert.

Die Änderung bleibt ein Entwurf bis Speichern. Abbrechen im Editor verwirft sie. Geleerte Bereiche bleiben als minimierte Zeilen verfügbar und können neu befüllt werden. Bild- und Audiodateien werden durch diese Aktionen nicht gelöscht. Nach Entfernen oder Abbrechen einer Bestätigung kehrt der Tastaturfokus zur betreffenden Zeile zurück. Prüfungen verwenden synthetische Browserdaten und isolierte API-Datenbanken; bestehende Inhalte werden nicht für Tests gelöscht.

## Gemeinsame Elementliste

Im Editor erscheinen ausschließlich vorhandene Inhaltselemente in einer Liste. Der Sammelblock Bisherige Inhalte und unbenutzte Unterbereiche entfallen. Element hinzufügen hängt ein neues Element unten an und öffnet es. Öffnen, Reihenfolge, Sichtbarkeit und Entfernen funktionieren für übernommene und neu angelegte Elemente gleich. Die Seitengestaltung mit Hintergrundfarbe und Hintergrundbild wird separat als Seiteneinstellung geführt.

Beim Öffnen einer älteren Seite werden deren Elemente zunächst nur im Entwurf übernommen. Erst Speichern legt die neue Bausteinliste ab. Die ursprünglichen Inhaltsfelder und Akkordeon-Daten bleiben als Rückfallebene gespeichert und sind ohne sichtbaren Alt-Baustein nicht Teil der öffentlichen Antwort. Vor der Entwicklung wurde eine verifizierte lokale Datenbanksicherung erstellt; es gibt keine automatische Massenänderung oder neue Schema-Migration.

Verschachtelte Layout-Rahmen werden als bereinigte Platzhalterstruktur in den Elementdaten erhalten. Dadurch bleiben beim unveränderten Speichern die vorhandenen Bild-/Textspalten und Slideshow-Optionen erhalten. Beim Umordnen folgen die Elemente der Listenreihenfolge. Entfernte oder ausgeblendete Elemente werden nicht gerendert; leere Rahmen werden ausgelassen. Die Rahmen dürfen keine Skripte oder unbereinigtes HTML enthalten. Bildvorlagen und Layoutdaten durchlaufen die serverseitige HTML-Bereinigung und werden zusätzlich vor der Darstellung bereinigt.

Prüfung: Alle elf Originalseiten werden im DOM vor und nach Übernahme und PHP-Normalisierung verglichen. Texte und vorhandene Bildbeschreibungen bleiben erhalten; ergänzte fehlende Bildattribute entsprechen der regulären HTML-Bereinigung. Zusätzlich werden leere Seiten, wiederholtes Öffnen, Reihenfolge, einzelnes Entfernen, gespeicherte Layoutdaten sowie private Akkordeon-Themen geprüft. Die Veröffentlichung erfolgt über den regulären GitHub-Deployment-Workflow.

## Reine Seitenübersicht

Die CMS-Seitenübersicht zeigt den gespeicherten Stand als Datenblatt ohne Eingabefeld-Rahmen. Veröffentlichung und Hauptnavigation sind reine Statusangaben und lassen sich ausschließlich im Editor mit der Seite speichern. Inhalt bearbeiten steht als beschriftete Schaltfläche mit Stiftsymbol oben in der Übersicht. Bereichs-ID und Löschaktion stehen unter Weitere Angaben. Die Sprachwahl ist als Anzeigesprache beschriftet.

Die lokale synthetische Testansicht frontend/tests/workspace-overview.html prüft Darstellung und echten Editor-Aufruf ohne echte Seiten zu verändern. Ihre Vorschau verwendet ausdrücklich Beispieldaten. Desktop- und schmale Darstellung wurden geprüft; die Testansicht gehört nicht zum Produktionsbuild.
