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
  StandingsStatColors,
} from '../utils/teamStats';
import { RosterTable, OwnershipMap } from './RosterTable';
import { ColumnHeader } from './playerTable/ColumnHeader';

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
  bundleSeason: string | null;
  leagueSeason: string | null;
  researchWeek: number | null;
  showRedraft: boolean;
  statColors?: StandingsStatColors;
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
  bundleSeason,
  leagueSeason,
  researchWeek,
  showRedraft,
  statColors,
}: TeamPanelProps) => {
  const { roster, user, starters, bench, reserve, taxi } = teamData;
  const s = roster.settings;
  const isChampion = !!champId && user.user_id === champId;

  const diff = Number(getPF(s)) - Number(getPA(s));
  const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(2);
  // League-relative tier when available; otherwise fall back to sign coloring.
  const diffColor =
    statColors?.diff ||
    (diff > 0 ? 'text-green-300' : diff < 0 ? 'text-red-300' : 'text-gray-300');
  const pfColor = statColors?.pf || 'text-gray-100';
  const paColor = statColors?.pa || 'text-gray-100';
  const effColor = statColors?.eff || 'text-gray-100';

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

        {/* Row 2: stats grid — 5 cols on mobile (2 even rows), 10 cols on sm+ (1 row).
            Headers carry click/hover tooltips; stop propagation so pinning a tip
            does not also toggle the roster expand. */}
        <div
          className='mt-2 pt-2 border-t border-gray-600/30 grid grid-cols-5 sm:grid-cols-10 gap-y-2 justify-items-center'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='PF' tooltip='Points For — total points scored' />
            <span className={`font-medium tabular-nums text-xs sm:text-sm ${pfColor}`}>{getPF(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='PF/G' tooltip='Points For per game' />
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getPPG(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='PA' tooltip='Points Against — total points allowed' />
            <span className={`font-medium tabular-nums text-xs sm:text-sm ${paColor}`}>{getPA(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='PA/G' tooltip='Points Against per game' />
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getPAG(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='Diff' tooltip='Point differential (PF − PA)' />
            <span className={`font-medium tabular-nums text-xs sm:text-sm ${diffColor}`}>{diffStr}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='MaxPF' tooltip='Maximum Points For — best possible lineup each week' />
            <span className='text-gray-100 font-medium tabular-nums text-xs sm:text-sm'>{getMaxPF(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='Eff%' tooltip='Lineup efficiency (PF ÷ MaxPF)' />
            <span className={`font-medium tabular-nums text-xs sm:text-sm ${effColor}`}>{getEff(s)}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='FAAB' tooltip='Waiver budget used' />
            <span className='text-gray-300 text-xs sm:text-sm tabular-nums'>${s.waiver_budget_used ?? '—'}</span>
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <ColumnHeader label='Waiv' tooltip='Waiver priority' />
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
              <>
                <RosterTable
                  starters={starters}
                  bench={bench}
                  reserve={reserve}
                  taxi={taxi}
                  expandedPlayer={expandedPlayer}
                  onPlayerClick={onPlayerClick}
                  playerOwnership={playerOwnership}
                  bundleSeason={bundleSeason}
                  leagueSeason={leagueSeason}
                  researchWeek={researchWeek}
                  showRedraft={showRedraft}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
});
