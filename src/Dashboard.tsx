import React, { useEffect, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useLeague } from './useLeague';
import { getLeagueStatusInfo } from './utils/teamStats';
import { formatKtcLastUpdatedDate } from './utils/formatting';
import { TeamPanel } from './components/TeamPanel';
import { LeaguePickerCard } from './components/LeaguePickerCard';
import { LegendModal } from './components/LegendModal';
import { TradeAnalyzerPage } from './pages/TradeAnalyzerPage';
import AllPlayersPage from './pages/AllPlayersPage';

/** Horizontal padding shared by header and tab bar. */
const dashboardShell = 'w-full px-3 sm:px-5 md:px-6';

type DashboardTab = 'standings' | 'all-players' | 'trade-analyzer';

function normalizeDashboardHash(hash: string): DashboardTab {
  const cleaned = (hash || '').trim().replace(/^#/, '').toLowerCase();
  if (cleaned === 'trade-analyzer') return 'trade-analyzer';
  if (cleaned === 'all-players') return 'all-players';
  return 'standings';
}

function setDashboardHash(tab: DashboardTab) {
  const next = `#${tab}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

const metaPillBase =
  'lbl inline-flex max-w-full items-baseline gap-1 rounded-full border border-line-soft px-2 py-0.5 text-[9px] leading-tight sm:px-2.5 sm:py-1 sm:text-[10px]';

function HeaderPill({
  label,
  value,
  className = 'bg-surface-card',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className={`${metaPillBase} ${className}`} title={`${label}: ${value}`}>
      <span className='lbl shrink-0 text-ink-dim'>{label}:</span>
      <span className='truncate text-ink-mid'>{value}</span>
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
            className='flex w-full max-w-2xl gap-1.5 rounded-xl border border-white/10 bg-black/20 p-1.5'
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
              aria-selected={activeTab === 'all-players'}
              className={`${baseBtn} flex-1 ${
                activeTab === 'all-players' ? tabActive : tabInactive
              }`}
              onClick={() => setActiveTab('all-players')}
            >
              All Players
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

  const showStandingsMeta =
    leagueStatus ||
    league?.season ||
    researchWeek != null ||
    league?.total_rosters != null ||
    !loading;

  const standingsMetaChips = showStandingsMeta ? (
    <div
      className={`${dashboardShell} mb-3 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 sm:mb-4`}
      aria-label='League and rankings metadata'
    >
      {leagueStatus && (
        <span className={`${metaPillBase} ${leagueStatus.className}`}>
          {leagueStatus.label}
        </span>
      )}
      {league?.season && <HeaderPill label='League season' value={league.season} />}
      {!loading && researchWeek != null && (
        <span
          className={`${metaPillBase} bg-surface-card text-ink-mid`}
          title={`Sleeper research week ${researchWeek}`}
        >
          <span className='lbl text-ink-dim'>Sleeper week</span>{' '}
          <span>{researchWeek}</span>
        </span>
      )}
      {league?.total_rosters != null && (
        <HeaderPill label='Teams' value={String(league.total_rosters)} />
      )}
      {!loading && (
        <>
          <HeaderPill label='Rankings' value='Consensus · KTC + FantasyCalc' />
          {ktcUpdatedLabel && (
            <HeaderPill label='KTC last updated' value={ktcUpdatedLabel} />
          )}
        </>
      )}
    </div>
  ) : null;

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

      <header className='border-b border-line bg-surface-header'>
        <div className={`${dashboardShell} flex flex-col gap-1 py-2 sm:gap-1.5 sm:py-2.5`}>
          {/* App title */}
          <h1 className='hd text-center text-xs font-semibold tracking-wide text-ink-dim sm:text-sm'>
            Sleeper Dynasty Dashboard
          </h1>

          {/* League info + controls row */}
          <div className='flex flex-col items-center gap-1.5 md:flex-row md:items-center md:justify-between md:gap-3'>
            {/* League name + ID */}
            <div className='min-w-0 text-center md:text-left'>
              {league?.name ? (
                <p className='truncate text-xs leading-tight md:text-sm' title={league.name}>
                  <span className='lbl text-ink-dim'>League:</span>{' '}
                  <span className='font-semibold text-ink-hi'>{league.name}</span>
                </p>
              ) : (
                <p className='text-xs md:text-sm'>
                  <span className='lbl text-ink-dim'>League:</span>{' '}
                  <span className='text-ink-dim'>—</span>
                </p>
              )}
              <p className='num mt-0.5 text-[10px] text-ink-dim md:text-xs'>
                <span className='lbl'>ID:</span>{' '}
                <span>{selectedLeagueId}</span>
              </p>
            </div>

            {/* Legend + Change league */}
            <div className='flex shrink-0 items-center justify-center gap-1 md:justify-end md:gap-1.5'>
              <button
                type='button'
                className='inline-flex items-center justify-center gap-1 rounded-md border border-line-soft px-2 py-1 text-xs font-medium text-ink-mid transition-colors hover:border-line hover:bg-surface-card hover:text-ink-hi sm:px-2.5 sm:py-1.5'
                onClick={() => setLegendOpen(true)}
                aria-label='Open legend'
              >
                <InformationCircleIcon className='h-3.5 w-3.5 shrink-0' />
                <span className='lbl text-[9px] sm:text-[10px]'>Legend</span>
              </button>
              <button
                type='button'
                className='inline-flex items-center justify-center rounded-md border border-line-soft px-2 py-1 text-xs font-medium text-ink-mid transition-colors hover:border-line hover:bg-surface-card hover:text-ink-hi sm:px-2.5 sm:py-1.5'
                onClick={() => setLeaguePickerOpen(true)}
              >
                <span className='lbl text-[9px] sm:text-[10px]'>Change league</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {tabBar}

      <div className='flex-1'>
        {/* All Players is standalone — it must not wait on the league bundle. */}
        {activeTab === 'all-players' ? (
          <div className='bg-background-paper py-4 sm:py-5'>
            <AllPlayersPage />
          </div>
        ) : loading ? (
          <div className='flex flex-col justify-center items-center h-[50vh] gap-3'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-main' />
            <div className='text-xl'>Loading league data…</div>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4'>
            {activeTab === 'standings' ? (
              <div className='bg-background-paper justify-center rounded-lg'>
                <div className='league-standings-heading text-lg sm:text-2xl font-semibold text-primary-main text-center mt-4 mb-2 sm:mt-6 sm:mb-2.5'>
                  League Standings
                </div>
                {standingsMetaChips}
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
