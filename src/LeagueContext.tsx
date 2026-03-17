import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { openDB, IDBPDatabase } from 'idb';
import {
  Roster,
  User,
  Player,
  League,
  PlayerOwnershipData,
  PlayerOwnershipStats,
  ResearchMeta,
  TeamData,
  LeagueContextType,
  PlayerDBSchema,
} from './types';
import { fetchPlayers, storePlayers } from './playerFunctions';
import { API_CONFIG, buildApiUrl } from './apiConfig';
import { LeagueContext } from './leagueContextValue';

const { LEAGUES, PLAYER_CACHE_HOURS, BATCH_SIZE, PLAYER_DATA_VERSION } =
  API_CONFIG;

interface LeagueProviderProps {
  children: ReactNode;
}

export const LeagueProvider: React.FC<LeagueProviderProps> = ({ children }) => {
  // Raw data states
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [playerOwnership, setPlayerOwnership] = useState<PlayerOwnershipData>({});
  const [league, setLeague] = useState<League | null>(null);
  const [researchMeta, setResearchMeta] = useState<ResearchMeta | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    LEAGUES[0].id
  );

  // Get current season based on selected league
  const currentSeason = useMemo(() => {
    return (
      LEAGUES.find((league) => league.id === selectedLeagueId)?.season || 2025
    );
  }, [selectedLeagueId]);

  // Initialize IndexedDB
  const initDB = useCallback(async () => {
    return openDB<PlayerDBSchema>('sleeper-players-db', 1, {
      upgrade(db) {
        db.createObjectStore('players', { keyPath: 'player_id' });
        db.createObjectStore('metadata', { keyPath: 'key' });
        db.createObjectStore('ownership', { keyPath: 'key' });
      },
    });
  }, []);

  // Check if players data needs refresh
  const shouldRefreshPlayers = useCallback(
    async (db: IDBPDatabase<PlayerDBSchema>) => {
      try {
        const metadata = await db.get('metadata', 'lastUpdate');
        if (!metadata) return true;

        const hoursElapsed =
          (Date.now() - metadata.lastUpdated) / (1000 * 60 * 60);
        const isVersionMismatch = metadata.version !== PLAYER_DATA_VERSION;

        return hoursElapsed >= PLAYER_CACHE_HOURS || isVersionMismatch;
      } catch (err) {
        console.error('Error checking player refresh:', err);
        return true;
      }
    },
    []
  );

  // Fetch player ownership data with dynamic season.
  // Returns both the ownership map and any research metadata from the response.
  // Handles multiple backend response shapes:
  //   A) data is an array of ResearchData objects (one per player)
  //   B) data is a single object with nested research_data map
  //   C) data itself is a flat {playerId: {owned, started}} map
  const fetchPlayerOwnershipData = useCallback(
    async (db: IDBPDatabase<PlayerDBSchema>, season: number): Promise<{
      ownership: PlayerOwnershipData;
      meta: ResearchMeta | null;
    }> => {
      try {
        const playerResearchUrl = buildApiUrl(
          API_CONFIG.ENDPOINTS.SLEEPER_RESEARCH(season)
        );
        const response = await fetch(playerResearchUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch player ownership data: ${response.status} ${response.statusText}`
          );
        }

        const apiResponse = await response.json();
        if (apiResponse.status !== 'success' || !apiResponse?.data) {
          throw new Error('Invalid ownership data format from backend');
        }

        const rawData = apiResponse.data;
        let ownership: PlayerOwnershipData = {};
        let meta: ResearchMeta | null = null;

        if (Array.isArray(rawData)) {
          // Shape A: array of per-player ResearchData objects
          // Use the first item for metadata
          const first = rawData[0];
          if (first) {
            meta = {
              season: String(first.season || season),
              week: first.week || 0,
              league_type: first.league_type || 0,
              last_updated: first.last_updated || new Date().toISOString(),
            };
          }
          for (const item of rawData) {
            if (item.player_id) {
              const rd = item.research_data as Record<string, unknown> | undefined;
              if (rd && typeof rd.owned === 'number') {
                ownership[item.player_id] = {
                  owned: rd.owned as number,
                  started: (rd.started as number) || 0,
                };
              }
            }
          }
        } else {
          // Shape B or C: single object
          meta = {
            season: String(rawData.season || season),
            week: rawData.week || 0,
            league_type: rawData.league_type || 0,
            last_updated: rawData.last_updated || new Date().toISOString(),
          };

          const nested = rawData.research_data;
          if (nested && typeof nested === 'object' && !Array.isArray(nested) && Object.keys(nested).length > 0) {
            // Shape B: nested research_data map
            ownership = nested as PlayerOwnershipData;
          } else {
            // Shape C: the data object itself might be the flat ownership map
            for (const [key, val] of Object.entries(rawData)) {
              if (
                typeof val === 'object' &&
                val !== null &&
                'owned' in (val as object) &&
                typeof (val as PlayerOwnershipStats).owned === 'number'
              ) {
                ownership[key] = val as PlayerOwnershipStats;
              }
            }
          }
        }

        // Persist to IndexedDB
        if (Object.keys(ownership).length > 0) {
          const tx = db.transaction('ownership', 'readwrite');
          const playerIds = Object.keys(ownership);
          for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
            const batch = playerIds.slice(i, i + BATCH_SIZE);
            await Promise.all(
              batch.map((id) => {
                const ownershipData = ownership[id];
                return tx.store.put({
                  key: `${season}_${id}`,
                  player_id: id,
                  owned: ownershipData.owned,
                  started: ownershipData.started,
                });
              })
            );
          }
          await tx.done;
        }

        return { ownership, meta };
      } catch (err) {
        console.error('Error fetching player ownership data:', err);
        return { ownership: {}, meta: null };
      }
    },
    []
  );

  // Get player ownership data from IndexedDB with season
  const getPlayerOwnershipFromDB = useCallback(
    async (db: IDBPDatabase<PlayerDBSchema>, season: number) => {
      try {
        const ownershipData = await db.getAll('ownership');

        const ownershipMap: PlayerOwnershipData = {};
        ownershipData.forEach((data) => {
          if (data && data.key && data.key.startsWith(`${season}_`)) {
            const playerId = data.key.replace(`${season}_`, '');
            ownershipMap[playerId] = {
              owned: data.owned,
              started: data.started,
            };
          }
        });

        return ownershipMap;
      } catch (err) {
        console.error('Error getting ownership data from DB:', err);
        return {};
      }
    },
    []
  );

  // Fetch and store players
  const fetchAndStorePlayers = useCallback(
    async (db: IDBPDatabase<PlayerDBSchema>) => {
      try {
        const data = await fetchPlayers();
        await storePlayers(db, data);
        return data;
      } catch (err) {
        console.error('Error in fetchAndStorePlayers:', err);
        throw err;
      }
    },
    []
  );

  // Get all players from IndexedDB
  const getPlayersFromDB = useCallback(
    async (db: IDBPDatabase<PlayerDBSchema>) => {
      try {
        const players = await db.getAll('players');
        if (!players || players.length === 0) {
          throw new Error('No players found in database');
        }

        const playersMap: Record<string, Player> = {};
        players.forEach((player: Player) => {
          if (player && player.player_id) {
            playersMap[player.player_id] = player;
          }
        });

        return playersMap;
      } catch (err) {
        console.error('Error getting players from DB:', err);
        return {};
      }
    },
    []
  );

  // Refresh data function — league first (fast), then players/KTC (slow on cold cache)
  const refreshData = useCallback(async () => {
    setLoading(true);
    setPlayersLoading(false);
    setError(null);
    try {
      const db = await initDB();

      // 1) Fetch Sleeper league first so UI can show shell without waiting on KTC
      const leagueUrl = buildApiUrl(
        API_CONFIG.ENDPOINTS.SLEEPER_LEAGUE(selectedLeagueId)
      );
      let leagueResponse;
      try {
        leagueResponse = await fetch(leagueUrl);
      } catch {
        throw new Error(
          'Unable to connect to backend server. Please ensure it is running.'
        );
      }

      if (!leagueResponse.ok) {
        throw new Error(
          `Failed to fetch league data: ${leagueResponse.status}`
        );
      }

      const leagueApiResponse = await leagueResponse.json();
      if (
        !leagueApiResponse?.data?.rosters ||
        !leagueApiResponse?.data?.users
      ) {
        throw new Error('Invalid league data format from backend');
      }

      setRosters(leagueApiResponse.data.rosters);
      setUsers(leagueApiResponse.data.users);
      if (leagueApiResponse.data.league) {
        setLeague(leagueApiResponse.data.league);
      }
      setLoading(false);

      // 2) Players + ownership (KTC fetch can take ~1min on first load)
      const needsRefresh = await shouldRefreshPlayers(db);
      if (needsRefresh) {
        setPlayersLoading(true);
        console.log('Refreshing player data...');
        try {
          await fetchAndStorePlayers(db);
        } catch (playerErr) {
          console.error('Error loading player data:', playerErr);
          setError(
            `League loaded but player rankings failed to load. ${playerErr}`
          );
          setPlayersLoading(false);
          return;
        }
      }

      let playersMap: Record<string, Player> = {};
      playersMap = await getPlayersFromDB(db);
      if (Object.keys(playersMap).length === 0) {
        setError('Failed to load player data');
        setPlayersLoading(false);
        return;
      }

      // Always fetch fresh ownership so stale IndexedDB cache doesn't block updates
      let ownershipMap: PlayerOwnershipData = {};
      try {
        const { ownership, meta } = await fetchPlayerOwnershipData(db, currentSeason);
        ownershipMap = ownership;
        if (meta) setResearchMeta(meta);
        // Fallback to IndexedDB if API returned empty
        if (Object.keys(ownershipMap).length === 0) {
          ownershipMap = await getPlayerOwnershipFromDB(db, currentSeason);
        }
      } catch (err) {
        console.error('Error loading player ownership data:', err);
        ownershipMap = await getPlayerOwnershipFromDB(db, currentSeason);
      }

      setPlayers(playersMap);
      setPlayerOwnership(ownershipMap);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to load league data. Please try again later. ${err}`);
    } finally {
      setLoading(false);
      setPlayersLoading(false);
    }
  }, [
    selectedLeagueId,
    currentSeason,
    initDB,
    shouldRefreshPlayers,
    fetchAndStorePlayers,
    getPlayersFromDB,
    fetchPlayerOwnershipData,
    getPlayerOwnershipFromDB,
  ]);

  // Standings preview: same order as teamsData but without player resolution (rosters + users only)
  const teamsDataPreview = useMemo((): TeamData[] => {
    if (rosters.length === 0 || users.length === 0) return [];

    return rosters
      .map((roster) => {
        const user = users.find((u) => u.user_id === roster.owner_id) || {
          user_id: roster.owner_id,
          username: 'Unknown User',
          display_name: 'Unknown',
        };
        return {
          roster,
          user,
          players: [],
          starters: [],
          bench: [],
          reserve: [],
        };
      })
      .sort((a, b) => {
        const aWins = a.roster.settings.wins || 0;
        const bWins = b.roster.settings.wins || 0;
        if (bWins !== aWins) return bWins - aWins;
        const aPoints =
          (a.roster.settings.fpts || 0) +
          (a.roster.settings.fpts_decimal || 0) / 100;
        const bPoints =
          (b.roster.settings.fpts || 0) +
          (b.roster.settings.fpts_decimal || 0) / 100;
        return bPoints - aPoints;
      });
  }, [rosters, users]);

  // Computed teamsData
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
        const user = users.find((u) => u.user_id === roster.owner_id) || {
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

        // Bench = not a starter AND not on IR/reserve
        const bench = playersList.filter(
          (p) => p.player_id && !starterIds.has(p.player_id) && !reserveIds.has(p.player_id)
        );

        // Reserve / IR players
        const reserve = playersList.filter(
          (p) => p.player_id && reserveIds.has(p.player_id)
        );

        return { roster, user, players: playersList, starters, bench, reserve };
      })
      .sort((a, b) => {
        // Sort by wins (descending), then points (descending)
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
  }, [rosters, users, players]);

  // Derive champion from rank===1 roster when league is complete
  const championUserId = useMemo((): string | null => {
    if (!league || league.status !== 'complete') return null;
    const championRoster = rosters.find((r) => r.settings.rank === 1);
    if (!championRoster) return null;
    const championUser = users.find((u) => u.user_id === championRoster.owner_id);
    return championUser?.user_id ?? null;
  }, [league, rosters, users]);

  // Load data on mount and league change
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const contextValue: LeagueContextType = {
    // Raw data states
    rosters,
    users,
    players,
    playerOwnership,

    // League metadata
    league,
    researchMeta,
    championUserId,

    // Computed state
    teamsData,
    teamsDataPreview,

    // UI state
    loading,
    playersLoading,
    error,
    selectedLeagueId,
    setSelectedLeagueId,

    // Actions
    refreshData,
  };

  return (
    <LeagueContext.Provider value={contextValue}>
      {children}
    </LeagueContext.Provider>
  );
};
