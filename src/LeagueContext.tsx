import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { openDB } from 'idb';
import {
  Roster,
  User,
  Player,
  League,
  PlayerOwnershipData,
  ResearchMeta,
  TeamData,
  LeagueContextType,
  PlayerDBSchema,
  DashboardLeagueBundle,
  TradeAnalyzerPick,
  KtcConfig,
} from './types';
import { ktcDisplayValues, playersFromDashboardBundle } from './playerFunctions';
import { API_CONFIG, buildApiUrl } from './apiConfig';
import { LeagueContext } from './leagueContextValue';
import {
  dashboardBundleCacheKey,
  getStoredKtcConfig,
  putStoredKtcConfig,
  readCachedDashboardBundle,
  resolveDashboardSeasonParam,
  tradePicksByRosterFromBundle,
  writeCachedDashboardBundle,
} from './dashboardBundleCache';
import {
  FALLBACK_KTC_CONFIG,
  ktcConfigEquals,
  ktcConfigParams,
  resolveLeagueKtcConfig,
} from './utils/leagueConfig';

const DB_NAME = 'sleeper-players-db';
const DB_VERSION = 4;

/**
 * Polls the KTC refresh job status endpoint until terminal state.
 * Returns true if job succeeded, false if failed or timed out.
 * @param delayMs   ms between polls; pass 0 in tests to skip delays
 * @param maxAttempts max polls before giving up (default 20 ≈ 40 s at 2 s/poll)
 * @param fetchFn   injectable fetch; defaults to global fetch
 */
export async function pollKtcJobStatus(
    jobId: string,
    delayMs = 2000,
    maxAttempts = 20,
    fetchFn: typeof fetch = fetch,
): Promise<boolean> {
    const statusUrl = buildApiUrl(API_CONFIG.ENDPOINTS.KTC_REFRESH_STATUS(jobId));
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (delayMs > 0 && attempt > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
        try {
            const res = await fetchFn(statusUrl);
            if (!res.ok) return false;
            const body = (await res.json()) as { status?: string };
            if (body.status === 'succeeded') return true;
            if (body.status === 'failed') return false;
            // 'queued' or 'running' — keep polling
        } catch {
            return false;
        }
    }
    return false; // timed out
}

interface LeagueProviderProps {
  children: ReactNode;
}

