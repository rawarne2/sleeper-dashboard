// src/Dashboard.tsx — main shell: state, handlers, and page-level render only.
import React, { useState } from 'react';
import { TrophyIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useLeague } from './useLeague';
import { API_CONFIG } from './apiConfig';
import { getLeagueStatusInfo } from './utils/teamStats';
import { TeamPanel, STAT_DESCRIPTIONS } from './components/TeamPanel';
import { TeamData } from './types';

const { LEAGUES } = API_CONFIG;

const POSITIONS = [
  { pos: 'QB', bg: 'bg-red-500',    label: 'Quarterback' },
  { pos: 'RB', bg: 'bg-green-500',  label: 'Running Back' },
  { pos: 'WR', bg: 'bg-blue-500',   label: 'Wide Receiver' },
  { pos: 'TE', bg: 'bg-amber-500',  label: 'Tight End' },
  { pos: 'K',  bg: 'bg-purple-500', label: 'Kicker' },
  { pos: 'DEF', bg: 'bg-cyan-500',  label: 'Defense' },
];

const OWNERSHIP_TIERS = [
  { color: 'text-green-300',  range: '≥ 90%', label: 'Very High' },
  { color: 'text-blue-300',   range: '65–89%', label: 'High' },
  { color: 'text-yellow-300', range: '30–64%', label: 'Mid' },
  { color: 'text-red-300',    range: '8–29%',  label: 'Low' },
  { color: 'text-gray-400',   range: '< 8%',   label: 'Fringe' },
];

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
    teamsDataPreview,
    playerOwnership,
    league,
    researchMeta,
    championUserId,
    loading,
    playersLoading,
    error,
    selectedLeagueId,
    setSelectedLeagueId,
  } = useLeague();

  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const handleTeamClick = (rosterId: number) => {
    setExpandedTeam(expandedTeam === rosterId ? null : rosterId);
    setExpandedPlayer(null);
  };

  const handlePlayerClick = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className='bg-background-default text-white min-h-screen p-3 flex justify-center items-center'>
        <div className='text-xl text-red-500'>{error}</div>
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
      <div className={`mx-3 mb-3 rounded bg-white/3 border border-white/6 text-xs text-gray-400 flex flex-wrap items-center gap-x-2 ${compact ? 'px-3 py-2 gap-y-0.5' : 'p-2'}`}>
        <span className='text-gray-300 font-medium'>
          Ownership data: Wk {researchMeta.week} · {researchMeta.season} · {researchMeta.league_type?.toString()}
        </span>
        <span className='text-gray-500'>·</span>
        <span>
          Last updated:{' '}
          {new Date(researchMeta.last_updated).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
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
                className='btn-ghost flex items-center gap-1 text-xs text-gray-300 hover:text-white border border-gray-500/50 hover:border-gray-300 rounded-full px-2 py-0.5 transition-colors'
                onClick={() => setLegendOpen(true)}
                aria-label='Open legend'
              >
                <InformationCircleIcon className='w-4 h-4' />
                Legend
              </button>
            </div>
          </div>

          {/* League selector */}
          <div className='flex items-center gap-2'>
            <label htmlFor='league-select' className='text-sm font-medium whitespace-nowrap'>
              League:
            </label>
            <select
              id='league-select'
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className='bg-gray-600 text-white border border-gray-500 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-main'
            >
              {LEAGUES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
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
        ) : playersLoading ? (
          <div className='grid grid-cols-1 gap-4'>
            <div className='bg-background-paper justify-center rounded-lg'>
              {standingsHeading}
              {researchMetaBanner(true)}
              <div className='flex items-center justify-center gap-2 px-4 pb-4 text-sm text-gray-400'>
                <div className='animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-main shrink-0' />
                <span>Loading KTC player data in background — expand a team after it finishes to see rosters.</span>
              </div>
              {renderTeamList(teamsDataPreview, true)}
            </div>
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
          Sleeper Dynasty League Dashboard •{' '}
          {LEAGUES.find((l) => l.id === selectedLeagueId)?.label} •
          ID: {selectedLeagueId}
        </div>
      </div>
    </div>
  );
};

export default DynastyDashboardV2;
