import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useLeague } from './useLeague';
import { getLeagueStatusInfo } from './utils/teamStats';
// import { formatApiInstant } from './utils/formatting';
import { TeamPanel } from './components/TeamPanel';
import { LeaguePickerCard } from './components/LeaguePickerCard';
import { LegendModal } from './components/LegendModal';

const Dashboard: React.FC = () => {
  const {
    teamsData,
    playerOwnership,
    league,
    researchMeta,
    // ktcLastUpdated,
    championUserId,
    loading,
    // refreshing,
    error,
    leagueIdReady,
    selectedLeagueId,
    setSelectedLeagueId,
    clearStoredLeague,
    // refreshData,
  } = useLeague();

  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [leaguePickerOpen, setLeaguePickerOpen] = useState(false);

  const handleTeamClick = (rosterId: number) => {
    setExpandedTeam(expandedTeam === rosterId ? null : rosterId);
    setExpandedPlayer(null);
  };

  const handlePlayerClick = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
  };

  if (!leagueIdReady) {
    return (
      <div className='bg-background-default text-white min-h-screen p-3 flex flex-col justify-center items-center gap-3'>
        <div className='animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-main' />
        <div className='text-gray-300'>Loading saved preferences…</div>
      </div>
    );
  }

  if (!selectedLeagueId) {
    return (
      <div className='bg-background-default text-white min-h-screen relative'>
        <div className='absolute inset-0 bg-black/55 backdrop-blur-[2px]' aria-hidden />
        <div
          className='relative z-10 flex min-h-screen items-center justify-center p-4'
          role='dialog'
          aria-modal='true'
          aria-labelledby='league-modal-title'
        >
          <LeaguePickerCard
            titleId='league-modal-title'
            description={
              <>
                Pick an example below or enter your own league ID from Sleeper (find it in
                your league settings or the league URL).
              </>
            }
            onSelect={(id) => setSelectedLeagueId(id)}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-background-default text-white min-h-screen p-3 flex flex-col justify-center items-center gap-4'>
        <div className='text-xl text-red-500 text-center max-w-lg'>{error}</div>
        <button
          type='button'
          className='text-sm text-gray-400 underline hover:text-white'
          onClick={() => clearStoredLeague()}
        >
          Use a different league ID
        </button>
      </div>
    );
  }

  const leagueStatus = league ? getLeagueStatusInfo(league.status) : null;

  const renderTeamList = () =>
    teamsData.map((team, idx) => (
      <TeamPanel
        key={team.roster.roster_id}
        teamData={team}
        index={idx}
        rosterDetailsPending={false}
        champId={championUserId}
        expandedTeam={expandedTeam}
        onTeamClick={handleTeamClick}
        expandedPlayer={expandedPlayer}
        onPlayerClick={handlePlayerClick}
        playerOwnership={playerOwnership}
      />
    ));

  const researchMetaBanner = () =>
    researchMeta && (
      <div className='mx-3 mb-3 rounded bg-white/3 border border-white/6 p-2 text-xs text-gray-400'>
        <span className='text-gray-300 font-medium'>
          Ownership data: Wk {researchMeta.week} · {researchMeta.season}
        </span>
      </div>
    );

  const standingsHeading = (
    <div className='league-standings-heading text-lg sm:text-2xl font-semibold text-primary-main text-center my-4 sm:my-6'>
      League Standings
    </div>
  );

  return (
    <div className='bg-background-default text-white min-h-screen flex flex-col w-full'>
      {legendOpen && <LegendModal onClose={() => setLegendOpen(false)} />}

      {leaguePickerOpen ? (
        <div
          className='fixed inset-0 z-9999 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]'
          onClick={() => setLeaguePickerOpen(false)}
          role='presentation'
        >
          <div
            role='dialog'
            aria-modal='true'
            aria-labelledby='league-change-modal-title'
            onClick={(ev) => ev.stopPropagation()}
          >
            <LeaguePickerCard
              titleId='league-change-modal-title'
              description={<>Your league ID is saved in this browser.</>}
              onSelect={(id) => {
                setSelectedLeagueId(id);
                setLeaguePickerOpen(false);
              }}
              onClose={() => setLeaguePickerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <header className='border-b border-white/10 bg-[#0d1e2e]'>
        <div className='mx-auto flex w-full max-w-xl flex-col gap-3 px-3 py-4 sm:max-w-2xl sm:gap-4 sm:px-5 sm:py-5 md:max-w-4xl md:px-6 lg:max-w-5xl'>
          <div className='flex flex-col items-center text-center'>
            <div className='min-w-0 max-w-full space-y-2 sm:max-w-[min(100%,28rem)] md:max-w-[min(100%,36rem)]'>
              <h1 className='text-xs font-semibold leading-snug tracking-tight text-white sm:text-sm'>
                Sleeper Dynasty Dashboard
              </h1>
              <div className='space-y-1'>
                {league?.name ? (
                  <div
                    className='text-balance text-base font-semibold text-gray-100 sm:text-lg'
                    title={league.name}
                  >
                    <span className='text-gray-300 font-normal'>League:</span> {league.name}
                  </div>
                ) : null}
                <div className='font-mono text-xs tabular-nums text-gray-400 sm:text-sm'>
                  ID {selectedLeagueId}
                </div>
              </div>
              <div className='flex flex-wrap items-center justify-center gap-2'>
                {leagueStatus && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium sm:text-sm ${leagueStatus.className}`}
                  >
                    {leagueStatus.label}
                  </span>
                )}
                {league?.season && (
                  <span className='inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-300 sm:text-sm'>
                    {league.season} season
                  </span>
                )}
                {league?.total_rosters != null && (
                  <span className='inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-300 sm:text-sm'>
                    {league.total_rosters} teams
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className='flex flex-col items-center gap-3 border-t border-white/10 pt-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-2 sm:gap-y-2 md:gap-x-3'>
            <button
              type='button'
              className='inline-flex w-full max-w-sm items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white sm:w-auto sm:max-w-none sm:text-sm'
              onClick={() => setLegendOpen(true)}
              aria-label='Open legend'
            >
              <InformationCircleIcon className='h-4 w-4 shrink-0' />
              Legend
            </button>
            <button
              type='button'
              className='inline-flex w-full max-w-sm items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white sm:w-auto sm:max-w-none sm:text-sm'
              onClick={() => setLeaguePickerOpen(true)}
            >
              Change league
            </button>
            {/* <button  // !!!!!!!!!!!!!!: only use for development
              type='button'
              className='inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-primary-main px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition-[filter,opacity] hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:w-auto sm:max-w-none sm:px-4 sm:py-2'
              onClick={() => refreshData()}
              disabled={refreshing || loading}
              title='Requests a fresh KTC scrape on the server, then reloads this league’s data'
              aria-label='Refresh KTC Data'
            >
              {refreshing && (
                <span className='inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white' />
              )}
              {refreshing ? 'Refreshing…' : 'Refresh KTC Data'}
            </button> */}
            {/* {!loading && ktcLastUpdated && (
              <p className='w-full max-w-sm text-center text-xs leading-snug text-gray-400 sm:max-w-none sm:basis-full sm:text-sm'>
                KTC last updated{' '}
                <span className='font-medium tabular-nums text-gray-300'>
                  {formatApiInstant(ktcLastUpdated)}
                </span>
              </p>
            )} */}
          </div>
        </div>
      </header>

      <div className='flex-1'>
        {loading ? (
          <div className='flex flex-col justify-center items-center h-[50vh] gap-3'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-main' />
            <div className='text-xl'>Loading league data…</div>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4'>
            <div className='bg-background-paper justify-center rounded-lg'>
              {standingsHeading}
              {researchMetaBanner()}
              {renderTeamList()}
            </div>
          </div>
        )}
      </div>

      <div className='py-3 px-2 mt-auto bg-background-paper/70 text-center'>
        <div className='text-sm text-gray-400'>
          Sleeper Dynasty League Dashboard
          {league?.name ? ` · ${league.name}` : ''} · ID: {selectedLeagueId}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
