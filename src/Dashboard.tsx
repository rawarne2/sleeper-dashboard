import React, { useEffect, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useLeague } from './useLeague';
import { LeaguePickerCard } from './components/LeaguePickerCard';
import { LegendModal } from './components/LegendModal';
import { TradeAnalyzerPage } from './pages/TradeAnalyzerPage';
import AllPlayersPage from './pages/AllPlayersPage';
import LeagueStandingsPage from './pages/LeagueStandingsPage';

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

const Dashboard: React.FC = () => {
  const {
    league,
    loading,
    error,
    leagueIdReady,
    selectedLeagueId,
    setSelectedLeagueId,
    clearStoredLeague,
  } = useLeague();

  const [legendOpen, setLegendOpen] = useState(false);
  const [leaguePickerOpen, setLeaguePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    typeof window === 'undefined'
      ? 'standings'
      : normalizeDashboardHash(window.location.hash)
  );
  const [visited, setVisited] = useState<Set<DashboardTab>>(() => new Set([
    typeof window === 'undefined'
      ? 'standings'
      : normalizeDashboardHash(window.location.hash)
  ]));
  // Mark a tab visited (so it stays mounted) and activate it. Updating `visited`
  // here — in event/callback paths rather than a standalone effect — avoids the
  // synchronous-setState-in-effect cascade lint and keeps state preserved across switches.
  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setVisited((c) => (c.has(tab) ? c : new Set(c).add(tab)));
  };

  useEffect(() => {
    const onHashChange = () => {
      const next = normalizeDashboardHash(window.location.hash);
      setActiveTab(next);
      setVisited((c) => (c.has(next) ? c : new Set(c).add(next)));
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
              onClick={() => selectTab('standings')}
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
              onClick={() => selectTab('all-players')}
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
              onClick={() => selectTab('trade-analyzer')}
            >
              Trade Analyzer
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!leagueIdReady) {
    return (
      <div className='bg-surface-base text-white min-h-screen p-3 flex flex-col justify-center items-center gap-3'>
        <div className='animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-main' />
        <div className='text-gray-300'>Loading saved preferences…</div>
      </div>
    );
  }

  if (!selectedLeagueId) {
    return (
      <div className='bg-surface-base text-white min-h-screen relative'>
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
      <div className='bg-surface-base text-white min-h-screen p-3 flex flex-col justify-center items-center gap-4'>
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

  return (
    <div className='bg-surface-base text-white min-h-screen flex flex-col w-full'>
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
          <h1 className='hd text-center text-base font-semibold tracking-wide text-ink-hi sm:text-lg'>
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
                className='inline-flex items-center justify-center gap-1 rounded-md border border-line-soft px-2 py-1 text-xs font-medium text-ink-hi transition-colors hover:border-line hover:bg-surface-card hover:text-ink-hi sm:px-2.5 sm:py-1.5'
                onClick={() => setLegendOpen(true)}
                aria-label='Open legend'
              >
                <InformationCircleIcon className='h-3.5 w-3.5 shrink-0' />
                <span className='lbl text-[10px] sm:text-[11px]'>Legend</span>
              </button>
              <button
                type='button'
                className='inline-flex items-center justify-center rounded-md border border-line-soft px-2 py-1 text-xs font-medium text-ink-hi transition-colors hover:border-line hover:bg-surface-card hover:text-ink-hi sm:px-2.5 sm:py-1.5'
                onClick={() => setLeaguePickerOpen(true)}
              >
                <span className='lbl text-[10px] sm:text-[11px]'>Change league</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {tabBar}

      <div className='flex-1'>
        {visited.has('all-players') && (
          <div className={activeTab === 'all-players' ? 'bg-surface-raised py-4 sm:py-5' : 'hidden'}>
            <AllPlayersPage />
          </div>
        )}
        {visited.has('standings') && (
          <div className={activeTab === 'standings' ? 'block' : 'hidden'}>
            {loading ? (
              <div className='flex flex-col justify-center items-center h-[50vh] gap-3'>
                <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-main' />
                <div className='text-xl'>Loading league data…</div>
              </div>
            ) : (<div className='grid grid-cols-1 gap-4'><LeagueStandingsPage /></div>)}
          </div>
        )}
        {visited.has('trade-analyzer') && (
          <div className={activeTab === 'trade-analyzer' ? 'bg-surface-raised py-4 sm:py-5' : 'hidden'}>
            {loading ? (
              <div className='flex flex-col justify-center items-center h-[50vh] gap-3'>
                <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-main' />
                <div className='text-xl'>Loading league data…</div>
              </div>
            ) : (<TradeAnalyzerPage />)}
          </div>
        )}
      </div>

      <div className='py-3 px-2 mt-auto bg-surface-raised/70 text-center'>
        <div className='text-sm text-gray-400'>
          Sleeper Dynasty League Dashboard
          {league?.name ? ` · ${league.name}` : ''} · ID: {selectedLeagueId}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
