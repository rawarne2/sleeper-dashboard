import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { openDB, IDBPDatabase } from 'idb';
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
} from './types';
import { storePlayers, playersFromDashboardBundle } from './playerFunctions';
import { API_CONFIG, buildApiUrl } from './apiConfig';
import { LeagueContext } from './leagueContextValue';
import {
  dashboardBundleCacheKey,
  readCachedDashboardBundle,
  resolveDashboardSeasonParam,
  writeCachedDashboardBundle,
} from './dashboardBundleCache';

const DB_NAME = 'sleeper-players-db';
const DB_VERSION = 3;

interface LeagueProviderProps {
  children: ReactNode;
}

export const LeagueProvider: React.FC<LeagueProviderProps> = ({ children }) => {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [playerOwnership, setPlayerOwnership] = useState<PlayerOwnershipData>({});
  const [league, setLeague] = useState<League | null>(null);
  const [researchMeta, setResearchMeta] = useState<ResearchMeta | null>(null);
  const [ktcLastUpdated, setKtcLastUpdated] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueIdReady, setLeagueIdReady] = useState(false);
  const [selectedLeagueId, setSelectedLeagueIdState] = useState('');
  const selectedLeagueIdRef = useRef(selectedLeagueId);
  selectedLeagueIdRef.current = selectedLeagueId;

  const initDB = useCallback(async () => {
    return openDB<PlayerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('players', { keyPath: 'player_id' });
          db.createObjectStore('metadata', { keyPath: 'key' });
          db.createObjectStore('ownership', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('app_prefs', { keyPath: 'key' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('bundle_cache', { keyPath: 'key' });
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
          setSelectedLeagueIdState((row?.leagueId ?? '').trim());
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
    setLeague(null);
    setResearchMeta(null);
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

  const persistOwnershipSeason = useCallback(
    async (
      db: IDBPDatabase<PlayerDBSchema>,
      season: number,
      ownership: PlayerOwnershipData
    ) => {
      const playerIds = Object.keys(ownership);
      if (playerIds.length === 0) return;
      const tx = db.transaction('ownership', 'readwrite');
      await Promise.all(
        playerIds.map((id) => {
          const ownershipData = ownership[id];
          return tx.store.put({
            key: `${season}_${id}`,
            player_id: id,
            owned: ownershipData.owned,
            started: ownershipData.started,
          });
        })
      );
      await tx.done;
    },
    []
  );

  const fetchBundle = useCallback(async () => {
    const seasonParam = resolveDashboardSeasonParam(selectedLeagueId);

    const bundleUrl = buildApiUrl(
      API_CONFIG.ENDPOINTS.DASHBOARD_LEAGUE(selectedLeagueId),
      {
        season: seasonParam,
        league_format: 'superflex',
        is_redraft: 'false',
        tep_level: 'tep',
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
      setKtcLastUpdated(data.ktcLastUpdated ?? null);
      setPlayers(playersMap);
      setPlayerOwnership(data.ownership);
    },
    []
  );

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const refreshUrl = buildApiUrl(API_CONFIG.ENDPOINTS.KTC_REFRESH, {
        league_format: 'superflex',
        is_redraft: 'false',
        tep_level: 'tep',
      });
      const scrapeRes = await fetch(refreshUrl, { method: 'POST' });
      if (!scrapeRes.ok) {
        const body = await scrapeRes.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).error ??
            `KTC refresh failed: ${scrapeRes.status}`
        );
      }

      const db = await initDB();
      const { data, playersMap } = await fetchBundle();

      await storePlayers(db, playersMap);
      const seasonNum = parseInt(data.league?.season ?? '', 10);
      if (!Number.isNaN(seasonNum)) {
        await persistOwnershipSeason(db, seasonNum, data.ownership);
      }

      setRosters(data.rosters);
      setUsers(data.users);
      setLeague(data.league ?? null);
      setResearchMeta(data.researchMeta ?? null);
      setKtcLastUpdated(data.ktcLastUpdated ?? null);
      setPlayers(playersMap);
      setPlayerOwnership(data.ownership);
    } catch (err) {
      console.error('Error refreshing KTC data:', err);
      setError(`Failed to refresh KTC data. ${err}`);
    } finally {
      setRefreshing(false);
    }
  }, [initDB, fetchBundle, persistOwnershipSeason]);

  const loadFullData = useCallback(async () => {
    const forLeagueId = selectedLeagueId;
    const cacheKey = dashboardBundleCacheKey(forLeagueId);

    setLoading(true);
    setError(null);
    let paintedFromCache = false;

    const dbPromise = initDB();
    const bundlePromise = fetchBundle();

    try {
      const db = await dbPromise;
      if (selectedLeagueIdRef.current !== forLeagueId) return;

      const cached = await readCachedDashboardBundle(db, cacheKey);
      if (selectedLeagueIdRef.current !== forLeagueId) return;

      if (cached) {
        const cachedPlayers = playersFromDashboardBundle(cached.players);
        applyDashboardBundle(cached, cachedPlayers);
        paintedFromCache = true;
        setLoading(false);
      }

      const { data, playersMap } = await bundlePromise;
      if (selectedLeagueIdRef.current !== forLeagueId) return;

      applyDashboardBundle(data, playersMap);
      setError(null);

      // Persist to IndexedDB after paint so UI isn't blocked
      const seasonNum = parseInt(data.league?.season ?? '', 10);
      queueMicrotask(() => {
        const ownershipPersist =
          !Number.isNaN(seasonNum)
            ? persistOwnershipSeason(db, seasonNum, data.ownership)
            : Promise.resolve();
        Promise.all([
          storePlayers(db, playersMap),
          ownershipPersist,
          writeCachedDashboardBundle(db, cacheKey, data),
        ]).catch((e) => console.warn('IndexedDB persist failed', e));
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
    persistOwnershipSeason,
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

        const bench = playersList.filter(
          (p) =>
            p.player_id &&
            !starterIds.has(p.player_id) &&
            !reserveIds.has(p.player_id)
        );

        const reserve = playersList.filter(
          (p) => p.player_id && reserveIds.has(p.player_id)
        );

        return { roster, user, players: playersList, starters, bench, reserve };
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
    league,
    researchMeta,
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
