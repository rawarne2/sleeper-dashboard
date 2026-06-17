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
- `src/dashboardBundleCache.ts` — IndexedDB v5 open/upgrade (adds `players_all_cache` store), bundle cache read/write, season param resolution for example leagues
- `src/playersAllCache.ts` — `/api/players/all` cache helpers: `playersAllCacheKey`, `isFresh`, `readPlayersAllCache`, `writePlayersAllCache`
- `src/apiConfig.ts` — API base URL, 8 example leagues (`EXAMPLE_LEAGUES`), endpoint builders
- `src/utils/leagueConfig.ts` — `resolveTepLevel(bonus_rec_te)`, `availablePositions(league)`, `resolveLeagueKtcConfig`
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
  - `PlayerStatRow.tsx` / `PlayerStatHeader.tsx` — the shared row + two-row header. **Consensus and 30-day trend are separate columns** (`TrendCell` is its own `<td>`; `ConsensusCell` no longer embeds trend). Both variants render a trailing expand `<th>`/`<td>`.
  - `layout.tsx` — `Cell`/`LeafTh`/`GroupTh`, zebra/edge constants, `statColumnCount()` (drives full-width `colSpan`s; all-players variant includes the expand column)
  - `cells.tsx` — `ConsensusCell`, `SourceValueCell`, `NumCell`, `TrendCell`
- `components/LeaguePickerCard.tsx` — First-visit modal and league switcher; shows league **name + config badges** (format, league_type, TEP level)
- `components/LegendModal.tsx` — Stat description overlay; season-points note references the league's exact Sleeper scoring

### Tab mounting and state preservation

All three dashboard tabs (`standings`, `all-players`, `trade-analyzer`) are kept **mounted** after first visit; inactive tabs are toggled with `display: none` (`hidden` Tailwind class). This preserves in-progress trade proposals, All Players sort/scroll position, and filter state across tab switches. See `Dashboard.tsx` for the `visited` set pattern.

### Example leagues

`EXAMPLE_LEAGUES` in `src/apiConfig.ts` is an array of 8 objects with shape:

```ts
{ id: string; name: string; season: number; format: '1qb' | 'superflex';
  league_type: 'dynasty' | 'redraft' | 'keeper'; tep: 'none' | 'tep' | 'tepp' | 'teppp' }
```

All four TEP levels, at least one redraft, and at least one 1QB league are covered. The picker shows `name · season` plus format/league_type/TEP badges.

### Position chips and TEP resolution

- **Position chips** in All Players are derived from the league's `roster_positions` via `availablePositions(league)` in `src/utils/leagueConfig.ts`. DEF and K chips are hidden when the league does not roster those positions.
- **KTC TEP level** is resolved by rounding the league's `bonus_rec_te` scoring value to the nearest bucket via `resolveTepLevel(bonus_rec_te)` (thresholds: < 0.25 → `''`, < 0.75 → `'tep'`, < 1.25 → `'tepp'`, else `'teppp'`).
- **TEP dropdown** in All Players is a 4-option `<select>` (No TEP / TEP / TEPP / TEPPP) that overrides the scoring on both values and engine points for the displayed rows.

### IndexedDB schema (version 5)

Uses the `idb` wrapper. Database name: `sleeper-players-db`. DB open/upgrade logic lives in `src/db.ts` (extracted from `LeagueContext.tsx`). Stores:
- `app_prefs` — league id + per-league resolved KTC config
- `bundle_cache` — the raw dashboard bundle, keyed by league/season/format/redraft/TEP
- `players_all_cache` — `/api/players/all` responses, keyed by `league_id|format|redraft|tep|season` (added in v5)

`players_all_cache` uses a stale-while-revalidate strategy: cached rows are painted immediately on tab open, but a fresh fetch always runs in the background and overwrites the entry. This ensures a fresh stat ingest is picked up on the next open without showing a reload spinner. See `src/playersAllCache.ts` for the key function (`playersAllCacheKey`) and freshness helpers.

## Styling

Tailwind CSS v4 via the `@tailwindcss/vite` plugin. No separate Tailwind config file — configuration is in the CSS. Uses custom theme tokens like `bg-background-default`, `bg-background-paper`, `text-primary-main`.

## Testing

Tests use **Vitest** with `jsdom` environment, `@testing-library/react`, and `fake-indexeddb` for IndexedDB mocking. Test files live in `src/__tests__/`.
