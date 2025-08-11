# Requirements Document

## Introduction

Das Ziel ist die Entwicklung eines schlanken, webbasierten Ticketsystems für die interne IT-Abteilung. Das System soll eine kosteneffiziente Eigenlösung darstellen, die grundlegende Funktionen zur Erfassung, Bearbeitung und Nachverfolgung von Support-Anfragen bereitstellt. Die Anwendung wird als responsive Webanwendung mit React, Material UI und Node.js entwickelt, wobei Wartbarkeit, sauberer Code und Skalierbarkeit im Vordergrund stehen.

## Requirements

### Requirement 1

**User Story:** Als Mitarbeiter möchte ich Support-Tickets erstellen können, damit ich technische Probleme oder Anfragen an die IT-Abteilung weiterleiten kann.

#### Acceptance Criteria

1. WHEN ein Mitarbeiter das Ticketsystem aufruft THEN soll das System eine Eingabemaske zur Ticket-Erstellung anzeigen
2. WHEN ein Mitarbeiter ein neues Ticket erstellt THEN soll das System Titel, Beschreibung und Priorität erfassen
3. WHEN ein Ticket erfolgreich erstellt wurde THEN soll das System eine eindeutige Ticket-ID generieren und dem Ersteller anzeigen
4. WHEN ein Ticket erstellt wird THEN soll das System automatisch den Status auf "offen" setzen

### Requirement 2

**User Story:** Als IT-Mitarbeiter möchte ich Tickets an Bearbeiter zuweisen können, damit eine klare Verantwortlichkeit für die Bearbeitung gewährleistet ist.

#### Acceptance Criteria

1. WHEN ein IT-Mitarbeiter ein Ticket öffnet THEN soll das System eine Liste verfügbarer Bearbeiter anzeigen
2. WHEN ein Ticket einem Bearbeiter zugewiesen wird THEN soll das System die Zuweisung speichern und anzeigen
3. WHEN ein Ticket zugewiesen wird THEN soll das System den zugewiesenen Bearbeiter automatisch benachrichtigen
4. IF ein Ticket bereits zugewiesen ist THEN soll das System die Möglichkeit bieten, die Zuweisung zu ändern

### Requirement 3

**User Story:** Als IT-Mitarbeiter möchte ich den Status von Tickets verwalten können, damit der Bearbeitungsfortschritt transparent nachvollziehbar ist.

#### Acceptance Criteria

1. WHEN ein Bearbeiter ein Ticket öffnet THEN soll das System die Statusoptionen "offen", "in Bearbeitung" und "geschlossen" anzeigen
2. WHEN der Status eines Tickets geändert wird THEN soll das System die Änderung mit Zeitstempel speichern
3. WHEN ein Ticket auf "in Bearbeitung" gesetzt wird THEN soll das System den Ticket-Ersteller automatisch benachrichtigen
4. WHEN ein Ticket auf "geschlossen" gesetzt wird THEN soll das System den Ticket-Ersteller automatisch benachrichtigen

### Requirement 4

**User Story:** Als Benutzer möchte ich Kommentare zu Tickets hinzufügen können, damit Rückmeldungen und der Bearbeitungsverlauf dokumentiert werden.

#### Acceptance Criteria

1. WHEN ein Benutzer ein Ticket öffnet THEN soll das System alle vorhandenen Kommentare chronologisch anzeigen
2. WHEN ein Benutzer einen Kommentar hinzufügt THEN soll das System den Kommentar mit Autor und Zeitstempel speichern
3. WHEN ein neuer Kommentar hinzugefügt wird THEN soll das System alle beteiligten Personen automatisch benachrichtigen
4. WHEN ein Kommentar erstellt wird THEN soll das System die Eingabe validieren und leere Kommentare ablehnen

### Requirement 5

**User Story:** Als Benutzer möchte ich automatische Benachrichtigungen erhalten, damit ich über wichtige Änderungen an meinen Tickets informiert bleibe.

#### Acceptance Criteria

1. WHEN sich der Status eines Tickets ändert THEN soll das System den Ticket-Ersteller und zugewiesenen Bearbeiter benachrichtigen
2. WHEN ein neuer Kommentar hinzugefügt wird THEN soll das System alle beteiligten Personen benachrichtigen
3. WHEN ein Ticket zugewiesen wird THEN soll das System den neuen Bearbeiter benachrichtigen
4. IF ein Benutzer Benachrichtigungen deaktiviert hat THEN soll das System diese Präferenz respektieren

### Requirement 6

**User Story:** Als Benutzer möchte ich eine responsive Webanwendung nutzen, damit ich das Ticketsystem auf verschiedenen Geräten verwenden kann.

#### Acceptance Criteria

1. WHEN ein Benutzer das System auf einem Desktop-Computer aufruft THEN soll die Anwendung vollständig funktionsfähig sein
2. WHEN ein Benutzer das System auf einem Tablet aufruft THEN soll die Benutzeroberfläche entsprechend angepasst werden
3. WHEN ein Benutzer das System auf einem Smartphone aufruft THEN sollen alle Kernfunktionen verfügbar und bedienbar sein
4. WHEN die Bildschirmgröße geändert wird THEN soll sich das Layout automatisch anpassen

### Requirement 7

**User Story:** Als Administrator möchte ich eine saubere, wartbare Codebasis haben, damit das System langfristig weiterentwickelt und gepflegt werden kann.

#### Acceptance Criteria

1. WHEN Code geschrieben wird THEN soll er den etablierten Coding-Standards entsprechen
2. WHEN neue Features hinzugefügt werden THEN sollen entsprechende Tests implementiert werden
3. WHEN das System erweitert wird THEN soll die modulare Architektur eine einfache Skalierung ermöglichen
4. IF Änderungen vorgenommen werden THEN sollen diese durch klare Dokumentation nachvollziehbar sein