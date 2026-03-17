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
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Player, RosterSettings, TeamData } from './types';
import { useLeague } from './useLeague';
import { API_CONFIG } from './apiConfig';

const { LEAGUES } = API_CONFIG;

// ─── Pure helpers (no hooks — safe to call at module level) ─────────────────

function getLeagueStatusInfo(status: string): { label: string; className: string } {
  switch (status.toLowerCase()) {
    case 'in_season': return { label: 'In Season', className: 'bg-green-600/20 text-green-400 border border-green-600/30' };
    case 'post_season': return { label: 'Playoffs', className: 'bg-purple-600/20 text-purple-400 border border-purple-600/30' };
    case 'pre_draft': return { label: 'Pre-Draft', className: 'bg-blue-600/20 text-blue-400 border border-blue-600/30' };
    case 'drafting': return { label: 'Drafting', className: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' };
    case 'complete': return { label: 'Complete', className: 'bg-gray-600/20 text-gray-400 border border-gray-600/30' };
    default: return { label: status, className: 'bg-gray-600/20 text-gray-400 border border-gray-600/30' };
  }
}

// Returns a text-color class for ownership percentage.
function getOwnershipTier(pct: number): string {
  if (pct >= 90) return 'text-green-400';
  if (pct >= 65) return 'text-blue-400';
  if (pct >= 30) return 'text-yellow-400';
  if (pct >= 8) return 'text-red-400';
  return 'text-gray-500';
}

function formatBirthDate(birthDate: string): string {
  try {
    // Append T00:00:00 to avoid timezone shifting the date
    const d = new Date(birthDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return birthDate;
  }
}

// ─── Stat Label with Tooltip (self-contained, works on all screen sizes) ────

const StatLabel = ({ label, description }: { label: string; description: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className='relative inline-block'>
      <button
        className='btn-ghost inline-flex items-center gap-0.5 text-gray-400 hover:text-gray-200 underline decoration-dotted underline-offset-2 text-xs'
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label={`Info: ${label}`}
      >
        {label}
        <InformationCircleIcon className='w-3 h-3 opacity-50' />
      </button>
      {open && (
        <div
          className='absolute z-50 bottom-full left-0 mb-1 w-56 bg-gray-800 border border-gray-600 rounded-md p-2.5 text-xs text-gray-200 shadow-xl'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='font-semibold mb-1 text-white'>{label}</div>
          {description}
          <button
            className='btn-ghost absolute top-1.5 right-2 text-gray-400 hover:text-white'
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          >
            ✕
          </button>
        </div>
      )}
    </span>
  );
};


// ─── Main Dashboard Component ────────────────────────────────────────────────

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
  console.log(researchMeta);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const handleTeamClick = (rosterId: number) => {
    setExpandedTeam(expandedTeam === rosterId ? null : rosterId);
    setExpandedPlayer(null);
  };

  const handlePlayerClick = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
  };

  // ─── Roster stat helpers ─────────────────────────────────────────────────

  const getTeamRecord = (s: RosterSettings) => {
    const w = s.wins || 0, l = s.losses || 0, t = s.ties || 0;
    return `${w}-${l}${t > 0 ? `-${t}` : ''}`;
  };

  const getGamesPlayed = (s: RosterSettings) =>
    (s.wins || 0) + (s.losses || 0) + (s.ties || 0);

  const getPF = (s: RosterSettings) =>
    ((s.fpts || 0) + (s.fpts_decimal || 0) / 100).toFixed(2);

  const getPA = (s: RosterSettings) =>
    ((s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100).toFixed(2);

  const getMaxPF = (s: RosterSettings) =>
    ((s.ppts || 0) + (s.ppts_decimal || 0) / 100).toFixed(2);

  const getPPG = (s: RosterSettings) => {
    const g = getGamesPlayed(s);
    return g ? (Number(getPF(s)) / g).toFixed(2) : '0.00';
  };

  const getPAG = (s: RosterSettings) => {
    const g = getGamesPlayed(s);
    return g ? (Number(getPA(s)) / g).toFixed(2) : '0.00';
  };

  const getEff = (s: RosterSettings) => {
    const pf = (s.fpts || 0) + (s.fpts_decimal || 0) / 100;
    const pp = (s.ppts || 0) + (s.ppts_decimal || 0) / 100;
    return pp > 0 ? ((pf / pp) * 100).toFixed(1) + '%' : '0.0%';
  };

  // ─── Player helpers ──────────────────────────────────────────────────────

  const formatHeight = (player: Player): string => {
    if (player?.heightFeet != null && player?.heightInches != null) {
      return `${player.heightFeet}'${player.heightInches}"`;
    }
    return 'N/A';
  };

  const renderPlayerChip = (player: Player) => (
    <span className={`player-chip player-chip-${player.position || 'DEF'}`}>
      {player.position || 'N/A'}
    </span>
  );

  // ─── Ownership display ───────────────────────────────────────────────────

  const getOwnershipForPlayer = (playerId: string) => {
    // Look in the players list first (future backend-integrated ownership)
    const player = teamsData
      .find((team) => team.players.some((p) => p.player_id === playerId))
      ?.players.find((p) => p.player_id === playerId);

    if (player?.owned != null) {
      return { owned: player.owned, started: player.started };
    }
    if (playerOwnership[playerId]) {
      return playerOwnership[playerId];
    }
    return null;
  };

  const renderPlayerOwnership = (playerId: string) => {
    const ownershipData = getOwnershipForPlayer(playerId);
    if (!ownershipData) return null;

    const { owned, started } = ownershipData;

    return (
      <div className='flex gap-2.5 shrink-0'>
        <div className='flex flex-col items-center'>
          <span className='text-[9px] uppercase tracking-wide text-gray-500 leading-none mb-0.5'>Own</span>
          <span className={`text-xs font-semibold tabular-nums leading-tight ${getOwnershipTier(owned)}`}>
            {owned}%
          </span>
        </div>
        {started != null && (
          <div className='flex flex-col items-center'>
            <span className='text-[9px] uppercase tracking-wide text-gray-500 leading-none mb-0.5'>Start</span>
            <span className={`text-xs font-semibold tabular-nums leading-tight ${getOwnershipTier(started)}`}>
              {started}%
            </span>
          </div>
        )}
      </div>
    );
  };

  // ─── Player Detail Row ───────────────────────────────────────────────────

  const PlayerDetailRow = memo(({ player }: { player: Player }) => (
    <tr>
      <td colSpan={5} className='p-0 align-top'>
        <div className='player-detail-row'>
          <div className='player-detail-grid'>
            <div className='player-detail-item'>
              <UserIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>
                #{player.number ?? 'N/A'} · {player.team || 'Free Agent'}
              </span>
            </div>

            <div className='player-detail-item'>
              <CalendarIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>
                Exp: {player.years_exp ?? 0} yr{(player.years_exp ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>

            {/* General status — only shown when not Active */}
            {player.status && player.status !== 'Active' && (
              <div className='player-detail-item'>
                <CalendarIcon className='player-detail-icon text-yellow-500' />
                <span className='inline-block bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 text-xs font-medium'>
                  {player.status}
                </span>
              </div>
            )}

            {/* Injury status */}
            {player.injury_status && (
              <div className='player-detail-item'>
                <CalendarIcon className='player-detail-icon text-red-500' />
                <span className='text-sm text-red-400'>
                  Injury: {player.injury_status}
                </span>
              </div>
            )}

            <div className='player-detail-item'>
              <CakeIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>Age: {player.age ?? 'N/A'}</span>
            </div>

            {player.birth_date && (
              <div className='player-detail-item'>
                <CakeIcon className='player-detail-icon text-primary-main' />
                <span className='text-sm'>DOB: {formatBirthDate(player.birth_date)}</span>
              </div>
            )}

            <div className='player-detail-item'>
              <CakeIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>Height: {formatHeight(player)}</span>
            </div>

            <div className='player-detail-item'>
              <CakeIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>Weight: {player.weight ?? 'N/A'} lbs</span>
            </div>

            <div className='player-detail-item'>
              <AcademicCapIcon className='player-detail-icon text-primary-main' />
              <span className='text-sm'>College: {player.college ?? 'N/A'}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  ));

  // ─── Section divider row (used inside the unified roster table) ────────────

  const SectionDivider = ({
    label,
    count,
    isReserve = false,
  }: {
    label: string;
    count: number;
    isReserve?: boolean;
  }) => (
    <tr className='bg-[#0d1a27]'>
      <td
        colSpan={5}
        className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${isReserve ? 'text-red-400/70' : 'text-gray-500'
          }`}
      >
        {label}{' '}
        <span className='font-normal normal-case tracking-normal text-gray-600'>
          ({count})
        </span>
      </td>
    </tr>
  );

  // ─── Player Row ──────────────────────────────────────────────────────────


  const PlayerRow = memo(
    ({ player, isReserve = false }: { player: Player; isReserve?: boolean }) => (
      <React.Fragment>
        <tr
          className={`hover:bg-white/4 cursor-pointer border-b border-white/5 transition-colors ${isReserve ? 'border-l-2 border-l-red-500/50' : ''
            }`}
          onClick={() => player.player_id && handlePlayerClick(player.player_id)}
        >
          {/* Pos chip + Player name + ownership inline */}
          <td className='p-2 align-middle bg-white/[0.012]'>
            <div className='flex items-center gap-2'>
              <div className='shrink-0'>{renderPlayerChip(player)}</div>
              <span className='text-sm font-medium text-gray-100 leading-tight min-w-0 truncate flex-1'>
                {player.first_name} {player.last_name}
              </span>
              {player.player_id && renderPlayerOwnership(player.player_id)}
            </div>
          </td>

          {/* KTC value */}
          <td className='p-2 w-[56px] text-right align-middle'>
            <span className='text-sm tabular-nums text-gray-100'>
              {player.ktc?.superflexValues?.tep?.value ?? '—'}
            </span>
          </td>

          {/* Rank: positional + overall */}
          <td className='p-2 w-[72px] text-center align-middle bg-white/[0.018]'>
            <div className='text-xs leading-snug'>
              <div className='text-gray-100'>
                {player.position}{' '}
                {player.ktc?.superflexValues?.tep?.positionalRank ?? '—'}
              </div>
              <div className='text-gray-500'>
                OVR {player.ktc?.superflexValues?.tep?.rank ?? '—'}
              </div>
            </div>
          </td>

          {/* Tier: positional + overall — same format as Rank */}
          <td className='p-2 w-[72px] text-center align-middle'>
            <div className='text-xs leading-snug'>
              <div className='text-gray-100'>
                {player.position} T{player.ktc?.superflexValues?.tep?.positionalTier ?? '—'}
              </div>
              <div className='text-gray-500'>
                OVR T{player.ktc?.superflexValues?.tep?.overallTier ?? '—'}
              </div>
            </div>
          </td>

          {/* Expand toggle */}
          <td className='p-1.5 w-8 align-middle text-right'>
            {expandedPlayer === player.player_id
              ? <ChevronUpIcon className='h-5 w-5 text-gray-400 inline' />
              : <ChevronDownIcon className='h-5 w-5 text-gray-400 inline' />
            }
          </td>
        </tr>
        {expandedPlayer === player.player_id && <PlayerDetailRow player={player} />}
      </React.Fragment>
    )
  );

  // ─── Unified Roster Table — one header, section-divider rows ─────────────

  const RosterTable = memo(
    ({
      starters,
      bench,
      reserve,
    }: {
      starters: Player[];
      bench: Player[];
      reserve: Player[];
    }) => (
      <div className='rounded-md overflow-x-scroll border border-white/[0.07]'>
        <table className='w-full border-collapse'>
          <thead className='sticky top-0 z-10 bg-[#0d1e2e]'>
            <tr className='border-b border-white/8'>
              <th className='p-2 text-xs font-medium text-left text-gray-500 bg-white/[0.012]'>Player</th>
              <th className='p-2 w-[56px] text-xs font-medium text-right text-gray-500'>KTC</th>
              <th className='p-2 w-[72px] text-xs font-medium text-center text-gray-500 bg-white/[0.018]'>Rank</th>
              <th className='p-2 w-[72px] text-xs font-medium text-center text-gray-500'>Tier</th>
              <th className='w-6'></th>
            </tr>
          </thead>
          <tbody>
            <SectionDivider label='Starters' count={starters.length} />
            {starters.map((p) => (
              <PlayerRow key={p.player_id} player={p} />
            ))}
            <SectionDivider label='Bench' count={bench.length} />
            {bench.map((p) => (
              <PlayerRow key={p.player_id} player={p} />
            ))}
            {reserve.length > 0 && (
              <>
                <SectionDivider label='Reserve / IR' count={reserve.length} isReserve />
                {reserve.map((p) => (
                  <PlayerRow key={p.player_id} player={p} isReserve />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    )
  );

  // ─── Team Panel ──────────────────────────────────────────────────────────

  const STAT_TOOLTIPS: Record<string, string> = {
    PF: 'Points For: total fantasy points your team has scored this season.',
    PA: 'Points Against: total fantasy points scored against your team this season.',
    'PF/G': 'Points For Per Game: average fantasy points scored per week (PF ÷ games played).',
    'PA/G': 'Points Against Per Game: average points allowed per week (PA ÷ games played).',
    Diff: 'Point Differential: Points For minus Points Against. Positive = better than opponents on average.',
    MaxPF: 'Max Potential Points: total points if the optimal starting lineup had been set every week.',
    'Eff%': 'Manager Efficiency: actual points scored vs. maximum possible (PF ÷ Max PF × 100). Higher = better lineup decisions.',
    Waiv: 'Waiver Priority: current waiver claim order. Lower number = higher priority.',
    Moves: 'Total Moves: total number of waiver wire and free agent acquisitions made this season.',
    FAAB: 'FAAB Spent: Free Agent Acquisition Budget dollars spent this season.',
  };

  const TeamPanel = memo(
    ({
      teamData,
      index,
      rosterDetailsPending = false,
      champId,
    }: {
      teamData: TeamData;
      index: number;
      rosterDetailsPending?: boolean;
      champId: string | null;
    }) => {
      const { roster, user, starters, bench, reserve } = teamData;
      const s = roster.settings;
      const isChampion = !!champId && user.user_id === champId;

      const diff = Number(getPF(s)) - Number(getPA(s));
      const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(2);
      const diffColor = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';

      return (
        <div className='team-paper'>
          {/* ── Clickable Header ── */}
          <div
            className='p-3 sm:p-4 cursor-pointer flex flex-col gap-1'
            onClick={() => handleTeamClick(roster.roster_id)}
          >
            {/* Row 1: Identity + Record + Chevron */}
            <div className='flex items-center gap-2'>
              {/* Rank */}
              <div className='text-primary-main font-bold min-w-[24px] text-center text-base sm:text-lg'>
                #{index + 1}
              </div>

              {/* Avatar */}
              <div className='w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-background-hover shrink-0 overflow-hidden'>
                {user.avatar ? (
                  <img
                    alt={user.display_name}
                    src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center text-gray-400 text-xs'>N/A</div>
                )}
              </div>

              {/* Name + Username */}
              <div className='min-w-0 flex-1'>
                <div className='font-bold text-base sm:text-lg truncate flex items-center gap-1'>
                  {isChampion && (
                    <TrophyIcon
                      className='w-4 h-4 text-yellow-400 shrink-0'
                      title='League Champion'
                    />
                  )}
                  {user.metadata?.team_name || user.display_name}
                </div>
                <div className='text-xs sm:text-sm text-gray-400 truncate flex items-center gap-1 flex-wrap'>
                  {user.username}
                  {user.is_owner && (
                    <span className='bg-primary-light/20 text-primary-light rounded-full px-1.5 py-0.5 text-xs whitespace-nowrap'>
                      Commish
                    </span>
                  )}
                </div>
              </div>

              {/* Record + Roster button */}
              <div className='flex items-center gap-2 shrink-0'>
                <div className='font-bold text-base sm:text-lg'>{getTeamRecord(s)}</div>
                <button
                  className='btn-ghost flex items-center gap-1 px-2 py-1 rounded-md border border-gray-500/70 text-gray-200 hover:border-gray-300 hover:text-white transition-all text-xs font-medium'
                  aria-label={expandedTeam === roster.roster_id ? 'Collapse roster' : 'Expand roster'}
                  onClick={(e) => { e.stopPropagation(); handleTeamClick(roster.roster_id); }}
                >
                  {expandedTeam === roster.roster_id ? 'Close' : 'Roster'}
                  {expandedTeam === roster.roster_id
                    ? <ChevronUpIcon className='w-5 h-5 shrink-0' />
                    : <ChevronDownIcon className='w-5 h-5 shrink-0' />
                  }
                </button>
              </div>
            </div>

            {/* Row 2: Scoring stats — each label sits directly above its value */}
            <div className='mt-2 pt-2 border-t border-gray-600/30 flex flex-wrap gap-x-5 justify-evenly'>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='PF' description={STAT_TOOLTIPS.PF} />
                <span className='text-gray-100 font-medium tabular-nums text-sm'>{getPF(s)}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='PF/G' description={STAT_TOOLTIPS['PF/G']} />
                <span className='text-gray-100 font-medium tabular-nums text-sm'>{getPPG(s)}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='PA' description={STAT_TOOLTIPS.PA} />
                <span className='text-gray-100 font-medium tabular-nums text-sm'>{getPA(s)}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='PA/G' description={STAT_TOOLTIPS['PA/G']} />
                <span className='text-gray-100 font-medium tabular-nums text-sm'>{getPAG(s)}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='Diff' description={STAT_TOOLTIPS.Diff} />
                <span className={`font-medium tabular-nums text-sm ${diffColor}`}>{diffStr}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='MaxPF' description={STAT_TOOLTIPS.MaxPF} />
                <span className='text-gray-100 font-medium tabular-nums text-sm'>{getMaxPF(s)}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='Eff%' description={STAT_TOOLTIPS['Eff%']} />
                <span className='text-gray-100 font-medium tabular-nums text-sm'>{getEff(s)}</span>
              </div>

              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='Moves' description={STAT_TOOLTIPS.Moves} />
                <span className='text-gray-300 text-sm tabular-nums'>{s.total_moves ?? '—'}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='FAAB' description={STAT_TOOLTIPS.FAAB} />
                <span className='text-gray-300 text-sm tabular-nums'>${s.waiver_budget_used ?? '—'}</span>
              </div>
              <div className='flex flex-col items-center gap-0.5'>
                <StatLabel label='Waiv' description={STAT_TOOLTIPS.Waiv} />
                <span className='text-gray-300 text-sm tabular-nums'>{s.waiver_position ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* ── Expanded Roster ── */}
          {expandedTeam === roster.roster_id && (
            <>
              <div className='border-t border-border-subtle' />
              <div className='p-2 sm:p-4'>
                {rosterDetailsPending ? (
                  <div className='flex flex-col items-center justify-center py-8 text-gray-400 gap-2'>
                    <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-main' />
                    <p className='text-sm text-center max-w-sm'>
                      Loading KTC rankings to show starters and bench…
                    </p>
                  </div>
                ) : (
                  <>
                    <RosterTable starters={starters} bench={bench} reserve={reserve} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      );
    }
  );

  // ─── Render ──────────────────────────────────────────────────────────────

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
      />
    ));

  return (
    <div className='bg-background-default text-white min-h-screen flex flex-col w-full'>
      {/* ── Header ── */}
      <div className='top-0 z-10 shadow-md bg-linear-to-r from-gradient-start to-gradient-end'>
        <div className='p-3 sm:p-4 my-2 sm:my-1 bg-gray-700 text-white rounded-lg flex flex-col gap-2'>
          {/* Title + league meta pills */}
          <div className='flex items-center justify-between flex-wrap gap-2'>
            <div className='flex items-center gap-2'>
              <TrophyIcon className='w-6 h-6' />
              <div className='text-xl font-semibold'>Sleeper Dynasty Dashboard</div>
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
              <div className='text-2xl font-semibold text-primary-main text-center my-6'>
                League Standings
              </div>
              {researchMeta && (
                <div className='mx-3 mb-3 px-3 py-2 rounded bg-white/3 border border-white/6 text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5'>
                  <span className='text-gray-600 font-medium'>Ownership data:</span>
                  <span>Wk {researchMeta.week}</span>
                  <span className='text-gray-700'>·</span>
                  <span>{researchMeta.season}</span>
                  <span className='text-gray-700'>·</span>
                  <span>{researchMeta.league_type?.toString()}</span>
                  <span className='text-gray-700'>·</span>
                  <span>
                    Updated{' '}
                    {new Date(researchMeta.last_updated).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              <div className='flex items-center justify-center gap-2 px-4 pb-4 text-sm text-gray-400'>
                <div className='animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-main shrink-0' />
                <span>
                  Loading KTC player data in background — expand a team after it finishes to see rosters.
                </span>
              </div>
              {renderTeamList(teamsDataPreview, true)}
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4'>
            <div className='bg-background-paper justify-center rounded-lg'>
              <div className='text-2xl font-semibold text-primary-main text-center my-6'>
                League Standings
              </div>
              {researchMeta && (
                <div className='mx-3 mb-3 p-2 rounded bg-white/3 border border-white/6 text-xs text-gray-500 flex flex-wrap items-center'>
                  <span className='text-gray-600 font-medium flex-1 justify-self-start'>Ownership data: Wk {researchMeta.week} · {researchMeta.season} · {researchMeta.league_type?.toString()}</span>
                  <span className='flex-1 justify-self-end'>
                    Last Updated: {' '}
                    {new Date(researchMeta.last_updated).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
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
