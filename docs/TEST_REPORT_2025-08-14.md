# Testdokumentation – 14.08.2025

## Überblick
- Projekt: Ticket-System
  - Backend: Node.js/Express (TypeScript), Prisma (MySQL), Socket.io
  - Tests: Jest (ts-jest), Supertest
- Test-Runner: Jest seriell (maxWorkers=1), verlängertes Timeout
- DB (Test): ticket_system_test – Schema-Sync via globalSetup (Prisma db push)
- Ergebnis: 9 Test-Suiten, 173 Tests, alle BESTANDEN (~16 s)

## Testumfang (Suiten)
- Authentifizierung
  - Login, Registrierung, Token-Refresh, Profil, Passwort ändern, Logout
- Tickets
  - CRUD, Filter/Pagination, Berechtigungen (Ersteller/Assignee/Agent/Admin)
- Status
  - Status-Transitions, Abfragen, Validierungen
- Assignments
  - Zuweisungen inkl. Selbstzuweisung, Empfängerlogik
- Notifications
  - Erstellung, Lesen, Zähler, „Alle gelesen“, Löschen; deutsche Texte
- WebSocket (Unit + Integration)
  - JWT-Handshake (connect_error bei Fehlern), initiale unread-count-Emission (verzögert), Ack/Retry, Rooms, Ping/Pong
- Comments
  - Erstellen/Aktualisieren/Löschen, Suche, Ticket-Zugriff
- Server/Health/Fehlerbehandlung
  - Security-Header, 404/400, JSON-Parsing

## Testumgebung
- NODE_ENV=test; .env und .env.test werden geladen (letztere überlagert für Tests)
- Auth-Rate-Limiter in Test/Dev deaktiviert (keine 429-Flakes)
- JWT: getrennte Secrets und Laufzeiten für Access/Refresh
- Prisma: globalSetup führt „db push --force-reset“ vor dem Testlauf aus

## Ausführung (optional)
Windows PowerShell im Ordner backend:

```powershell
npm ci
npm test
```

Einzelne Suite (Beispiel):

```powershell
npx jest src/tests/auth.test.ts --runInBand
```

## Ergebnisse (Kurzprotokoll)
- Suites: 9/9 PASS
- Tests: 173/173 PASS
- Dauer: ~16 Sekunden
- Erwartete Fehlercodes/-meldungen verifiziert:
  - AUTH_FAILED, INVALID_TOKEN, RESOURCE_CONFLICT, INVALID_REFRESH_TOKEN, MISSING_REFRESH_TOKEN

## Anforderungen-Abdeckung
- Zuweisungs-Notifications (deutsch, inkl. Selbstzuweisung) und korrekte Empfänger: abgedeckt (PASS)
- WebSocket-Stabilität (verzögerter Erstzähler, connect_error, deduplizierte Emits): abgedeckt (PASS)
- Auth-Flows (Antwortformate, Codes, Texte): abgedeckt (PASS)
- DB/Umgebungssetup stabil (Schema-Push, isolierte Test-DB): abgedeckt (PASS)

## Geprüfte Randfälle
- Auth:
  - Falsche E-Mail/Passwort, inaktiver User → 401 AUTH_FAILED
  - Fehlender/ungültiger Access-Token → 401 INVALID_TOKEN
  - Refresh: fehlend → 400 MISSING_REFRESH_TOKEN; ungültig/abgelaufen → 401 INVALID_REFRESH_TOKEN
- Notifications:
  - Initiale unread-count-Emission (verzögert), Ack-Handling, Pagination, „Alle gelesen“
- Tickets/Kommentare:
  - 404 bei fehlender Ressource (statt 403), Owner-/Assignee-/Rollenprüfung

## Troubleshooting-Hinweise
- 429 in Tests: sicherstellen, dass NODE_ENV=test gesetzt ist (Auth-Rate-Limit dann deaktiviert)
- Prisma/DB: MySQL erreichbar, TEST_DATABASE_URL korrekt; Sonderzeichen in Passwörtern URL-kodieren
- JWT: Secrets gesetzt; nach Server-Neustart mit neuen Secrets frisch einloggen

## Artefakte
- Coverage optional: `npx jest --coverage` (Ausgabe: backend/coverage)
