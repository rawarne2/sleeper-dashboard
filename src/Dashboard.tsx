import React, { useState } from 'react';
import { TrophyIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useLeague } from './useLeague';
import { API_CONFIG } from './apiConfig';
import { getLeagueStatusInfo } from './utils/teamStats';
import { TeamPanel, STAT_DESCRIPTIONS } from './components/TeamPanel';
import { TeamData } from './types';

const { EXAMPLE_LEAGUE_ID, EXAMPLE_LEAGUES } = API_CONFIG;

const LEAGUE_ID_PATTERN = /^\d{10,24}$/;

const POSITIONS = [
  { pos: 'QB', bg: 'bg-red-500', label: 'Quarterback' },
  { pos: 'RB', bg: 'bg-green-500', label: 'Running Back' },
  { pos: 'WR', bg: 'bg-blue-500', label: 'Wide Receiver' },
  { pos: 'TE', bg: 'bg-amber-500', label: 'Tight End' },
  { pos: 'K', bg: 'bg-purple-500', label: 'Kicker' },
  { pos: 'DEF', bg: 'bg-cyan-500', label: 'Defense' },
];

const OWNERSHIP_TIERS = [
  { color: 'text-green-300', range: '≥ 90%', label: 'Very High' },
  { color: 'text-blue-300', range: '65–89%', label: 'High' },
  { color: 'text-yellow-300', range: '30–64%', label: 'Mid' },
  { color: 'text-red-300', range: '8–29%', label: 'Low' },
  { color: 'text-gray-400', range: '< 8%', label: 'Fringe' },
];

function formatDashboardDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const LegendModal = ({ onClose }: { onClose: () => void }) => (
  <div
    className='fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60'
    onClick={onClose}
  >
    <div
      className='relative bg-[#0d1e2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5'
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className='btn-ghost absolute top-3 right-3 text-gray-400 hover:text-white'
        onClick={onClose}
        aria-label='Close legend'
      >
        <XMarkIcon className='w-5 h-5' />
      </button>

      <h2 className='text-base sm:text-lg font-bold text-white mb-4'>Dashboard Legend</h2>

      {/* Team Stats */}
      <section className='mb-5'>
        <h3 className='text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2'>Team Stats</h3>
        <div className='grid grid-cols-1 gap-1.5'>
          {Object.entries(STAT_DESCRIPTIONS).map(([key, desc]) => (
            <div key={key} className='flex gap-2 text-xs sm:text-sm'>
              <span className='shrink-0 font-bold text-gray-100 w-10 text-right'>{key}</span>
              <span className='text-gray-300'>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Position Colors */}
      <section className='mb-5'>
        <h3 className='text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2'>Position Colors</h3>
        <div className='flex flex-wrap gap-2'>
          {POSITIONS.map(({ pos, bg, label }) => (
            <div key={pos} className='flex items-center gap-1.5 text-xs sm:text-sm'>
              <span className={`${bg} text-white rounded-full px-2 py-0.5 font-medium text-xs min-w-[42px] text-center`}>{pos}</span>
              <span className='text-gray-300'>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Ownership Tier Colors */}
      <section>
        <h3 className='text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2'>Ownership % Colors</h3>
        <div className='flex flex-col gap-1'>
          {OWNERSHIP_TIERS.map(({ color, range, label }) => (
            <div key={range} className='flex items-center gap-2 text-xs sm:text-sm'>
              <span className={`${color} font-semibold tabular-nums w-14 shrink-0`}>{range}</span>
              <span className='text-gray-300'>{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);

const DynastyDashboardV2: React.FC = () => {
  const {
    teamsData,
    playerOwnership,
    league,
    researchMeta,
    ktcLastUpdated,
    championUserId,
    loading,
    refreshing,
    error,
    leagueIdReady,
    selectedLeagueId,
    setSelectedLeagueId,
    clearStoredLeague,
    refreshData,
  } = useLeague();

  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [draftLeagueId, setDraftLeagueId] = useState('');
  const [idError, setIdError] = useState<string | null>(null);

  const handleTeamClick = (rosterId: number) => {
    setExpandedTeam(expandedTeam === rosterId ? null : rosterId);
    setExpandedPlayer(null);
  };

  const handlePlayerClick = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!leagueIdReady) {
    return (
      <div className='bg-background-default text-white min-h-screen p-3 flex flex-col justify-center items-center gap-3'>
        <div className='animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-main' />
        <div className='text-gray-300'>Loading saved preferences…</div>
      </div>
    );
  }

  if (!selectedLeagueId) {
    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = draftLeagueId.trim();
      if (!LEAGUE_ID_PATTERN.test(trimmed)) {
        setIdError('Enter a numeric Sleeper league ID (from the league URL or settings).');
        return;
      }
      setIdError(null);
      setSelectedLeagueId(trimmed);
    };

    return (
      <div className='bg-background-default text-white min-h-screen relative'>
        <div className='absolute inset-0 bg-black/55 backdrop-blur-[2px]' aria-hidden />
        <div
          className='relative z-10 min-h-screen flex items-center justify-center p-4'
          role='dialog'
          aria-modal='true'
          aria-labelledby='league-modal-title'
        >
          <div
            className='w-full max-w-md rounded-xl border border-gray-500/40 bg-[#0f1729] p-6 shadow-2xl ring-1 ring-white/10'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center gap-2 mb-4'>
              <TrophyIcon className='w-8 h-8 text-primary-main shrink-0' />
              <h1 id='league-modal-title' className='text-xl font-semibold'>
                Sleeper Dynasty Dashboard
              </h1>
            </div>
            <p className='text-sm text-gray-400 mb-4'>
              Your league ID is saved in this browser (IndexedDB). Pick an example below or paste your
              own from Sleeper (League Settings or the league URL).
            </p>
            <form onSubmit={onSubmit} className='flex flex-col gap-3'>
              <label htmlFor='example-league-select' className='text-sm font-medium text-gray-300'>
                Example leagues
              </label>
              <select
                id='example-league-select'
                value={EXAMPLE_LEAGUES.some((l) => l.id === draftLeagueId) ? draftLeagueId : ''}
                onChange={(ev) => {
                  const v = ev.target.value;
                  setDraftLeagueId(v);
                  setIdError(null);
                }}
                className='bg-gray-800 text-white border border-gray-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-main'
              >
                <option value=''>Choose an example…</option>
                {EXAMPLE_LEAGUES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} · {l.id}
                  </option>
                ))}
              </select>
              <label htmlFor='league-id-input' className='text-sm font-medium text-gray-300'>
                Or enter league ID
              </label>
              <input
                id='league-id-input'
                type='text'
                inputMode='numeric'
                autoComplete='off'
                placeholder={EXAMPLE_LEAGUE_ID}
                value={draftLeagueId}
                onChange={(ev) => {
                  setDraftLeagueId(ev.target.value);
                  setIdError(null);
                }}
                className='bg-gray-800 text-white border border-gray-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-main font-mono'
              />
              {idError && <p className='text-sm text-red-400'>{idError}</p>}
              <button
                type='submit'
                className='mt-1 rounded-lg bg-primary-main text-white py-2.5 px-4 text-sm font-semibold shadow-md hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary-main focus:ring-offset-2 focus:ring-offset-[#0f1729]'
              >
                Load league
              </button>
            </form>
          </div>
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

  const renderTeamList = (teams: TeamData[], pending: boolean) =>
    teams.map((team, idx) => (
      <TeamPanel
        key={team.roster.roster_id}
        teamData={team}
        index={idx}
        rosterDetailsPending={pending}
        champId={championUserId}
        expandedTeam={expandedTeam}
        onTeamClick={handleTeamClick}
        expandedPlayer={expandedPlayer}
        onPlayerClick={handlePlayerClick}
        playerOwnership={playerOwnership}
      />
    ));

  const researchMetaBanner = (compact = false) =>
    researchMeta && (
      <div className={`mx-3 mb-3 rounded bg-white/3 border border-white/6 text-xs text-gray-400 flex flex-wrap items-center justify-between gap-x-2 ${compact ? 'px-3 py-2 gap-y-0.5' : 'p-2'}`}>
        <span className='text-gray-300 font-medium'>
          Ownership data: Wk {researchMeta.week} · {researchMeta.season}
        </span>
        <span>
          Last updated:{' '}
          {formatDashboardDateTime(researchMeta.last_updated)}
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

      {/* ── Header ── */}
      <div className='top-0 z-10 shadow-md bg-linear-to-r from-gradient-start to-gradient-end'>
        <div className='p-3 sm:p-4 my-2 sm:my-1 bg-gray-700 text-white rounded-lg flex flex-col gap-2'>
          {/* Title + league meta pills */}
          <div className='flex items-center justify-between flex-wrap gap-2'>
            <div className='flex items-center gap-2'>
              <TrophyIcon className='w-6 h-6' />
              <div className='text-base sm:text-xl font-semibold'>Sleeper Dynasty Dashboard</div>
            </div>
            <div className='flex items-center gap-2 flex-wrap'>
              {leagueStatus && (
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${leagueStatus.className}`}>
                  {leagueStatus.label}
                </span>
              )}
              {league?.total_rosters != null && (
                <span className='text-xs rounded-full px-2 py-0.5 bg-gray-600/40 text-gray-300 border border-gray-500/30'>
                  {league.total_rosters} Teams
                </span>
              )}
              <button
                type='button'
                className='btn-ghost flex items-center gap-1 text-xs text-gray-300 hover:text-white border border-gray-500/50 hover:border-gray-300 rounded-full px-2 py-0.5 transition-colors disabled:opacity-50'
                onClick={() => setLegendOpen(true)}
                aria-label='Open legend'
              >
                <InformationCircleIcon className='w-4 h-4' />
                Legend
              </button>
              <div className='flex flex-col items-end gap-1 shrink-0'>
                <button
                  type='button'
                  className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary-main px-4 py-2 text-sm font-semibold text-white shadow-md ring-1 ring-white/10 transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45'
                  onClick={() => refreshData()}
                  disabled={refreshing || loading}
                  title='Requests a fresh KTC scrape on the server, then reloads this league’s data'
                  aria-label='Refresh KTC Data'
                >
                  {refreshing && (
                    <span className='inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white' />
                  )}
                  {refreshing ? 'Refreshing…' : 'Refresh KTC Data'}
                </button>
                {!loading && (
                  <p className='text-xs sm:text-sm text-gray-400 text-right max-w-[min(100%,14rem)] leading-tight'>
                    Last updated:{' '}
                    <span className='text-gray-300 tabular-nums'>
                      {ktcLastUpdated ? formatDashboardDateTime(ktcLastUpdated) : '—'}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2 text-sm text-gray-300'>
            <span className='font-mono text-gray-200'>League ID: {selectedLeagueId}</span>
            {league?.name && (
              <span className='text-gray-400 truncate max-w-[min(100%,12rem)] sm:max-w-md'>
                · {league.name}
              </span>
            )}
            <button
              type='button'
              className='ml-auto text-xs text-gray-400 hover:text-white underline'
              onClick={() => clearStoredLeague()}
            >
              Change league
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
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
              {renderTeamList(teamsData, false)}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className='py-3 px-2 mt-auto bg-background-paper/70 text-center'>
        <div className='text-sm text-gray-400'>
          Sleeper Dynasty League Dashboard
          {league?.name ? ` · ${league.name}` : ''} · ID: {selectedLeagueId}
        </div>
      </div>
    </div>
  );
};

export default DynastyDashboardV2;
