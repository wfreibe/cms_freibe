# Automatisches GitHub-Deployment

Workflow: .github/workflows/deploy.yml.

- Push auf codex/local-cms, development oder acceptance: Tests und Deployment-Artefakt.
- Pull Requests: Tests und Build, kein Serverzugriff.
- Push auf master oder manueller Workflow-Start auf master: nach erfolgreicher Prüfung Deployment auf freiberger.design.
- Produktion verwendet das GitHub Environment production; nur master darf dessen Secrets verwenden.
- Für development und acceptance sind noch keine eigenen Hostingziele eingerichtet. Sie greifen nicht auf Produktionsdaten zu.

## Einmalige Einrichtung

Ein eigener Ed25519-Schlüssel wurde lokal im ignorierten tmp-Bereich erzeugt und verschlüsselt als Environment-Secret DEPLOY_SSH_KEY hinterlegt. Nur dessen öffentlicher Schlüssel wird in die autorisierten Schlüssel des SSH-Kontos eingetragen. DEPLOY_KNOWN_HOSTS enthält den bereits lokal verifizierten Hostschlüssel. Bei einem Hostschlüsselwechsel bricht das Deployment ab; keinen unbekannten Schlüssel automatisch übernehmen.

Nicht geheime Environment-Variablen: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH und DEPLOY_PHP. DEPLOY_PHP muss ein auf dem Zielserver tatsächlich geprüfter absoluter PHP-Pfad ab Version 8.2 mit PDO_SQLite, mbstring, GD und ZIP sein. Der Standardbefehl php war dort PHP 7.4 und wird nicht verwendet.

Die Serverfreigabe des öffentlichen Schlüssels und der passende PHP-Pfad müssen vor dem ersten Produktionslauf bestätigt sein. Keine Passwörter in Chat, Quellcode oder Workflow eintragen.

## Daten und Sicherungen

Das Deployment prüft zuerst die bestehende Installation und die PHP-Version. Es legt das geprüfte ZIP unter .deploy/packages/ ab, prüft SHA-256 und ZIP-Pfade und verwendet eine Serversperre gegen parallele Updates.

Vor dem Schreiben von Programmdateien werden SQLite mit der vorhandenen Backup-CLI, Uploads und die Programmdateien gesichert. Backups liegen im privaten server/backups/ und .deploy/history/RELEASE/. Die neue Programmversion bleibt zusätzlich unter .deploy/releases/RELEASE/ erhalten.

Rsync ersetzt ausschließlich Paketdateien und verwendet ausdrücklich keinen Löschabgleich. server/data/, server/backups/ und die aktive server/config/cms_config.php werden nicht übertragen oder ersetzt. Neue Datenbanken, Seed-Inhalte, Admin-Zugänge oder Passwörter werden durch den Workflow nicht angelegt. Alte Programmeinträge und Backups werden nicht automatisch bereinigt.

Nach dem Kopieren laufen Schema-Migrationen, die lokale Readiness-Prüfung und der HTTPS-Test der API. Zusätzlich wird geprüft, dass die öffentliche Startseite auf das neue JavaScript-Artefakt verweist.

## Fehler und Wiederherstellung

Bei einem Fehler wird der Workflow rot; Secrets werden nicht ausgegeben. Das Update von Programmdateien erfolgt dateiweise, nicht als atomarer Wechsel der gesamten Webseite. Während des Kopierens können daher kurzzeitig unterschiedliche Programmstände zusammentreffen. Migrationen sind nicht automatisch rückgängig zu machen.

Es gibt keinen automatischen Datenbank-Rollback: Dieser könnte zwischenzeitlich gespeicherte CMS-Inhalte verlieren. Bei einem Fehler die Sicherungen und den letzten erfolgreichen Lauf prüfen und Programmversion sowie erforderlichenfalls passende Daten gezielt wiederherstellen. Bestehende Dateien werden dabei nicht ungefragt gelöscht.

Die zusätzlichen Sicherungen benötigen Speicherplatz. Eine Aufbewahrungsregel wird erst nach ausdrücklicher Festlegung eingerichtet.
