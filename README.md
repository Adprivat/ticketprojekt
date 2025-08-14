# IT Support Ticket System

Ein schlankes Ticketsystem für interne IT‑Prozesse. Frontend mit React + Vite + MUI. Backend mit Node/Express + TypeScript + Prisma (MySQL). WebSockets (Socket.io) für Benachrichtigungen.

## Inhaltsverzeichnis
- Features
- Architektur & Ordnerstruktur
- Voraussetzungen
- Quick Start (Windows)
- Umgebungsvariablen
- Datenbank & Prisma
- Nützliche Skripte
- Tests & Protokolle
- WebSocket & Benachrichtigungen
- API Kurzüberblick (Auth)
- Sicherheit
- Troubleshooting
- Deployment

## Features
- Authentifizierung (JWT), Rollen: USER, AGENT, ADMIN
- Tickets: erstellen, bearbeiten, Status ändern, zuweisen/ent‑zuweisen, löschen (ADMIN)
- Kommentare inkl. Live‑Updates via Socket.io
- Dashboard mit Kennzahlen und „Recent Tickets“
- Admin‑Board: Nutzerliste, erstellen, deaktivieren/reaktivieren, löschen, bearbeiten
- Settings: Profil aktualisieren, Passwort ändern
- Sicherheitsmaßnahmen: Helmet, CORS, Joi‑Validation, Rate Limiting

## Architektur & Ordnerstruktur
```
.
├─ backend/                 # Express API (TypeScript, Prisma)
│  ├─ src/
│  │  ├─ controllers/      # HTTP Controller
│  │  ├─ services/         # Business‑Logik
│  │  ├─ database/         # Repositories, Prisma Utils, Seeds
│  │  ├─ middleware/       # Auth, Validation, Security, Errors
│  │  ├─ routes/           # Express Router (auth, tickets, ...)
│  │  ├─ websocket/        # Socket.io Handler + Broadcaster
│  │  └─ server.ts         # App Bootstrap
│  └─ prisma/              # schema.prisma + migrations (tracked)
│
├─ frontend/               # React 18 + Vite + MUI (TypeScript)
│  ├─ src/
│  │  ├─ components/       # UI Komponenten
│  │  ├─ contexts/         # Auth/Socket Context
│  │  ├─ pages/            # Seiten (Dashboard, Tickets, Admin, ...)
│  │  ├─ services/         # API‑Clients (Axios)
│  │  └─ theme/            # MUI Thema
│  └─ vite.config.ts
└─ docs/                   # Testberichte & Protokolle
```

## Voraussetzungen
- Node.js 18+ (empfohlen 20.x)
- npm 9+
- MySQL 8.x (lokal oder Docker)

## Quick Start (Windows)
1) Repository klonen und in Ordner wechseln

2) Backend einrichten
```powershell
cd backend
npm ci
copy .env.example .env
# .env anpassen (siehe Abschnitt Umgebungsvariablen)
npm run db:migrate
npm run db:seed
npm run dev
```

3) Frontend einrichten
```powershell
cd ../frontend
npm ci
copy .env.example .env
# VITE_API_URL auf Backend‑URL setzen (z. B. http://localhost:3001/api)
npm run dev
```

Standard‑Ports: Backend 3001, Frontend 5173

## Umgebungsvariablen
Backend (.env):
- DATABASE_URL=mysql://user:pass@localhost:3306/ticket_system
- JWT_SECRET=... (starkes Secret, min. 32 Zeichen)
- JWT_EXPIRES_IN=24h
- JWT_REFRESH_SECRET=... (starkes Secret, min. 32 Zeichen)
- JWT_REFRESH_EXPIRES_IN=7d
- SMTP_HOST=smtp.example.com
- SMTP_PORT=587
- SMTP_USER=noreply@example.com
- SMTP_PASS=your-smtp-password
- EMAIL_FROM=noreply@example.com
- BCRYPT_ROUNDS=12
- RATE_LIMIT_WINDOW_MS=900000
- RATE_LIMIT_MAX_REQUESTS=100
- FRONTEND_URL=http://localhost:5173

