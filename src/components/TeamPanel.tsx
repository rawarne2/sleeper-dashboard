import { memo } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { TeamData } from '../types';
import {
  getTeamRecord,
  getPF,
  getPA,
  getMaxPF,
  getPPG,
  getPAG,
  getEff,
} from '../utils/teamStats';
import { RosterTable, OwnershipMap } from './RosterTable';

export const STAT_DESCRIPTIONS: Record<string, string> = {
  PF:    'Points For: total fantasy points your team has scored this season.',
  PA:    'Points Against: total fantasy points scored against your team this season.',
  'PF/G': 'Points For Per Game: average fantasy points scored per week (PF ÷ games played).',
  'PA/G': 'Points Against Per Game: average points allowed per week (PA ÷ games played).',
  Diff:  'Point Differential: Points For minus Points Against. Positive = better than opponents on average.',
  MaxPF: 'Max Potential Points: total points if the optimal starting lineup had been set every week.',
  'Eff%': 'Manager Efficiency: actual points scored vs. maximum possible (PF ÷ Max PF × 100). Higher = better lineup decisions.',
  Waiv:  'Waiver Priority: current waiver claim order. Lower number = higher priority.',
  Moves: 'Total Moves: total number of waiver wire and free agent acquisitions made this season.',
  FAAB:  'FAAB Spent: Free Agent Acquisition Budget dollars spent this season.',
};

export interface TeamPanelProps {
  teamData: TeamData;
  index: number;
  rosterDetailsPending?: boolean;
  champId: string | null;
  expandedTeam: number | null;
  onTeamClick: (rosterId: number) => void;
  expandedPlayer: string | null;
  onPlayerClick: (id: string) => void;
  playerOwnership: OwnershipMap;
}

export const TeamPanel = memo(({
  teamData,
  index,
  rosterDetailsPending = false,
  champId,
  expandedTeam,
  onTeamClick,
  expandedPlayer,
  onPlayerClick,
  playerOwnership,
}: TeamPanelProps) => {
  const { roster, user, starters, bench, reserve } = teamData;
  const s = roster.settings;
  const isChampion = !!champId && user.user_id === champId;

  const diff = Number(getPF(s)) - Number(getPA(s));
  const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(2);
  const diffColor = diff > 0 ? 'text-green-300' : diff < 0 ? 'text-red-300' : 'text-gray-300';

  return (
    <div className='team-paper'>
      <div
        className='p-3 sm:p-4 cursor-pointer flex flex-col gap-1'
        onClick={() => onTeamClick(roster.roster_id)}
      >
        {/* Row 1: rank + avatar + name/username + record + roster button */}
        <div className='flex items-center gap-2'>
          <div className='text-primary-main font-bold min-w-[24px] text-center text-sm sm:text-lg'>
            #{index + 1}
          </div>

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

          <div className='min-w-0 flex-1'>
            <div className='font-bold text-sm sm:text-lg truncate flex items-center gap-1'>
              {isChampion && (
                <TrophyIcon className='w-4 h-4 text-yellow-400 shrink-0' title='League Champion' />
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

          <div className='flex items-center gap-2 shrink-0'>
            <div className='font-bold text-sm sm:text-lg'>{getTeamRecord(s)}</div>
            <button
              className='btn-ghost flex items-center gap-1 px-2 py-1 rounded-md border border-gray-500/70 text-gray-200 hover:border-gray-300 hover:text-white transition-all text-xs font-medium'
              aria-label={expandedTeam === roster.roster_id ? 'Collapse roster' : 'Expand roster'}
              onClick={(e) => { e.stopPropagation(); onTeamClick(roster.roster_id); }}
            >
              {expandedTeam === roster.roster_id ? 'Close' : 'Roster'}
              {expandedTeam === roster.roster_id
                ? <ChevronUpIcon className='w-5 h-5 shrink-0' />
                : <ChevronDownIcon className='w-5 h-5 shrink-0' />
              }
            </button>
          </div>
        </div>

        {/* Row 2: stats grid — 5 cols on mobile (2 even rows), 10 cols on sm+ (1 row) */}
        <div className='mt-2 pt-2 border-t border-gray-600/30 grid grid-cols-5 sm:grid-cols-10 gap-y-2 justify-items-center'>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>PF</span>
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getPF(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>PF/G</span>
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getPPG(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>PA</span>
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getPA(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>PA/G</span>
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getPAG(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>Diff</span>
            <span className={`font-medium tabular-nums text-xs sm:text-sm ${diffColor}`}>{diffStr}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>MaxPF</span>
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getMaxPF(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>Eff%</span>
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getEff(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>Moves</span>
            <span className='text-gray-300 text-xs sm:text-sm tabular-nums'>{s.total_moves ?? '—'}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>FAAB</span>
            <span className='text-gray-300 text-xs sm:text-sm tabular-nums'>${s.waiver_budget_used ?? '—'}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-xs text-gray-400'>Waiv</span>
            <span className='text-gray-300 text-xs sm:text-sm tabular-nums'>{s.waiver_position ?? '—'}</span>
          </div>
        </div>
      </div>

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
              <RosterTable
                starters={starters}
                bench={bench}
                reserve={reserve}
                expandedPlayer={expandedPlayer}
                onPlayerClick={onPlayerClick}
                playerOwnership={playerOwnership}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
});
