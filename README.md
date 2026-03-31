# Sleeper Fantasy Football Dashboard

Fantasy and dynasty football dashboard combining KeepTradeCut player valuations with Sleeper league data.

**[View Site](https://sleeper-dashboard-xi.vercel.app/)**

## Tech stack

- **Frontend:** React, TypeScript, [Vite](https://vitejs.dev/), Tailwind CSS, Vitest for unit tests.
- **Data:** The UI talks to a **separate backend API** (see `src/apiConfig.ts`: `http://localhost:5001/api` in dev, `VITE_API_URL` in production). That service serves a bundled dashboard league endpoint and related routes.
- **Redis:** Used **on the backend** to cache read-heavy dashboard data (faster repeat requests, shared across clients). The browser never connects to Redis directly.
- **IndexedDB:** The app uses the [`idb`](https://github.com/jakearchibald/idb) wrapper to persist merged **players** and **ownership** in the browser after a successful league bundle load. That is client-side storage only; it does not replace the API or Redis.

## Setup

```bash
npm install
npm run dev
npm test  # Run unit tests
```

## Configuration

- **League ID:** On first visit, pick from **Example leagues** (saved IDs for 2024–2026 seasons) or paste your own; the choice is stored in IndexedDB (`app_prefs`). Use **Change league** to clear it. Edit `EXAMPLE_LEAGUES` in `src/apiConfig.ts` to change the dropdown list.
