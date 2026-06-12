# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (binds to all interfaces)
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm test             # Vitest in watch mode
npx vitest run       # Single CI-style test run (no watch)
npx vitest run src/__tests__/playerFunctions.test.ts  # Run a single test file
```

## Architecture

This is a **React + TypeScript + Vite** frontend for a Sleeper fantasy football dynasty dashboard. It is a client-only SPA deployed to Vercel; there is no backend in this repo.

### Data flow

1. **Backend API** (separate repo) serves a bundled dashboard endpoint at `GET /api/dashboard/league/:leagueId`. In dev this is `http://localhost:5001/api`; in production it uses `VITE_API_URL`. See `src/apiConfig.ts` for endpoint definitions and `buildApiUrl()`.

2. **LeagueContext** (`src/LeagueContext.tsx`) is the central data provider. It:
   - Reads the saved league ID from IndexedDB (`app_prefs` store) on mount
   - Implements stale-while-revalidate: paints cached bundle from IndexedDB (`bundle_cache` store) immediately, then fetches fresh data from the API
   - Normalizes the API's player payload (array or id-keyed object) via `playersFromDashboardBundle()` in `src/playerFunctions.ts`
   - Persists players and ownership data back to IndexedDB after paint

3. **`useLeague()` hook** (`src/useLeague.ts`) exposes the context. All components consume league data through this hook.

### Key modules

- `src/types.ts` — All TypeScript interfaces (API responses, Player, Roster, League, IndexedDB schema)
- `src/playerFunctions.ts` — Backend player row mapping, IndexedDB storage logic, position/status filtering (QB/RB/WR/TE/K only, excludes retired)
- `src/dashboardBundleCache.ts` — IndexedDB bundle cache read/write, season param resolution for example leagues
- `src/apiConfig.ts` — API base URL, example league IDs, endpoint builders
- `src/utils/teamStats.ts` — Pure stat formatting functions (record, PF, PA, PPG, efficiency)

### Component structure

- `App.tsx` — Lazy-loads `Dashboard`
- `Dashboard.tsx` — Shell: header with league info, hash-tab bar (`#standings`/`#all-players`/`#trade-analyzer`), legend + league-picker modals. Each tab renders a page.
- `pages/LeagueStandingsPage.tsx` — Standings tab: league/rankings meta chips + the `TeamPanel` list
- `pages/AllPlayersPage.tsx` — Sortable all-players grid (standalone; reads `/api/players/all`)
- `pages/TradeAnalyzerPage.tsx` — Trade proposal analyzer
- `components/TeamPanel.tsx` — Expandable team card; renders a `RosterTable`
- `components/RosterTable.tsx` — Standings roster table (team grouping, expand-to-detail)
- `components/playerTable/` — Shared player-table building blocks used by **both** the roster table and the All Players grid:
  - `PlayerStatRow.tsx` / `PlayerStatHeader.tsx` — the shared row + two-row header (separate Consensus/KTC/FC columns; conditional Redraft column when redraft)
  - `layout.tsx` — `Cell`/`LeafTh`/`GroupTh`, zebra/edge constants, `statColumnCount()` (drives full-width `colSpan`s)
  - `cells.tsx` — `ConsensusCell`, `SourceValueCell`, `NumCell`, `TrendCell`
- `components/LeaguePickerCard.tsx` — First-visit modal and league switcher
- `components/LegendModal.tsx` — Stat description overlay

### IndexedDB schema (version 4)

Uses the `idb` wrapper. Database name: `sleeper-players-db`. Stores: `app_prefs` (league id + per-league resolved KTC config) and `bundle_cache` (the raw dashboard bundle, keyed by league/season/format/redraft/TEP). No per-player stores.

## Styling

Tailwind CSS v4 via the `@tailwindcss/vite` plugin. No separate Tailwind config file — configuration is in the CSS. Uses custom theme tokens like `bg-background-default`, `bg-background-paper`, `text-primary-main`.

## Testing

Tests use **Vitest** with `jsdom` environment, `@testing-library/react`, and `fake-indexeddb` for IndexedDB mocking. Test files live in `src/__tests__/`.
