import React, { useEffect, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useLeague } from './useLeague';
import { getLeagueStatusInfo } from './utils/teamStats';
import { formatKtcLastUpdatedDate } from './utils/formatting';
import { TeamPanel } from './components/TeamPanel';
import { LeaguePickerCard } from './components/LeaguePickerCard';
import { LegendModal } from './components/LegendModal';
import { TradeAnalyzerPage } from './pages/TradeAnalyzerPage';

/** Horizontal padding shared by header and tab bar. */
const dashboardShell = 'w-full px-3 sm:px-5 md:px-6';

type DashboardTab = 'standings' | 'trade-analyzer';

function normalizeDashboardHash(hash: string): DashboardTab {
  const cleaned = (hash || '').trim().replace(/^#/, '').toLowerCase();
  if (cleaned === 'trade-analyzer') return 'trade-analyzer';
  return 'standings';
}

function setDashboardHash(tab: DashboardTab) {
  const next = `#${tab}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

const headerPillBase =
  'inline-flex max-w-full items-baseline gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium sm:text-xs';

function HeaderPill({
  label,
  value,
  className = 'bg-white/5',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className={`${headerPillBase} ${className}`} title={`${label}: ${value}`}>
      <span className='shrink-0 text-gray-400'>{label}:</span>
      <span className='truncate text-gray-200'>{value}</span>
    </span>
  );
}

const Dashboard: React.FC = () => {
  const {
    teamsData,
    playerOwnership,
    league,
    researchMeta,
    bundleSeason,
    ktcLastUpdated,
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
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    typeof window === 'undefined'
      ? 'standings'
      : normalizeDashboardHash(window.location.hash)
  );

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(normalizeDashboardHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const normalized = normalizeDashboardHash(window.location.hash);
    if (normalized !== activeTab) {
      setDashboardHash(activeTab);
    }
  }, [activeTab]);

  const baseBtn =
    'inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main';
  const tabActive =
    'bg-primary-main text-white shadow-md ring-2 ring-primary-main/50 scale-[1.02] z-10';
  const tabInactive =
    'bg-[#0b1624] text-gray-400 hover:bg-white/8 hover:text-gray-200';

  const tabBar = (
    <div className='sticky top-0 z-50 border-b border-white/10 bg-[#0d1e2e]'>
      <div className={`${dashboardShell} py-2`}>
        <div className='flex w-full items-center justify-center'>
          <div
            className='flex w-full max-w-md gap-1.5 rounded-xl border border-white/10 bg-black/20 p-1.5'
            role='tablist'
            aria-label='Dashboard views'
          >
            <button
              type='button'
              role='tab'
              aria-selected={activeTab === 'standings'}
              className={`${baseBtn} flex-1 ${
                activeTab === 'standings' ? tabActive : tabInactive
              }`}
              onClick={() => setActiveTab('standings')}
            >
              League Standings
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={activeTab === 'trade-analyzer'}
              className={`${baseBtn} flex-1 ${
                activeTab === 'trade-analyzer' ? tabActive : tabInactive
              }`}
              onClick={() => setActiveTab('trade-analyzer')}
            >
              Trade Analyzer
            </button>
          </div>
        </div>
      </div>
    </div>
  );

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
        bundleSeason={bundleSeason}
        leagueSeason={league?.season ?? null}
        researchWeek={researchMeta?.week ?? null}
      />
    ));

  const researchWeek = researchMeta?.week ?? null;
  const ktcUpdatedLabel = formatKtcLastUpdatedDate(ktcLastUpdated);

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
        <div className={`${dashboardShell} flex flex-col gap-2 py-2.5 sm:py-3`}>
          <h1 className='text-center text-xs font-semibold tracking-tight text-gray-300 sm:text-sm'>
            Sleeper Dynasty Dashboard
          </h1>

          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
            <div className='min-w-0 text-center text-xs sm:text-left sm:text-sm'>
              {league?.name ? (
                <p className='truncate' title={league.name}>
                  <span className='text-gray-400'>League:</span>{' '}
                  <span className='font-semibold text-gray-100'>{league.name}</span>
                </p>
              ) : (
                <p>
                  <span className='text-gray-400'>League:</span>{' '}
                  <span className='text-gray-400'>—</span>
                </p>
              )}
              <p className='mt-0.5 font-mono text-[10px] tabular-nums sm:text-xs'>
                <span className='font-sans text-gray-400'>ID:</span>{' '}
                <span className='text-gray-400'>{selectedLeagueId}</span>
              </p>
            </div>

            <div className='flex shrink-0 items-center justify-center gap-2 sm:justify-end'>
            <button
              type='button'
              className='inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white sm:text-sm'
              onClick={() => setLegendOpen(true)}
              aria-label='Open legend'
            >
              <InformationCircleIcon className='h-4 w-4 shrink-0' />
              Legend
            </button>
            <button
              type='button'
              className='inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white sm:text-sm'
              onClick={() => setLeaguePickerOpen(true)}
            >
              Change league
            </button>
            </div>
          </div>

          {(leagueStatus ||
            league?.season ||
            researchWeek != null ||
            league?.total_rosters != null ||
            !loading) && (
            <div className='flex flex-wrap items-center justify-center gap-1.5 border-t border-white/6 pt-2'>
              {leagueStatus && (
                <span className={`${headerPillBase} ${leagueStatus.className}`}>
                  {leagueStatus.label}
                </span>
              )}
              {league?.season && (
                <HeaderPill label='League season' value={league.season} />
              )}
              {!loading && researchWeek != null && (
                <span
                  className={`${headerPillBase} bg-white/5 text-gray-200`}
                  title={`Sleeper research week ${researchWeek}`}
                >
                  Sleeper week {researchWeek}
                </span>
              )}
              {league?.total_rosters != null && (
                <HeaderPill label='Teams' value={String(league.total_rosters)} />
              )}
              {!loading && (
                <>
                  <HeaderPill
                    label='KTC rankings'
                    value='Superflex · Dynasty · TEP'
                  />
                  {ktcUpdatedLabel && (
                    <HeaderPill label='KTC last updated' value={ktcUpdatedLabel} />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {tabBar}

      <div className='flex-1'>
        {loading ? (
          <div className='flex flex-col justify-center items-center h-[50vh] gap-3'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-main' />
            <div className='text-xl'>Loading league data…</div>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4'>
            {activeTab === 'standings' ? (
              <div className='bg-background-paper justify-center rounded-lg'>
                {standingsHeading}
                {renderTeamList()}
              </div>
            ) : (
              <div className='bg-background-paper py-4 sm:py-5'>
                <TradeAnalyzerPage />
              </div>
            )}
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
