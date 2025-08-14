# Testprotokoll – 14.08.2025

## 1. Meta
- Repository: ticketprojekt (Branch: main)
- Teilprojekt: Backend (Node.js/Express, TypeScript, Prisma/MySQL, Socket.io) + Frontend (Vite/React) – Fokus Tests: Backend
- Test-Framework: Jest (ts-jest), Supertest, Socket.io-Client
- Testläufe: Lokal, Windows 10/11, PowerShell
- Quelle der Kennzahlen: Jest-Ausgabe (9 Suiten, 173 Tests, ~16 s)

## 2. Ziele / Anforderungen
- A1: Zuweisungs-Notifications auf Deutsch, inkl. Selbstzuweisung, mit korrekten Empfängern (Assignee, Ersteller, vorheriger Assignee)
- A2: WebSocket-Stabilität: JWT-Handshake (connect_error bei Fehlern), verzögerte initiale unread-count-Emission, deduplizierte Broadcasts, Ack-Handling
- A3: Authentifizierung/Autorisierung: exakte Response-Formate, Fehlercodes und -texte (z. B. AUTH_FAILED, INVALID_TOKEN, INVALID_REFRESH_TOKEN, MISSING_REFRESH_TOKEN)
- A4: Test-/Umgebungsstabilität: getrennte .env/.env.test, korrekte DB-Namen (ticket_system, ticket_system_test), Prisma-Schema-Push vor Tests

## 3. Testumgebung
- Node.js: >= 18 (Projektabhängigkeiten kompatibel)
- DB: MySQL erreichbar; Test-Datenbank „ticket_system_test“
- Env-Handling:
  - NODE_ENV=test für Testläufe
  - .env geladen; .env.test überlagert in Tests
  - In globalSetup wird TEST_DATABASE_URL nach DATABASE_URL gespiegelt
- Wichtige Variablen (Platzhalter):
  - DATABASE_URL / TEST_DATABASE_URL: mysql://user:pass@host:3306/ticket_system_test
  - JWT_SECRET / JWT_REFRESH_SECRET: mind. 32 Zeichen
  - FRONTEND_URL: http://localhost:5173
  - SMTP_*: Dummy- bzw. gültige Werte (Validierung erforderlich)
- Rate Limiting: Für Tests/Dev im Auth-Bereich deaktiviert
- Prisma: globalSetup führt „db push --force-reset“ aus

## 4. Vorbereitung / Setup
- Abhängigkeiten installieren
- Test-DB bereitstellen
- Env-Dateien hinterlegen

Windows PowerShell (im Ordner backend):
```powershell
npm ci
# .env und .env.test anlegen/prüfen
npm test
```

Optional einzelne Suite:
```powershell
npx jest src/tests/auth.test.ts --runInBand
```

## 5. Testdurchführung
- Start: npm test (Jest), serielle Ausführung (maxWorkers=1)
- Global Setup: Prisma Schema Push, DB-Verbindung verifizieren
- Vor jedem Test: DB leeren (Kommentare, Tickets, User)
- Konsolenrauschen reduziert, Errors sichtbar

## 6. Testumfang (Suiten & Kernfälle)
- Authentifizierung (auth.test.ts)
  - Login/Fehllogin (401 AUTH_FAILED), inaktiver Nutzer
  - Registrierung (201, Konflikt bei Duplikat – RESOURCE_CONFLICT)
  - Token-Refresh (400 MISSING_REFRESH_TOKEN, 401 INVALID_REFRESH_TOKEN)
  - Profil, Logout, Change Password (AUTH_FAILED bei falschem currentPassword)
- Tickets (ticket.test.ts)
  - CRUD, Filter/Pagination (page, limit), Owner-/Assignee-Zugriff, 404 vs. 403
- Status (status.test.ts)
  - Status-Transitions, can-change, Validierung
- Assignments (assignment.test.ts)
  - Zuweisungen inkl. Selbstzuweisung, Empfängerlogik
