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

- **Leagues:** For now, edit the `LEAGUES` entries in `src/apiConfig.ts` (id, label, season).
- **Production API:** Set `VITE_API_URL` to your deployed API base (e.g. in Vercel env or `.env`).
