# IT Support Ticket System

Ein schlankes Ticketsystem für interne IT‑Prozesse. Frontend mit React + Vite + MUI, Backend mit Node/Express + TypeScript + Prisma (MySQL). WebSockets für Benachrichtigungen.

## Inhaltsverzeichnis
- Features
- Architektur & Ordnerstruktur
- Voraussetzungen
- Lokale Entwicklung (Windows geeignet)
- Umgebungsvariablen (.env)
- Datenbank & Prisma
- Nützliche Skripte
- Tests
- Troubleshooting (Windows/WSL/Ports/Rate Limit)
- Deployment Hinweise

## Features
- Authentifizierung (JWT), Rollen: USER, AGENT, ADMIN
- Tickets: erstellen, bearbeiten, Status ändern, zuweisen/ent‑zuweisen, löschen (ADMIN/UI)
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
│  │  ├─ websocket/        # Socket.io Handler
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
└─ README.md
```

## Voraussetzungen
- Node.js 18+ (empfohlen 20.x)
- npm 9+
- MySQL 8.x (lokal oder Docker)

## Lokale Entwicklung (Windows)
1) Repository klonen und in Ordner wechseln.

2) Backend einrichten
```powershell
cd backend
npm install
copy .env.example .env
# .env anpassen (DB_URL, JWT_SECRET, CORS_ORIGIN, usw.)
npm run db:migrate
npm run db:seed
npm run dev
```

3) Frontend einrichten
```powershell
cd ../frontend
npm install
copy .env.example .env
# VITE_API_URL auf die Backend‑URL setzen, z.B. http://localhost:3001/api
npm run dev
```

Standard‑Ports:
- Backend: 3001
- Frontend: 5173

## Umgebungsvariablen (.env)
Backend (.env):
- DATABASE_URL=mysql://user:pass@localhost:3306/tickets
- JWT_SECRET=... (starkes Secret)
- CORS_ORIGIN=http://localhost:5173
- RATE_LIMIT_WINDOW_MS=900000
- RATE_LIMIT_MAX_REQUESTS=100

Frontend (.env):
- VITE_API_URL=http://localhost:3001/api
- VITE_WS_URL=http://localhost:3001

Hinweis: In der Entwicklung ist der strikte Auth‑Rate‑Limiter deaktiviert, damit Logins nicht 429 liefern.

## Datenbank & Prisma
- Schema: backend/prisma/schema.prisma
- Migrationen werden versioniert (Ordner prisma/migrations ist NICHT in .gitignore).
- Häufige Befehle:
```powershell
cd backend
npm run db:migrate       # neue Migrationen anwenden
npm run db:seed          # Seed‑Daten einspielen
npm run db:studio        # Prisma Studio öffnen
```

## Nützliche Skripte
Backend:
- npm run dev – Dev‑Server mit ts-node
- npm run build – TS build nach dist
- npm run start – Start aus dist
- npm run test – Jest Tests
- npm run db:setup:simple – einfache DB‑Initialisierung

Frontend:
- npm run dev – Vite Dev‑Server
- npm run build – Produktionsbuild
- npm run test – Vitest/RTL

## Tests
- Backend: Jest (Unit/Integration). Dateien unter backend/src/tests.
- Frontend: Vitest + React Testing Library (einige Beispieltests enthalten).

## Troubleshooting
- 429 bei Login: In Dev ist der strikte Auth‑Limiter abgeschaltet. Falls weiterhin 429: Browser‑Tab hart neu laden, Backend neu starten.
- Windows npm „EPERM: operation not permitted“: Schließen Sie laufende Node/Prisma/Dev‑Prozesse; löschen Sie node_modules und installieren neu. Notfalls als Admin‑PowerShell ausführen.
- CORS/WS Fehler: Prüfen Sie CORS_ORIGIN im Backend .env und VITE_API_URL/VITE_WS_URL im Frontend.
- Prisma Fehler: Prüfen Sie DATABASE_URL, Migrationen anwenden (npm run db:migrate) und ggf. Seed erneut ausführen.

## Deployment Hinweise
- Backend als Node Prozess oder Docker deployen; ENV Variablen wie oben.
- Frontend via statischem Hosting (Vite build) + Reverse Proxy zum Backend.
- Aktivieren Sie in Produktion das Auth‑Rate‑Limiting (standardmäßig aktiv).

---

MIT License