export const LeagueProvider: React.FC<LeagueProviderProps> = ({ children }) => {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [playerOwnership, setPlayerOwnership] = useState<PlayerOwnershipData>({});
  const [league, setLeague] = useState<League | null>(null);
  const [tradePicksByRoster, setTradePicksByRoster] = useState<
    Map<number, TradeAnalyzerPick[]>
  >(() => new Map());
  const [researchMeta, setResearchMeta] = useState<ResearchMeta | null>(null);
  const [bundleSeason, setBundleSeason] = useState<string | null>(null);
  const [ktcLastUpdated, setKtcLastUpdated] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueIdReady, setLeagueIdReady] = useState(false);
  const [selectedLeagueId, setSelectedLeagueIdState] = useState('');
  const selectedLeagueIdRef = useRef(selectedLeagueId);
  selectedLeagueIdRef.current = selectedLeagueId;
  // Auto-detected KTC identity for the loaded league (replaces the old hardcode).
  const ktcConfigRef = useRef<KtcConfig>(FALLBACK_KTC_CONFIG);
  // Mirror the ref as state so consumers (All Players, Trade Analyzer) can read the resolved config.
  const [ktcConfig, setKtcConfig] = useState<KtcConfig>(FALLBACK_KTC_CONFIG);

  const initDB = useCallback(async () => {
    return openDB<PlayerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawDb = db as any;
        if (oldVersion < 1) {
          rawDb.createObjectStore('players', { keyPath: 'player_id' });
          rawDb.createObjectStore('metadata', { keyPath: 'key' });
          rawDb.createObjectStore('ownership', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('app_prefs', { keyPath: 'key' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('bundle_cache', { keyPath: 'key' });
        }
        if (oldVersion < 4) {
          // Remove write-only stores superseded by bundle_cache
          for (const name of ['players', 'metadata', 'ownership']) {
            if (rawDb.objectStoreNames.contains(name)) {
              rawDb.deleteObjectStore(name);
            }
          }
        }
      },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const row = await db.get('app_prefs', 'league_id');
        if (!cancelled) {
          const id = row && 'leagueId' in row ? (row.leagueId ?? '').trim() : '';
          setSelectedLeagueIdState(id);
          setLeagueIdReady(true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setLeagueIdReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initDB]);

  useEffect(() => {
    if (!leagueIdReady) return;
    if (!selectedLeagueId) {
      setLoading(false);
      setTradePicksByRoster(new Map());
      return;
    }
    void (async () => {
      const db = await initDB();
      await db.put('app_prefs', { key: 'league_id', leagueId: selectedLeagueId });
    })();
  }, [leagueIdReady, selectedLeagueId, initDB]);

  const setSelectedLeagueId = useCallback((id: string) => {
    setSelectedLeagueIdState(id.trim());
  }, []);

  const clearStoredLeague = useCallback(() => {
    setSelectedLeagueIdState('');
    setLoading(false);
    setRosters([]);
    setUsers([]);
    setPlayers({});
    setPlayerOwnership({});
    setTradePicksByRoster(new Map());
    setLeague(null);
    setResearchMeta(null);
    setBundleSeason(null);
    setKtcLastUpdated(null);
    setError(null);
    void (async () => {
      try {
        const db = await initDB();
        await db.delete('app_prefs', 'league_id');
      } catch (e) {
        console.error(e);
      }
    })();
  }, [initDB]);

  const fetchBundle = useCallback(async () => {
    const seasonParam = resolveDashboardSeasonParam(selectedLeagueId);

    const bundleUrl = buildApiUrl(
      API_CONFIG.ENDPOINTS.DASHBOARD_LEAGUE(selectedLeagueId),
      {
        season: seasonParam,
        ...ktcConfigParams(ktcConfigRef.current),
      }
    );

    let response: Response;
    try {
      response = await fetch(bundleUrl);
    } catch {
      throw new Error(
        'Unable to connect to backend server. Please ensure it is running.'
      );
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg =
        typeof (errBody as { error?: string }).error === 'string'
          ? (errBody as { error: string }).error
          : `Failed to fetch dashboard data: ${response.status} ${response.statusText}`;
      throw new Error(msg);
    }

    const apiResponse = (await response.json()) as {
      status?: string;
      data?: DashboardLeagueBundle;
      error?: string;
    };

    if (apiResponse.status !== 'success' || !apiResponse.data) {
      throw new Error(
        apiResponse.error || 'Invalid dashboard bundle format from backend'
      );
    }

    const data = apiResponse.data;
    if (!Array.isArray(data.rosters) || !Array.isArray(data.users)) {
      throw new Error('Invalid dashboard bundle: rosters or users missing');
    }
    if (!data.ownership || typeof data.ownership !== 'object') {
      throw new Error('Invalid dashboard bundle: ownership missing');
    }

    const playersMap = playersFromDashboardBundle(data.players);
    if (Object.keys(playersMap).length === 0) {
      throw new Error('Invalid dashboard bundle: no player rows returned');
    }

    return { data, playersMap };
  }, [selectedLeagueId]);

  const applyDashboardBundle = useCallback(
    (data: DashboardLeagueBundle, playersMap: Record<string, Player>) => {
      setRosters(data.rosters);
      setUsers(data.users);
      setLeague(data.league ?? null);
      setResearchMeta(data.researchMeta ?? null);
      setBundleSeason(data.bundleSeason ?? data.league?.season ?? null);
      setKtcLastUpdated(data.ktcLastUpdated ?? null);
      setPlayers(playersMap);
      setPlayerOwnership(data.ownership);
      setTradePicksByRoster(tradePicksByRosterFromBundle(data));
    },
    []
  );

  const refreshData = useCallback(async () => {
    const forLeagueId = selectedLeagueId;
    setRefreshing(true);
    setError(null);
    try {
      const refreshUrl = buildApiUrl(
        API_CONFIG.ENDPOINTS.KTC_REFRESH,
        ktcConfigParams(ktcConfigRef.current)
      );
      const scrapeRes = await fetch(refreshUrl, { method: 'POST' });
      if (!scrapeRes.ok) {
        const body = await scrapeRes.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).error ??
            `KTC refresh failed: ${scrapeRes.status}`
        );
      }

      // Parse async job details from 202 response; poll until terminal state
      const scrapeBody = await scrapeRes.json().catch(() => ({})) as {
        job_id?: string;
        status?: string;
      };
      if (scrapeBody.job_id && scrapeBody.status !== 'succeeded') {
        const succeeded = await pollKtcJobStatus(scrapeBody.job_id);
        if (!succeeded) {
          throw new Error('KTC refresh job did not complete successfully.');
        }
      }

      // Discard result if user switched leagues during polling
      if (selectedLeagueIdRef.current !== forLeagueId) return;

      const { data, playersMap } = await fetchBundle();
      applyDashboardBundle(data, playersMap);

      // Re-cache the fresh bundle so a subsequent load paints it immediately.
      const db = await initDB();
      const cacheKey = dashboardBundleCacheKey(forLeagueId, ktcConfigRef.current);
      queueMicrotask(() => {
        writeCachedDashboardBundle(db, cacheKey, data).catch((e) =>
          console.warn('IndexedDB bundle cache write failed', e)
        );
      });
    } catch (err) {
      console.error('Error refreshing KTC data:', err);
      setError(`Failed to refresh KTC data. ${err}`);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBundle, selectedLeagueId, applyDashboardBundle, initDB]);

  const loadFullData = useCallback(async () => {
    const forLeagueId = selectedLeagueId;

    setTradePicksByRoster(new Map());
    setLoading(true);
    setError(null);
    let paintedFromCache = false;

    try {
      const db = await initDB();
      if (selectedLeagueIdRef.current !== forLeagueId) return;

      // Resolve the league's KTC identity: persisted config, else fallback.
      let config = (await getStoredKtcConfig(db, forLeagueId)) ?? FALLBACK_KTC_CONFIG;
      ktcConfigRef.current = config;
      setKtcConfig(config);
      let cacheKey = dashboardBundleCacheKey(forLeagueId, config);

      const cached = await readCachedDashboardBundle(db, cacheKey);
      if (selectedLeagueIdRef.current !== forLeagueId) return;

      if (cached) {
        applyDashboardBundle(cached, playersFromDashboardBundle(cached.players));
        paintedFromCache = true;
        setLoading(false);
      }

      let { data, playersMap } = await fetchBundle();
      if (selectedLeagueIdRef.current !== forLeagueId) return;

      // The bundle reveals real league settings; refetch once if we fetched with
      // the wrong identity (e.g. a 1QB or non-TEP league on a cold load).
      const trueConfig = resolveLeagueKtcConfig(data.league, data.rosters);
      if (!ktcConfigEquals(trueConfig, config)) {
        config = trueConfig;
        ktcConfigRef.current = trueConfig;
        cacheKey = dashboardBundleCacheKey(forLeagueId, trueConfig);
        const corrected = await fetchBundle();
        if (selectedLeagueIdRef.current !== forLeagueId) return;
        data = corrected.data;
        playersMap = corrected.playersMap;
      }
      ktcConfigRef.current = trueConfig;
      setKtcConfig(trueConfig);
      void putStoredKtcConfig(db, forLeagueId, trueConfig);

      applyDashboardBundle(data, playersMap);
      setError(null);

      // Persist to IndexedDB after paint so UI isn't blocked
      queueMicrotask(() => {
        writeCachedDashboardBundle(db, cacheKey, data)
          .catch((e) => console.warn('IndexedDB bundle cache write failed', e));
      });
    } catch (err) {
      console.error('Error loading data:', err);
      if (!paintedFromCache) {
        setError(`Failed to load league data. Please try again later. ${err}`);
      } else {
        console.warn('Dashboard revalidate failed; showing cached data.', err);
      }
    } finally {
      if (
        selectedLeagueIdRef.current === forLeagueId &&
        !paintedFromCache
      ) {
        setLoading(false);
      }
    }
  }, [
    selectedLeagueId,
    initDB,
    fetchBundle,
    applyDashboardBundle,
  ]);

  const usersById = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of users) {
      m.set(u.user_id, u);
    }
    return m;
  }, [users]);

  const teamsData = useMemo((): TeamData[] => {
    if (
      rosters.length === 0 ||
      users.length === 0 ||
      Object.keys(players).length === 0
    ) {
      return [];
    }

    return rosters
      .map((roster) => {
        const user = usersById.get(roster.owner_id) ?? {
          user_id: roster.owner_id,
          username: 'Unknown User',
          display_name: 'Unknown',
        };

        const playersList = roster.players
          .map((id) => players[id])
          .filter((p) => !!p);

        const starters = roster.starters
          .map((id) => players[id])
          .filter((p) => !!p);

        const starterIds = new Set(roster.starters);
        const reserveIds = new Set(roster.reserve || []);
        const taxiIds = new Set(roster.taxi || []);

        const bench = playersList.filter(
          (p) =>
            p.player_id &&
            !starterIds.has(p.player_id) &&
            !reserveIds.has(p.player_id) &&
            !taxiIds.has(p.player_id)
        );

        const reserve = playersList.filter(
          (p) => p.player_id && reserveIds.has(p.player_id)
        );

        const taxi = playersList.filter(
          (p) => p.player_id && taxiIds.has(p.player_id)
        );

        const sortByKtcDesc = (list: Player[]) =>
          [...list].sort(
            (a, b) =>
              (ktcDisplayValues(b)?.value ?? 0) - (ktcDisplayValues(a)?.value ?? 0)
          );

        return {
          roster,
          user,
          players: playersList,
          starters,
          bench: sortByKtcDesc(bench),
          reserve: sortByKtcDesc(reserve),
          taxi: sortByKtcDesc(taxi),
        };
      })
      .sort((a, b) => {
        const aWins = a.roster.settings.wins || 0;
        const bWins = b.roster.settings.wins || 0;
        if (bWins !== aWins) {
          return bWins - aWins;
        }
        const aPoints =
          (a.roster.settings.fpts || 0) +
          (a.roster.settings.fpts_decimal || 0) / 100;
        const bPoints =
          (b.roster.settings.fpts || 0) +
          (b.roster.settings.fpts_decimal || 0) / 100;
        return bPoints - aPoints;
      });
  }, [rosters, users, usersById, players]);

  const championUserId = useMemo((): string | null => {
    if (!league || league.status !== 'complete') return null;
    const championRoster = rosters.find((r) => r.settings.rank === 1);
    if (!championRoster) return null;
    const championUser = users.find(
      (u) => u.user_id === championRoster.owner_id
    );
    return championUser?.user_id ?? null;
  }, [league, rosters, users]);

  useEffect(() => {
    if (!leagueIdReady || !selectedLeagueId) return;
    loadFullData();
  }, [leagueIdReady, selectedLeagueId, loadFullData]);

  const contextValue: LeagueContextType = {
    rosters,
    users,
    players,
    playerOwnership,
    tradePicksByRoster,
    league,
    ktcConfig,
    researchMeta,
    bundleSeason,
    ktcLastUpdated,
    championUserId,
    teamsData,
    loading,
    refreshing,
    error,
    leagueIdReady,
    selectedLeagueId,
    setSelectedLeagueId,
    clearStoredLeague,
    refreshData,
  };

  return (
    <LeagueContext.Provider value={contextValue}>
      {children}
    </LeagueContext.Provider>
  );
};