Tests (.env.test im backend/ optional):
- TEST_DATABASE_URL=mysql://user:pass@localhost:3306/ticket_system_test
- ggf. eigene Secrets (ansonsten .env Werte werden überlagert)

Frontend (.env):
- VITE_API_URL=http://localhost:3001/api
- VITE_WS_URL=http://localhost:3001

Hinweis: In Entwicklung & Tests ist der strikte Auth‑Rate‑Limiter deaktiviert, um 429‑Fehler zu vermeiden.

## Datenbank & Prisma
- Prisma Schema: `backend/prisma/schema.prisma`
- Migrationen: versioniert in `backend/prisma/migrations`
- Häufige Befehle:
```powershell
cd backend
npm run db:migrate       # neue Migrationen anwenden
npm run db:seed          # Seed‑Daten einspielen
npm run db:studio        # Prisma Studio öffnen
npm run db:setup:simple  # einfache DB‑Initialisierung (falls bereitgestellt)
```

## Nützliche Skripte
Backend:
- `npm run dev` – Dev‑Server (ts-node)
- `npm run build` – TypeScript Build nach dist
- `npm run start` – Start aus dist
- `npm run test` – Jest Tests
- `npm run test:coverage` – Jest mit Coverage

Frontend:
- `npm run dev` – Vite Dev‑Server
- `npm run build` – Produktionsbuild

## Tests & Protokolle
- Backend: Jest (Unit/Integration). Tests unter `backend/src/tests`.
- Testausführung (Windows, im Ordner backend):
```powershell
npm ci
npm test
```
- Einzelne Suite:
```powershell
npx jest src/tests/auth.test.ts --runInBand
```
- Ergebnisse (zuletzt): 9/9 Suiten, 173/173 Tests, ~16 s
- Dokumente: `docs/TEST_REPORT_2025-08-14.md`, `docs/TEST_PROTOKOLL_2025-08-14.md`

## WebSocket & Benachrichtigungen
- Socket.io Verbindung mit JWT im Handshake (auth.token)
- Initiale unread‑count‑Emission nach kurzer Verzögerung
- Broadcasts dedupliziert; kein sofortiger Count bei Broadcast, um Ack‑Race zu vermeiden
- Events: get_notifications, notification:ack, mark_all_read, ping/pong
- Zuweisungs‑Benachrichtigungen auf Deutsch, inkl. Selbstzuweisung; Empfänger: Assignee, Ersteller, vorheriger Assignee

## API Kurzüberblick (Auth)
- POST `/api/auth/login` → `{ data: { user, token, refreshToken } }`
- POST `/api/auth/refresh` → `{ data: { accessToken } }`
- GET `/api/auth/profile` → `{ data: user }` (Authorization: Bearer <token>)
- POST `/api/auth/logout` → `{ data: { message } }`

## Sicherheit
- Helmet (inkl. CSP/Frameguard), CORS (FRONTEND_URL), Rate Limiting
- Eingabevalidierung (Joi), Logging (Winston)
- Dev/Test: Auth‑Rate‑Limiter abgeschaltet; Produktion: aktiv

## Troubleshooting
- 401 INVALID_TOKEN: Prüfen, ob im Frontend ein gültiger Token unter `localStorage['token']` liegt; ggf. ausloggen/LocalStorage leeren und neu einloggen
- 429 bei Login (Tests/Dev): NODE_ENV=test bzw. Dev – strikter Auth‑Limiter ist dort deaktiviert
- Prisma/DB: `DATABASE_URL`/`TEST_DATABASE_URL` prüfen, Migrationen anwenden, MySQL erreichbar; Sonderzeichen in Passwörtern URL‑kodieren
- CORS/WS: `FRONTEND_URL` im Backend und `VITE_API_URL`/`VITE_WS_URL` im Frontend korrekt setzen
- Ports belegt: Prüfen, ob 3001/5173 frei sind oder Ports anpassen

## Deployment
- Backend als Node‑Prozess oder per Docker deployen; Secrets/ENV korrekt setzen
- Frontend als statisches Build ausliefern (Vite) + Reverse Proxy zum Backend
- In Produktion Rate Limiting aktiv lassen, HTTPS erzwingen, Secrets regelmäßig rotieren

---

MIT License
