import { EXAMPLE_LEAGUES } from './apiConfig';
import type {
  DashboardLeagueBundle,
  DashboardPickRow,
  PlayerDBSchema,
  TradeAnalyzerPick,
} from './types';
import type { IDBPDatabase } from 'idb';
import { playersFromDashboardBundle } from './playerFunctions';

/** Matches `fetchBundle` query identity (league_format, is_redraft, tep_level). */
export function resolveDashboardSeasonParam(leagueId: string): string {
  const example = EXAMPLE_LEAGUES.find((l) => l.id === leagueId);
  return String(example?.season ?? new Date().getFullYear());
}

/** Season year for APIs that require it: bundle league first, then example-league row or calendar year. */
export function resolveTradeAnalyzerSeason(
  league: { season?: string } | null,
  leagueId: string
): number {
  const fromLeague = parseInt(league?.season ?? '', 10);
  if (Number.isFinite(fromLeague) && fromLeague > 0) return fromLeague;
  const fromParam = parseInt(resolveDashboardSeasonParam(leagueId), 10);
  if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
  return new Date().getFullYear();
}

/** Map roster_id → picks from bundled `picks_by_roster` for the trade analyzer UI. */
export function tradePicksByRosterFromBundle(
  bundle: DashboardLeagueBundle
): Map<number, TradeAnalyzerPick[]> {
  const m = new Map<number, TradeAnalyzerPick[]>();
  const raw = bundle.picks_by_roster;
  if (!raw || typeof raw !== 'object') return m;
  for (const [ridStr, rows] of Object.entries(raw)) {
    const rosterId = Number(ridStr);
    if (!Number.isFinite(rosterId) || !Array.isArray(rows)) continue;
    const list: TradeAnalyzerPick[] = [];
    for (const row of rows as DashboardPickRow[]) {
      if (!row || typeof row !== 'object') continue;
      const seasonRaw = row.season;
      const season =
        typeof seasonRaw === 'number' && Number.isFinite(seasonRaw)
          ? seasonRaw
          : parseInt(String(seasonRaw ?? ''), 10) || 0;
      const round =
        typeof row.round === 'number' && Number.isFinite(row.round)
          ? row.round
          : parseInt(String(row.round), 10) || 0;
      const slot =
        typeof row.slot_bucket === 'string' && row.slot_bucket.trim()
          ? row.slot_bucket
          : undefined;
      const pickId =
        typeof row.pick_id === 'string' && row.pick_id.trim()
          ? row.pick_id.trim()
          : undefined;
      if (!pickId) continue;

      const originalRosterId =
        typeof row.original_roster_id === 'number' &&
        Number.isFinite(row.original_roster_id)
          ? row.original_roster_id
          : undefined;

      list.push({
        pick_id: pickId,
        owner_roster_id: rosterId,
        original_roster_id: originalRosterId,
        season,
        round,
        descriptor: slot as TradeAnalyzerPick['descriptor'],
        ktc_value:
          typeof row.ktc_value === 'number' && Number.isFinite(row.ktc_value)
            ? row.ktc_value
            : undefined,
      });
    }
    m.set(rosterId, list);
  }
  return m;
}

export function dashboardBundleCacheKey(leagueId: string): string {
  const season = resolveDashboardSeasonParam(leagueId);
  return `${leagueId}|${season}|superflex|false|tep`;
}

export function isDashboardBundleDisplayable(
  data: DashboardLeagueBundle
): boolean {
  if (!Array.isArray(data.rosters) || !Array.isArray(data.users)) return false;
  if (!data.ownership || typeof data.ownership !== 'object') return false;
  const playersMap = playersFromDashboardBundle(data.players);
  return Object.keys(playersMap).length > 0;
}

export async function readCachedDashboardBundle(
  db: IDBPDatabase<PlayerDBSchema>,
  cacheKey: string
): Promise<DashboardLeagueBundle | null> {
  try {
    const row = await db.get('bundle_cache', cacheKey);
    if (!row?.data || !isDashboardBundleDisplayable(row.data)) return null;
    return row.data;
  } catch {
    return null;
  }
}

export async function writeCachedDashboardBundle(
  db: IDBPDatabase<PlayerDBSchema>,
  cacheKey: string,
  data: DashboardLeagueBundle
): Promise<void> {
  if (!isDashboardBundleDisplayable(data)) return;
  try {
    await db.put('bundle_cache', {
      key: cacheKey,
      savedAt: Date.now(),
      data,
    });
  } catch (e) {
    console.warn('Failed to persist dashboard bundle cache', e);
  }
}
