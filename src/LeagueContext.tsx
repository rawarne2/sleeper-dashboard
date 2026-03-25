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
  ResearchMeta,
  TeamData,
  LeagueContextType,
  PlayerDBSchema,
  DashboardLeagueBundle,
} from './types';
import { storePlayers, playersFromDashboardBundle } from './playerFunctions';
import { API_CONFIG, buildApiUrl } from './apiConfig';
import { LeagueContext } from './leagueContextValue';

const { LEAGUES, BATCH_SIZE } = API_CONFIG;

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    LEAGUES[0].id
  );

  const currentSeason = useMemo(() => {
    return (
      LEAGUES.find((league) => league.id === selectedLeagueId)?.season || 2025
    );
  }, [selectedLeagueId]);

  const initDB = useCallback(async () => {
    return openDB<PlayerDBSchema>('sleeper-players-db', 1, {
      upgrade(db) {
        db.createObjectStore('players', { keyPath: 'player_id' });
        db.createObjectStore('metadata', { keyPath: 'key' });
        db.createObjectStore('ownership', { keyPath: 'key' });
      },
    });
  }, []);

  const persistOwnershipSeason = useCallback(
    async (
      db: IDBPDatabase<PlayerDBSchema>,
      season: number,
      ownership: PlayerOwnershipData
    ) => {
      const playerIds = Object.keys(ownership);
      if (playerIds.length === 0) return;
      const tx = db.transaction('ownership', 'readwrite');
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
    },
    []
  );

  const fetchBundle = useCallback(async () => {
    const bundleUrl = buildApiUrl(
      API_CONFIG.ENDPOINTS.DASHBOARD_LEAGUE(selectedLeagueId),
      {
        season: String(currentSeason),
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
      throw new Error(
        `Failed to fetch dashboard data: ${response.status} ${response.statusText}`
      );
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
  }, [selectedLeagueId, currentSeason]);

  const loadFullData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await initDB();
      const { data, playersMap } = await fetchBundle();

      await storePlayers(db, playersMap);
      await persistOwnershipSeason(db, currentSeason, data.ownership);

      setRosters(data.rosters);
      setUsers(data.users);
      setLeague(data.league ?? null);
      setResearchMeta(data.researchMeta ?? null);
      setPlayers(playersMap);
      setPlayerOwnership(data.ownership);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to load league data. Please try again later. ${err}`);
    } finally {
      setLoading(false);
    }
  }, [currentSeason, initDB, fetchBundle, persistOwnershipSeason]);

  /** Re-fetches the bundle but only merges `ktc` (and ktc-sourced fields) into existing players. */
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const { playersMap } = await fetchBundle();

      setPlayers((prev) => {
        const merged = { ...prev };
        for (const [id, freshPlayer] of Object.entries(playersMap)) {
          if (merged[id]) {
            merged[id] = {
              ...merged[id],
              ktc: freshPlayer.ktc,
              age: freshPlayer.age,
              heightFeet: freshPlayer.heightFeet,
              heightInches: freshPlayer.heightInches,
            };
          }
        }
        return merged;
      });
    } catch (err) {
      console.error('Error refreshing KTC data:', err);
      setError(`Failed to refresh KTC data. ${err}`);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBundle]);

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
  }, [rosters, users, players]);

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
    loadFullData();
  }, [loadFullData]);

  const contextValue: LeagueContextType = {
    rosters,
    users,
    players,
    playerOwnership,
    league,
    researchMeta,
    championUserId,
    teamsData,
    loading,
    refreshing,
    error,
    selectedLeagueId,
    setSelectedLeagueId,
    refreshData,
  };

  return (
    <LeagueContext.Provider value={contextValue}>
      {children}
    </LeagueContext.Provider>
  );
};