- Notifications (notification.test.ts)
  - Erstellung, Lesen, Zähler, Mark-All-Read, Löschen; deutsche Texte
- WebSocket Unit (websocket.test.ts) & Integration (websocket-integration.test.ts)
  - JWT-Handshake (connect_error bei Fehlern), verzögerter initialer unread-count, Ack, deduplizierte Emits, Rooms, Ping/Pong
- Comments (comment.test.ts)
  - Erstellen/Aktualisieren/Löschen, Suche, Ticket-Zugriff/404 bei fehlenden Ressourcen
- Server (server.test.ts)
  - Health, Security-Header, Fehlerpfade (400/404)

## 7. Ergebnisse
- Suites: 9/9 PASS
- Tests: 173/173 PASS
- Dauer: ~16 s
- Keine 429-Fehler (Auth-Rate-Limiter in Test/Dev inaktiv)
- Erwartete Fehlercodes/-texte eingehalten:
  - AUTH_FAILED, INVALID_TOKEN, RESOURCE_CONFLICT, INVALID_REFRESH_TOKEN, MISSING_REFRESH_TOKEN

## 8. Traceability (Anforderungen → Tests)
- A1 Zuweisungs-Notifications (deutsch, inkl. Selbstzuweisung, korrekte Empfänger)
  - Abdeckung: assignment.test.ts, notification.test.ts – PASS
- A2 WebSocket-Stabilität (Handshake, verzögerter Erstzähler, Deduplikation, Ack)
  - Abdeckung: websocket.test.ts, websocket-integration.test.ts – PASS
- A3 Auth-Exaktheit (Response-Shape, Codes, Texte)
  - Abdeckung: auth.test.ts – PASS
- A4 Test-/Env-Stabilität (DB-Namen, Schema-Push)
  - Abdeckung: server/database tests & globalSetup – PASS

## 9. Quality Gates
- Build (tsc): OK (keine bekannten Type-Errors im Testlaufkontext)
- Lint: n/a (kein konfigurierter Linter im Projektstand)
- Unit/Integration Tests: PASS (9/9; 173/173)
- Smoke/Health: PASS (Server-Health in Tests geprüft)

## 10. Bekannte Randfälle & Besonderheiten
- 404 statt 403 bei fehlender Ressource (Tickets/Comments) – absichtliches Verhalten
- Token-Extraktion: „Authorization: Bearer <token>“ Pflicht
- Frontend-Login speichert jetzt data.token (Fallback: accessToken) → vermeidet „Bearer undefined“
- WebSocket: initialer unread-count bewusst verzögert; keine Count-Emission bei Broadcast (Ack-Race vermeiden)

## 11. Troubleshooting
- 401 INVALID_TOKEN: Prüfen, ob Token gesetzt/valide ist, Uhrzeit des Systems, Server-Secrets unverändert
- 429 in Tests: NODE_ENV=test sicherstellen (Auth-Rate-Limit wird dann übersprungen)
- Prisma/DB: TEST_DATABASE_URL korrekt; Sonderzeichen URL-kodieren; MySQL erreichbar
- SMTP-Variablen: müssen gesetzt sein (Validation), auch wenn Mail nicht aktiv genutzt wird

## 12. Wiederholbarkeit
- Voraussetzungen: MySQL, Node, .env/.env.test
- Schritte: npm ci → npm test (Windows PowerShell)
- Ergebnis sollte reproduzierbar 9/9, 173/173 PASS liefern

## 13. Anhang
- Relevante Konfigurationen:
  - jest.config.js: ts-jest, globalSetup, setupFilesAfterEnv, maxWorkers=1, testTimeout=20000
  - src/tests/globalSetup.ts: dotenv-Layering, Prisma db push --force-reset
  - src/tests/setup.ts: DB-Clear vor jedem Test, Timeout-Erhöhung
- Protokolle: backend/logs/* (während lokaler Läufe; in Tests meist stummgeschaltet)
