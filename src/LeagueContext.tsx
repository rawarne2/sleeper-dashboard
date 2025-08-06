import React, {
  createContext,
  useContext,
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
  PlayerOwnershipData,
  TeamData,
  LeagueContextType,
  PlayerDBSchema,
} from './types';
import { fetchPlayers, storePlayers } from './playerFunctions';
import { API_CONFIG, buildApiUrl } from './apiConfig';

const { LEAGUES, PLAYER_CACHE_HOURS, BATCH_SIZE, PLAYER_DATA_VERSION } =
  API_CONFIG;

const LeagueContext = createContext<LeagueContextType | null>(null);

export const useLeague = (): LeagueContextType => {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
};

interface LeagueProviderProps {
  children: ReactNode;
}

export const LeagueProvider: React.FC<LeagueProviderProps> = ({ children }) => {
  // Raw data states
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [playerOwnership, setPlayerOwnership] = useState<PlayerOwnershipData>(
    {}
  );

  // UI state
  const [loading, setLoading] = useState(true);
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

  // Fetch player ownership data with dynamic season
  const fetchPlayerOwnershipData = useCallback(
    async (db: IDBPDatabase<PlayerDBSchema>, season: number) => {
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

        // Handle the new backend response structure
        const data: PlayerOwnershipData = apiResponse.data.research_data || {};

        // Store the ownership data in IndexedDB with season-specific key
        const tx = db.transaction('ownership', 'readwrite');

        const playerIds = Object.keys(data);
        for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
          const batch = playerIds.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map((id) => {
              const ownershipData = data[id];
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
        return data;
      } catch (err) {
        console.error('Error fetching player ownership data:', err);
        return {};
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

  // Refresh data function
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Initialize players from IndexedDB
      const db = await initDB();
      const needsRefresh = await shouldRefreshPlayers(db);

      let playersMap: Record<string, Player> = {};
      if (needsRefresh) {
        console.log('Refreshing player data...');
        await fetchAndStorePlayers(db);
      }

      playersMap = await getPlayersFromDB(db);
      if (Object.keys(playersMap).length === 0) {
        throw new Error('Failed to load player data');
      }

      // Fetch player ownership data with current season
      let ownershipMap: PlayerOwnershipData = {};
      try {
        ownershipMap = await getPlayerOwnershipFromDB(db, currentSeason);
        if (Object.keys(ownershipMap).length === 0) {
          console.log('Fetching player ownership data...');
          ownershipMap = await fetchPlayerOwnershipData(db, currentSeason);
        }
      } catch (err) {
        console.error('Error loading player ownership data:', err);
      }

      // Fetch league data with dynamic league ID
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

      // Validate response structure
      if (
        !leagueApiResponse?.data?.rosters ||
        !leagueApiResponse?.data?.users
      ) {
        throw new Error('Invalid league data format from backend');
      }

      // Update states
      setRosters(leagueApiResponse.data.rosters);
      setUsers(leagueApiResponse.data.users);
      setPlayers(playersMap);
      setPlayerOwnership(ownershipMap);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load league data. Please try again later.');
    } finally {
      setLoading(false);
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
        const bench = playersList.filter(
          (p) => p.player_id && !starterIds.has(p.player_id)
        );

        return { roster, user, players: playersList, starters, bench };
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

    // Computed state
    teamsData,

    // UI state
    loading,
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
