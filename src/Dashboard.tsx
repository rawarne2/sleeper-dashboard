// src/Dashboard.tsx
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrophyIcon,
  UserIcon,
  AcademicCapIcon,
  CalendarIcon,
  CakeIcon
} from '@heroicons/react/24/outline';
import { openDB, IDBPDatabase } from 'idb';
import {
  Player,
  RosterSettings,
  LeagueData,
  TeamData,
  PlayerOwnershipData,
  PlayerDBSchema
} from './types';
import { fetchPlayers, storePlayers } from './playerFunctions';
import { API_CONFIG, API_URLS } from './apiConfig';

// Use centralized config
const { LEAGUE_ID, PLAYER_CACHE_HOURS, BATCH_SIZE, PLAYER_DATA_VERSION } = API_CONFIG;

const DynastyDashboardV2: React.FC = () => {
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSmallScreen = typeof window !== 'undefined' ? window.innerWidth < 640 : false;

  // Initialize IndexedDB
  const initDB = useCallback(async () => {
    return openDB<PlayerDBSchema>('sleeper-players-db', 1, {
      upgrade(db) {
        db.createObjectStore('players', { keyPath: 'player_id' });
        db.createObjectStore('metadata', { keyPath: 'key' });
        db.createObjectStore('ownership', { keyPath: 'player_id' });
      },
    });
  }, []);

  // Check if players data needs refresh
  const shouldRefreshPlayers = useCallback(async (db: IDBPDatabase<PlayerDBSchema>) => {
    try {
      const metadata = await db.get('metadata', 'lastUpdate');
      if (!metadata) return true;

      const hoursElapsed = (Date.now() - metadata.lastUpdated) / (1000 * 60 * 60); // Convert milliseconds to hours
      const isVersionMismatch = metadata.version !== PLAYER_DATA_VERSION;

      return hoursElapsed >= PLAYER_CACHE_HOURS || isVersionMismatch;
    } catch (err) {
      console.error('Error checking player refresh:', err);
      return true;
    }
  }, []);

  // Fetch player ownership data
  const fetchPlayerOwnershipData = useCallback(async (db: IDBPDatabase<PlayerDBSchema>) => {
    try {
      const response = await fetch(API_URLS.PLAYER_RESEARCH);
      if (!response.ok) {
        throw new Error(`Failed to fetch player ownership data: ${response.status} ${response.statusText}`);
      }

      const apiResponse = await response.json();
      if (!apiResponse?.data?.research_data) {
        throw new Error('Invalid ownership data format from backend');
      }

      const data: PlayerOwnershipData = apiResponse.data.research_data;

      // Store the ownership data in IndexedDB
      const tx = db.transaction('ownership', 'readwrite');

      const playerIds = Object.keys(data);
      for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
        const batch = playerIds.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(id => {
            const ownershipData = data[id];
            return tx.store.put({
              player_id: id,
              owned: ownershipData.owned,
              started: ownershipData.started
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
  }, []);

  // Get player ownership data from IndexedDB
  const getPlayerOwnershipFromDB = useCallback(async (db: IDBPDatabase<PlayerDBSchema>) => {
    try {
      const ownershipData = await db.getAll('ownership');

      const ownershipMap: PlayerOwnershipData = {};
      ownershipData.forEach((data) => {
        if (data && data.player_id) {
          ownershipMap[data.player_id] = {
            owned: data.owned,
            started: data.started
          };
        }
      });

      return ownershipMap;
    } catch (err) {
      console.error('Error getting ownership data from DB:', err);
      return {};
    }
  }, []);

  // Fetch players from API and store in IndexedDB
  // Fetch and store players (combined operation for backward compatibility)
  const fetchAndStorePlayers = useCallback(async (db: IDBPDatabase<PlayerDBSchema>) => {
    try {
      const data = await fetchPlayers();
      await storePlayers(db, data);
      return data;
    } catch (err) {
      console.error('Error in fetchAndStorePlayers:', err);
      throw err;
    }
  }, []);

  // Get all players from IndexedDB
  const getPlayersFromDB = useCallback(async (db: IDBPDatabase<PlayerDBSchema>) => {
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
  }, []);

  // Load all data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Initialize players from IndexedDB
        const db = await initDB();
        const needsRefresh = await shouldRefreshPlayers(db);

        let playersMap: Record<string, Player> = {};
        if (needsRefresh) {
          console.log('Refreshing player data...');
          await fetchAndStorePlayers(db); // return players from this function so I don't have to call getPlayersFromDB
        }

        playersMap = await getPlayersFromDB(db);
        if (Object.keys(playersMap).length === 0) {
          throw new Error('Failed to load player data');  // remove after doing todo above
        }

        // Fetch player ownership data
        let ownershipMap: PlayerOwnershipData = {};
        try {
          ownershipMap = await getPlayerOwnershipFromDB(db);
          if (Object.keys(ownershipMap).length === 0) {
            console.log('Fetching player ownership data...');
            ownershipMap = await fetchPlayerOwnershipData(db);
          }
        } catch (err) {
          console.error('Error loading player ownership data:', err);
        }

        // Fetch league data (rosters and users together)
        let leagueResponse;
        try {
          leagueResponse = await fetch(API_URLS.SLEEPER_LEAGUE);
        } catch {
          throw new Error('Unable to connect to backend server. Please ensure it is running.');
        }

        if (!leagueResponse.ok) {
          throw new Error(`Failed to fetch league data: ${leagueResponse.status}`);
        }

        const leagueApiResponse = await leagueResponse.json();

        // Validate response structure
        if (!leagueApiResponse?.data?.rosters || !leagueApiResponse?.data?.users) {
          throw new Error('Invalid league data format from backend');
        }

        const rostersData = leagueApiResponse.data.rosters;
        const usersData = leagueApiResponse.data.users;

        setLeagueData({
          rosters: rostersData,
          users: usersData,
          players: playersMap,
          playerOwnership: ownershipMap
        });

      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load league data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initDB, shouldRefreshPlayers, fetchAndStorePlayers, getPlayersFromDB, fetchPlayerOwnershipData, getPlayerOwnershipFromDB]);

  // Process and organize team data
  const teamsData = useMemo(() => {
    if (!leagueData) return [];

    return leagueData.rosters.map(roster => {
      const user = leagueData.users.find(u => u.user_id === roster.owner_id) || {
        user_id: roster.owner_id,
        username: 'Unknown User',
        display_name: 'Unknown',
      };

      const players = roster.players
        .map(id => leagueData.players[id])
        .filter(p => p !== undefined);

      const starters = roster.starters
        .map(id => leagueData.players[id])
        .filter(p => p !== undefined);

      const starterIds = new Set(roster.starters);
      const bench = players.filter(p => !starterIds.has(p.player_id));

      return { roster, user, players, starters, bench };
    }).sort((a, b) => {
      // Sort by wins (descending), then points (descending)
      if (b.roster.settings.wins !== a.roster.settings.wins) {
        return b.roster.settings.wins - a.roster.settings.wins;
      }
      return (b.roster.settings.fpts + (b.roster.settings.fpts_decimal || 0) / 100) -
        (a.roster.settings.fpts + (a.roster.settings.fpts_decimal || 0) / 100);
    });
  }, [leagueData]);

  // Handler for expanding team details
  const handleTeamClick = (rosterId: number) => {
    setExpandedTeam(expandedTeam === rosterId ? null : rosterId);
    setExpandedPlayer(null); // Close any expanded player when changing teams
  };

  // Handler for expanding player details
  const handlePlayerClick = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
  };

  const renderPlayerChip = (player: Player) => (
    <span className={`player-chip player-chip-${player.position || 'DEF'}`}>
      {player.position || 'N/A'}
    </span>
  );

  const getTeamRecord = (settings: RosterSettings) => {
    return `${settings.wins}-${settings.losses}${settings.ties > 0 ? `-${settings.ties}` : ''}`;
  };

  const getPoints = (settings: RosterSettings) => {
    return (settings.fpts + (settings.fpts_decimal || 0) / 100).toFixed(2);
  };

  const getManagerEfficiency = (settings: RosterSettings) => {
    const fpts = settings.fpts + (settings.fpts_decimal || 0);
    const ppts = settings.ppts || 0 + (settings.ppts_decimal || 0);
    return ppts > 0 ? ((fpts / ppts) * 100).toFixed(1) + '%' : '0.00%';
  };

  const formatHeight = (height: string | undefined): string => {
    if (!height) return 'N/A';
    const inches = parseInt(height);
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  const renderPlayerOwnership = (playerId: string) => {
    if (!leagueData?.playerOwnership?.[playerId]) return null;

    const { owned, started } = leagueData.playerOwnership[playerId];
    return (
      <div className="text-xs text-gray-400 flex gap-2">
        <span>Owned: {owned}%</span>
        <span>Started: {started}%</span>
      </div>
    );
  };

  const TeamPanel = memo(({ teamData, index }: { teamData: TeamData, index: number }) => {
    const { roster, user, starters, bench } = teamData;

    return (
      <div className="team-paper">
        <div
          className="team-header p-4 sm:p-5"
          onClick={() => handleTeamClick(roster.roster_id)}
        >
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <div className="text-primary-main text-center font-semibold min-w-[20px] text-xl">
              #{index + 1}
            </div>
            <div className="w-14 h-14 rounded-full bg-background-hover flex-shrink-0 overflow-hidden">
              {user.avatar ? (
                <img
                  alt={user.display_name}
                  src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">
                  {user.display_name?.charAt(0)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 mr-1 sm:mr-2">
              <div className="text-xl font-medium truncate">
                {user.metadata?.team_name || user.display_name}
              </div>
              <div className="text-sm text-gray-400 truncate flex items-center">
                {user.username}
                {user.is_owner && (
                  <span className="ml-1 bg-primary-light/20 text-primary-light rounded-full px-2 py-0.5 text-xs">
                    Commissioner
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center flex-shrink-0">
            <div className="text-right mr-2">
              <div className="text-base">
                Record: <strong>{getTeamRecord(roster.settings)}</strong>
              </div>
              <div className="text-sm text-gray-400">
                Points: {getPoints(roster.settings)}
              </div>
              <div className="text-sm text-gray-400">
                Efficiency: {getManagerEfficiency(roster.settings)}
              </div>
            </div>
            {expandedTeam === roster.roster_id ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </div>
        </div>

        {expandedTeam === roster.roster_id && (
          <>
            <div className="border-t border-border-subtle"></div>
            <div className="p-2 sm:p-4">
              <div className="font-bold text-gray-200 mb-2">
                Starters
              </div>
              <div className="bg-background-paper rounded mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left p-2 text-sm font-medium">Position</th>
                      <th className="text-left p-2 text-sm font-medium">Player</th>
                      {!isSmallScreen && <th className="text-left p-2 text-sm font-medium">Team</th>}
                      <th className="text-right p-2 text-sm font-medium w-12">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {starters.map((player) => (
                      <React.Fragment key={player.player_id}>
                        <tr
                          className="hover:bg-background-hover cursor-pointer border-b border-border-subtle"
                          onClick={() => handlePlayerClick(player.player_id)}
                        >
                          <td className="p-2">
                            {renderPlayerChip(player)}
                          </td>
                          <td className="p-2">
                            <div className="text-sm">
                              {player.first_name} {player.last_name}
                            </div>
                            {renderPlayerOwnership(player.player_id)}
                          </td>
                          {!isSmallScreen && (
                            <td className="p-2">
                              <div className="text-sm">{player.team || 'FA'}</div>
                            </td>
                          )}
                          <td className="p-2 text-right">
                            {expandedPlayer === player.player_id ? (
                              <ChevronUpIcon className="w-4 h-4 inline-block" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 inline-block" />
                            )}
                          </td>
                        </tr>
                        {expandedPlayer === player.player_id && (
                          <tr>
                            <td colSpan={isSmallScreen ? 3 : 4} className="p-0">
                              <div className="player-detail-row">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <div className="player-detail-item">
                                      <UserIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        #{player.number || 'N/A'} {player.team || 'Free Agent'}
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <CalendarIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Experience: {player.years_exp || 0} years
                                      </span>
                                    </div>
                                    {player.injury_status && (
                                      <div className="player-detail-item">
                                        <CalendarIcon className="w-4 h-4 mr-1 text-red-500" />
                                        <span className="text-sm text-red-500">
                                          Status: {player.injury_status}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="player-detail-item">
                                      <CakeIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Age: {player.age || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <CakeIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Height: {formatHeight(player.height)}
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <CakeIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Weight: {player.weight || 'N/A'} lbs
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <AcademicCapIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        College: {player.college || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="font-bold text-gray-200 mb-2">
                Bench
              </div>
              <div className="bg-background-paper rounded">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left p-2 text-sm font-medium">Position</th>
                      <th className="text-left p-2 text-sm font-medium">Player</th>
                      {!isSmallScreen && <th className="text-left p-2 text-sm font-medium">Team</th>}
                      <th className="text-right p-2 text-sm font-medium w-12">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bench.map((player) => (
                      <React.Fragment key={player.player_id}>
                        <tr
                          className="hover:bg-background-hover cursor-pointer border-b border-border-subtle"
                          onClick={() => handlePlayerClick(player.player_id)}
                        >
                          <td className="p-2">
                            {renderPlayerChip(player)}
                          </td>
                          <td className="p-2">
                            <div className="text-sm">
                              {player.first_name} {player.last_name}
                            </div>
                            {renderPlayerOwnership(player.player_id)}
                          </td>
                          {!isSmallScreen && (
                            <td className="p-2">
                              <div className="text-sm">{player.team || 'FA'}</div>
                            </td>
                          )}
                          <td className="p-2 text-right">
                            {expandedPlayer === player.player_id ? (
                              <ChevronUpIcon className="w-4 h-4 inline-block" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 inline-block" />
                            )}
                          </td>
                        </tr>
                        {expandedPlayer === player.player_id && (
                          <tr>
                            <td colSpan={isSmallScreen ? 3 : 4} className="p-0">
                              <div className="player-detail-row">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <div className="player-detail-item">
                                      <UserIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        #{player.number || 'N/A'} {player.team || 'Free Agent'}
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <CalendarIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Experience: {player.years_exp || 0} years
                                      </span>
                                    </div>
                                    {player.injury_status && (
                                      <div className="player-detail-item">
                                        <CalendarIcon className="w-4 h-4 mr-1 text-red-500" />
                                        <span className="text-sm text-red-500">
                                          Status: {player.injury_status}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="player-detail-item">
                                      <CakeIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Age: {player.age || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <CakeIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Height: {formatHeight(player.height)}
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <CakeIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        Weight: {player.weight || 'N/A'} lbs
                                      </span>
                                    </div>
                                    <div className="player-detail-item">
                                      <AcademicCapIcon className="w-4 h-4 mr-1 text-primary-main" />
                                      <span className="text-sm">
                                        College: {player.college || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  });

  if (error) {
    return (
      <div className="bg-background-default text-white min-h-screen p-3 flex justify-center items-center">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-background-default text-white min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 shadow-md bg-gradient-to-r from-gradient-start to-gradient-end">
        <div className="flex justify-center items-center p-4 bg-gray-700 text-white rounded-lg">
          <TrophyIcon className="w-6 h-6 mr-2" />
          <div className="text-xl font-semibold truncate">
            Sleeper Dynasty Football Dashboard
          </div>
        </div>
      </div>

      <div className="container mx-auto p-2 sm:p-4 md:p-6 flex-1 max-w-6xl">
        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-main"></div>
            <div className="text-xl ml-2">Loading league data...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-background-paper p-4 rounded-lg">
              <div className="text-2xl font-semibold text-primary-main text-center mb-6">
                League Standings
              </div>
              {teamsData.map((team, index) => (
                <TeamPanel key={team.roster.roster_id} teamData={team} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="py-3 px-2 mt-auto bg-background-paper/70 text-center">
        <div className="text-sm text-gray-400">
          Sleeper Dynasty League Dashboard • League ID: {LEAGUE_ID}
        </div>
      </div>
    </div>
  );
};

export default DynastyDashboardV2;