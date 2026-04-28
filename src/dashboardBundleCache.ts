import { EXAMPLE_LEAGUES } from './apiConfig';
import type { DashboardLeagueBundle, PlayerDBSchema } from './types';
import type { IDBPDatabase } from 'idb';
import { playersFromDashboardBundle } from './playerFunctions';

/** Matches `fetchBundle` query identity (league_format, is_redraft, tep_level). */
export function resolveDashboardSeasonParam(leagueId: string): string {
  const example = EXAMPLE_LEAGUES.find((l) => l.id === leagueId);
  return String(example?.season ?? new Date().getFullYear());
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
