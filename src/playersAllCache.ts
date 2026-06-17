/**
 * Stale-while-revalidate cache for the /players/all endpoint, stored in
 * IndexedDB `players_all_cache`. The key includes league_id so switching
 * leagues never serves another league's rows.
 */
import { initDB } from './db';
import type { KtcConfig } from './types';

const STORE = 'players_all_cache';

export interface PlayersAllEntry {
  players: unknown[];
  cachedAt: number;
}

export function playersAllCacheKey(
  leagueId: string | null,
  config: KtcConfig,
  season: string | null
): string {
  return `${leagueId ?? 'none'}|${config.league_format}|${config.is_redraft}|${config.tep_level ?? ''}|${season ?? 'none'}`;
}

export function isFresh(entry: PlayersAllEntry, now: number, ttlMs: number): boolean {
  return now - entry.cachedAt < ttlMs;
}

export async function readPlayersAllCache(key: string): Promise<PlayersAllEntry | null> {
  try {
    const db = await initDB();
    return ((await db.get(STORE, key)) as PlayersAllEntry) ?? null;
  } catch {
    return null;
  }
}

export async function writePlayersAllCache(
  key: string,
  players: unknown[],
  cachedAt: number
): Promise<void> {
  try {
    const db = await initDB();
    await db.put(STORE, { players, cachedAt }, key);
  } catch {
    /* best-effort */
  }
}
