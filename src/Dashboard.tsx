// src/Dashboard.tsx
import React, { useState, memo } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrophyIcon,
  UserIcon,
  AcademicCapIcon,
  CalendarIcon,
  CakeIcon,
} from '@heroicons/react/24/outline';
import { Player, RosterSettings, TeamData } from './types';
import { useLeague } from './useLeague';
import { API_CONFIG } from './apiConfig';

const { LEAGUES } = API_CONFIG;

const DynastyDashboardV2: React.FC = () => {
  // Use league context instead of local state
  const {
    teamsData,
    teamsDataPreview,
    playerOwnership,
    loading,
    playersLoading,
    error,
    selectedLeagueId,
    setSelectedLeagueId,
  } = useLeague();

  // UI state - only keep what's specific to this component
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

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
    const wins = settings.wins || 0;
    const losses = settings.losses || 0;
    const ties = settings.ties || 0;
    return `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
  };

  const getPoints = (settings: RosterSettings) => {
    const fpts = settings.fpts || 0;
    const fpts_decimal = settings.fpts_decimal || 0;
    return (fpts + fpts_decimal / 100).toFixed(2);
  };

  const getManagerEfficiency = (settings: RosterSettings) => {
    const fpts = (settings.fpts || 0) + (settings.fpts_decimal || 0) / 100;
    const ppts = (settings.ppts || 0) + (settings.ppts_decimal || 0) / 100;
    return ppts > 0 ? ((fpts / ppts) * 100).toFixed(1) + '%' : '0.0%';
  };

  const formatHeight = (player: Player): string => {
    console.log({ player });
    if (player?.heightFeet && player?.heightInches) {
      return `${player.heightFeet}'${player.heightInches}"`;
    }
    return 'N/A';
  };

  const renderPlayerOwnership = (playerId: string) => {
    // Check player object first (future backend integration), then fallback to separate ownership data
    const player = teamsData
      .find((team) => team.players.some((p) => p.player_id === playerId))
      ?.players.find((p) => p.player_id === playerId);

    let owned: number | undefined;
    let started: number | undefined;

    if (player?.owned && player?.started) {
      // Future: Backend has integrated ownership data
      owned = player.owned;
      started = player.started;
    } else if (playerOwnership[playerId]) {
      // Current: Separate ownership lookup
      owned = playerOwnership[playerId].owned;
      started = playerOwnership[playerId].started;
    }

    if (!owned || !started) return null;

    return (
      <div className='text-xs text-gray-400 flex gap-2'>
        <span>Owned: {owned}%</span>
        <span>Started: {started}%</span>
      </div>
    );
  };

  // Reusable Player Detail Row Component
  const PlayerDetailRow = memo(({ player }: { player: Player }) => (
    <tr>
      <td colSpan={6} className='p-0 align-top'>
        <div className='player-detail-row'>
          <div className='player-detail-grid'>
            <div className='player-detail-item'>
              <UserIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>
                #{player.number || 'N/A'} {player.team || 'Free Agent'}
              </span>
            </div>
            <div className='player-detail-item'>
              <CalendarIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>
                Experience: {player.years_exp || 0} years
              </span>
            </div>
            {player.injury_status && (
              <div className='player-detail-item'>
                <CalendarIcon className='player-detail-icon text-red-500' />
                <span className='text-sm text-red-500'>
                  Status: {player.injury_status}
                </span>
              </div>
            )}
            <div className='player-detail-item'>
              <CakeIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>Age: {player.age || 'N/A'}</span>
            </div>
            <div className='player-detail-item'>
              <CakeIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>Height: {formatHeight(player)}</span>
            </div>
            <div className='player-detail-item'>
              <CakeIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>Weight: {player.weight || 'N/A'} lbs</span>
            </div>
            <div className='player-detail-item'>
              <AcademicCapIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>College: {player.college || 'N/A'}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  ));

  // Reusable Player Row Component
  const PlayerRow = memo(({ player }: { player: Player }) => (
    <React.Fragment key={player.player_id}>
      <tr
        className='hover:bg-background-hover cursor-pointer border-b border-border-subtle'
        onClick={() => player.player_id && handlePlayerClick(player.player_id)}
      >
        <td className='p-1 sm:p-2'>{renderPlayerChip(player)}</td>
        <td className='p-1 sm:p-2'>
          <div className='text-sm'>
            {player.first_name} {player.last_name}
          </div>
          {player.player_id && renderPlayerOwnership(player.player_id)}
        </td>
        <td className='p-1 sm:p-2'>
          <div className='text-sm'>{player.ktc?.superflexValues?.tep?.value || '0'}</div>
        </td>
        <td className='p-1 sm:p-2'>
          <div className='flex flex-col items-center gap-1'>
            <span className='text-sm'>{player.position} {player.ktc?.superflexValues?.tep?.positionalRank || '9999'}</span>
            <span className='text-sm'>OVR {player.ktc?.superflexValues?.tep?.rank}</span>
          </div>
        </td>
        <td className='p-1 sm:p-2'>
          <div className='flex flex-col items-center gap-1'>
            <span className='text-sm'>{player.position} {player.ktc?.superflexValues?.tep?.positionalTier || '9999'}</span>
            <span className='text-sm'>OVR {player.ktc?.superflexValues?.tep?.overallTier || '0'}</span>
          </div>
        </td>
        {/* <td className='p-1 sm:p-2'>
          <div className='text-sm'>{ }</div>
        </td> */}
        <td className='p-1 sm:p-2'>
          {expandedPlayer === player.player_id ? (
            <ChevronUpIcon className='h-4' />
          ) : (
            <ChevronDownIcon className='h-4' />
          )}
        </td>
      </tr>
      {expandedPlayer === player.player_id && <PlayerDetailRow player={player} />}
    </React.Fragment>
  ));

  // Reusable Player Table Component
  const PlayerTable = memo(
    ({ title, players }: { title: string; players: Player[] }) => (
      <>
        <div className='font-bold text-gray-200 mb-2'>{title}</div>
        <div className={`bg-background-paper justify-center rounded ${title === 'Starters' ? 'mb-6' : ''}`}>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-border-subtle'>
                <th className='sm:p-2 text-sm font-medium'>Position</th>
                <th className='sm:p-2 text-sm font-medium'>Player</th>
                <th className='sm:p-2 text-sm font-medium'>Value</th>
                <th className='sm:p-2 text-sm font-medium'>KTC Ranking</th>
                <th className='sm:p-2 text-sm font-medium'>Tiers</th>
                {/* <th className='sm:p-2 text-sm font-medium'>Season PPG</th> */}
                {/* <th className='sm:p-2 text-sm font-medium w-12'>
                  Details
                </th> */}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <PlayerRow key={player.player_id} player={player} />
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  );

  const TeamPanel = memo(
    ({
      teamData,
      index,
      rosterDetailsPending = false,
    }: {
      teamData: TeamData;
      index: number;
      rosterDetailsPending?: boolean;
    }) => {
      const { roster, user, starters, bench } = teamData;

      return (
        <div className='team-paper'>
          <div
            className='team-header p-4 sm:p-5 flex'
            onClick={() => handleTeamClick(roster.roster_id)}
          >
            <div className='flex items-center gap-1'>
              <div className='text-primary-main text-center font-semibold min-w-[20px] sm:text-xl'>
                #{index + 1}
              </div>
              <div className='w-8 h-8 md:w-14 md:h-14 rounded-full bg-background-hover flex-shrink-0 overflow-hidden'>
                {user.avatar ? (
                  <img
                    alt={user.display_name}
                    src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center sm:text-xl'>
                    {'N/A'}
                  </div>
                )}
              </div>

              <div className='min-w-0 flex-1 mr-1 sm:mr-2'>
                <div className='font-bold sm:text-xl font-medium truncate'>
                  {user.metadata?.team_name || user.display_name}
                </div>
                <div className='text-sm text-gray-400 truncate flex items-center'>
                  {user.username}
                  {user.is_owner && (
                    <span className='ml-1 bg-primary-light/20 text-primary-light rounded-full px-2 py-0.5 text-xs'>
                      Commissioner
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className='flex items-center flex-shrink-0'>
              <div>
                <div className='text-sm sm:text-base'>
                  Record: <strong>{getTeamRecord(roster.settings)}</strong>
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Points: {getPoints(roster.settings)}
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Efficiency: {getManagerEfficiency(roster.settings)}
                </div>
              </div>
              {expandedTeam === roster.roster_id ? (
                <ChevronUpIcon className='w-5 h-5' />
              ) : (
                <ChevronDownIcon className='w-5 h-5' />
              )}
            </div>
          </div>

          {expandedTeam === roster.roster_id && (
            <>
              <div className='border-t border-border-subtle'></div>
              <div className='p-2 sm:p-4'>
                {rosterDetailsPending ? (
                  <div className='flex flex-col items-center justify-center py-8 text-gray-400 gap-2'>
                    <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-main' />
                    <p className='text-sm text-center max-w-sm'>
                      Loading KTC rankings to show starters and bench...
                    </p>
                  </div>
                ) : (
                  <>
                    <PlayerTable title='Starters' players={starters} />
                    <PlayerTable title='Bench' players={bench} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      );
    }
  );

  if (error) {
    return (
      <div className='bg-background-default text-white min-h-screen p-3 flex justify-center items-center'>
        <div className='text-xl text-red-500'>{error}</div>
      </div>
    );
  }

  return (
    <div className='bg-background-default text-white min-h-screen flex flex-col w-full'>
      <div className='top-0 z-10 shadow-md bg-gradient-to-r from-gradient-start to-gradient-end'>
        <div className='flex justify-between items-center p-4 my-4 sm:my-1 bg-gray-700 text-white rounded-lg flex-col sm:gap-2'>
          <div className='flex items-center'>
            <TrophyIcon className='w-6 h-6 mr-2' />
            <div className='text-xl font-semibold'>
              Sleeper Dynasty Football Dashboard
            </div>
          </div>

          {/* League Selector */}
          <div className='flex items-center gap-2'>
            <label
              htmlFor='league-select'
              className='text-sm font-medium whitespace-nowrap'
            >
              League:
            </label>
            <select
              id='league-select'
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className='bg-gray-600 text-white border border-gray-500 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-main'
            >
              {LEAGUES.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className='flex-1'>
        {loading ? (
          <div className='flex flex-col justify-center items-center h-[50vh] gap-3'>
            <div className='flex items-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-main' />
              <div className='text-xl ml-3'>Loading league data...</div>
            </div>
          </div>
        ) : playersLoading ? (
          <div className='grid grid-cols-1 gap-4'>
            <div className='bg-background-paper justify-center rounded-lg'>
              <div className='text-2xl font-semibold text-primary-main text-center my-6'>
                League Standings
              </div>
              <div className='flex items-center justify-center gap-2 px-4 pb-4 text-sm text-gray-400'>
                <div className='animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-main shrink-0' />
                <span>
                  Loading KTC player data in background — the initial load takes a long time, but you can expand a team after
                  it finishes to see rosters.
                </span>
              </div>
              {teamsDataPreview.map((team, index) => (
                <TeamPanel
                  key={team.roster.roster_id}
                  teamData={team}
                  index={index}
                  rosterDetailsPending
                />
              ))}
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4'>
            <div className='bg-background-paper justify-center rounded-lg'>
              <div className='text-2xl font-semibold text-primary-main text-center my-6'>
                League Standings
              </div>
              {teamsData.map((team, index) => (
                <TeamPanel
                  key={team.roster.roster_id}
                  teamData={team}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className='py-3 px-2 mt-auto bg-background-paper/70 text-center'>
        <div className='text-sm text-gray-400'>
          Sleeper Dynasty League Dashboard •{' '}
          {LEAGUES.find((league) => league.id === selectedLeagueId)?.label} •
          ID: {selectedLeagueId}
        </div>
      </div>
    </div>
  );
};

export default DynastyDashboardV2;
