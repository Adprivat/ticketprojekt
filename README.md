# Ticket System

Ein schlankes, webbasiertes Ticketsystem für die interne IT-Abteilung, entwickelt mit React, Material UI und Node.js.

## Projektstruktur

```
ticket-system/
├── backend/          # Node.js/Express API
├── frontend/         # React Frontend
└── docs/            # Dokumentation
```

## Technologie-Stack

### Backend

- Node.js mit Express Framework
- TypeScript für Type Safety
- MySQL mit Prisma ORM
- JWT für Authentifizierung
- Socket.io für Real-time Updates

### Frontend

- React 18 mit TypeScript
- Material UI v5 für UI-Komponenten
- React Router für Navigation
- Axios für HTTP-Requests
- Socket.io-client für Real-time Updates

## Schnellstart

### Voraussetzungen

- Node.js (v18 oder höher)
- MySQL Server
- npm oder yarn

### Installation

1. Repository klonen:

```bash
git clone <repository-url>
cd ticket-system
```

2. Backend Setup:

```bash
cd backend
npm install
cp .env.example .env
# .env Datei mit Ihren Konfigurationen anpassen
npm run db:migrate
npm run db:seed
npm run dev
```

3. Frontend Setup:

```bash
cd frontend
npm install
cp .env.example .env
# .env Datei anpassen
npm run dev
```

## Entwicklung

### Backend Befehle

- `npm run dev` - Entwicklungsserver starten
- `npm run build` - Produktions-Build erstellen
- `npm run test` - Tests ausführen
- `npm run db:migrate` - Datenbank-Migrationen ausführen
- `npm run db:seed` - Testdaten einfügen

### Frontend Befehle

- `npm run dev` - Entwicklungsserver starten
- `npm run build` - Produktions-Build erstellen
- `npm run test` - Tests ausführen
- `npm run cypress:open` - E2E Tests öffnen

## Features

- ✅ Ticket-Erstellung und -Verwaltung
- ✅ Benutzer-Authentifizierung und -Autorisierung
- ✅ Ticket-Zuweisung an Bearbeiter
- ✅ Status-Management (offen, in Bearbeitung, geschlossen)
- ✅ Kommentar-System
- ✅ E-Mail-Benachrichtigungen
- ✅ Real-time Updates
- ✅ Responsive Design

## Sicherheit

Das System implementiert verschiedene Sicherheitsmaßnahmen:

- JWT-basierte Authentifizierung
- Passwort-Hashing mit bcrypt
- Rate Limiting
- Input-Validierung und -Sanitization
- CORS-Konfiguration
- Sichere Headers mit Helmet

## Lizenz

MIT License
