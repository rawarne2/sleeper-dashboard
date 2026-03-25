import React, { memo } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  UserIcon,
  AcademicCapIcon,
  CalendarIcon,
  CakeIcon,
} from '@heroicons/react/24/outline';
import { Player } from '../types';
import { formatBirthDate, formatHeight, getOwnershipTier } from '../utils/teamStats';

export type OwnershipMap = Record<string, { owned: number; started?: number }>;

function resolveOwnership(player: Player, ownershipMap: OwnershipMap) {
  if (player.owned != null) return { owned: player.owned, started: player.started ?? null };
  if (player.player_id && ownershipMap[player.player_id]) {
    const o = ownershipMap[player.player_id];
    return { owned: o.owned, started: o.started ?? null };
  }
  return null;
}

const PositionChip = ({ player }: { player: Player }) => (
  <span className={`player-chip player-chip-${player.position || 'DEF'}`}>
    {player.position || 'N/A'}
  </span>
);

const COL_A = 'bg-white/[0.04]';

const theadSticky = 'sticky top-0 z-10 bg-[#0d1e2e]';
const thBase = 'text-xs sm:text-sm font-medium text-gray-400';

const PlayerDetailRow = memo(({ player }: { player: Player }) => (
  <tr>
    <td colSpan={7} className='p-0 align-top'>
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

          {player.status && player.status !== 'Active' && (
            <div className='player-detail-item'>
              <CalendarIcon className='player-detail-icon text-yellow-500' />
              <span className='inline-block bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 text-sm font-medium'>
                {player.status}
              </span>
            </div>
          )}

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
      colSpan={7}
      className={`px-3 py-1.5 text-sm font-semibold uppercase tracking-wider ${isReserve ? 'text-red-400/70' : 'text-gray-500'
        }`}
    >
      {label}{' '}
      <span className='font-normal normal-case tracking-normal text-gray-400'>
        ({count})
      </span>
    </td>
  </tr>
);

interface PlayerRowProps {
  player: Player;
  isReserve?: boolean;
  expandedPlayer: string | null;
  onPlayerClick: (id: string) => void;
  playerOwnership: OwnershipMap;
}

const PlayerRow = memo(({
  player,
  isReserve = false,
  expandedPlayer,
  onPlayerClick,
  playerOwnership,
}: PlayerRowProps) => {
  const ownership = resolveOwnership(player, playerOwnership);
  const owned = ownership?.owned;
  const started = ownership?.started;

  return (
    <React.Fragment>
      <tr
        className={`hover:bg-white/4 cursor-pointer border-b border-white/5 transition-colors ${isReserve ? 'border-l-2 border-l-red-500/50' : ''
          }`}
        onClick={() => player.player_id && onPlayerClick(player.player_id)}
      >
        <td className={`p-2 align-middle ${COL_A}`}>
          <div className='flex items-center gap-2'>
            <div className='shrink-0'><PositionChip player={player} /></div>
            <span className='text-sm sm:text-base font-medium text-gray-100 leading-tight min-w-0 truncate'>
              {player.first_name} {player.last_name}
            </span>
          </div>
        </td>

        <td className='p-1.5 w-10 text-center align-middle'>
          {owned != null ? (
            <span className={`text-sm font-medium tabular-nums ${getOwnershipTier(owned)}`}>
              {owned}%
            </span>
          ) : (
            <span className='text-sm text-gray-500'>—</span>
          )}
        </td>

        <td className={`p-1.5 w-10 text-center align-middle ${COL_A}`}>
          {started != null ? (
            <span className={`text-sm font-medium tabular-nums ${getOwnershipTier(started)}`}>
              {started}%
            </span>
          ) : (
            <span className='text-sm text-gray-500'>—</span>
          )}
        </td>

        <td className='p-1.5 w-[50px] text-center align-middle border-l border-white/10'>
          <span className='text-sm font-medium tabular-nums text-gray-100'>
            {player.ktc?.superflexValues?.tep?.value ?? '—'}
          </span>
        </td>

        <td className={`p-1.5 text-center align-middle whitespace-nowrap ${COL_A}`}>
          <div className='text-sm leading-snug'>
            <div className='text-gray-100 font-medium'>
              {player.position} {player.ktc?.superflexValues?.tep?.positionalRank ?? '—'}
            </div>
            <div className='text-gray-400 font-medium'>
              OVR {player.ktc?.superflexValues?.tep?.rank ?? '—'}
            </div>
          </div>
        </td>

        <td className='p-1.5 text-center align-middle whitespace-nowrap'>
          <div className='text-sm leading-snug'>
            <div className='text-gray-100 font-medium'>
              {player.position} T{player.ktc?.superflexValues?.tep?.positionalTier ?? '—'}
            </div>
            <div className='text-gray-400 font-medium'>
              OVR T{player.ktc?.superflexValues?.tep?.overallTier ?? '—'}
            </div>
          </div>
        </td>

        <td className={`p-1.5 w-7 align-middle text-center ${COL_A}`}>
          {expandedPlayer === player.player_id
            ? <ChevronUpIcon className='h-5 w-5 inline' />
            : <ChevronDownIcon className='h-5 w-5 inline' />
          }
        </td>
      </tr>
      {expandedPlayer === player.player_id && <PlayerDetailRow player={player} />}
    </React.Fragment>
  );
});

export interface RosterTableProps {
  starters: Player[];
  bench: Player[];
  reserve: Player[];
  expandedPlayer: string | null;
  onPlayerClick: (id: string) => void;
  playerOwnership: OwnershipMap;
}

export const RosterTable = memo(({
  starters,
  bench,
  reserve,
  expandedPlayer,
  onPlayerClick,
  playerOwnership,
}: RosterTableProps) => (
  <div className='rounded-md overflow-x-auto border border-white/[0.07]'>
    <table className='min-w-full border-collapse'>
      <thead className='bg-[#0d1e2e]'>
        <tr className='border-b border-white/8'>
          <th className={`${theadSticky} p-2 text-left ${thBase} ${COL_A}`}>Player</th>
          <th className={`${theadSticky} p-1.5 w-10 text-center ${thBase}`}>Own</th>
          <th className={`${theadSticky} p-1.5 w-10 text-center ${thBase} ${COL_A}`}>Start</th>
          <th
            colSpan={3}
            scope='colgroup'
            className={`${theadSticky} border-l border-white/10 p-1.5 ${thBase}`}
          >
            <div className='flex flex-col items-stretch gap-1'>
              <div className='text-center text-[10px] sm:text-xs font-medium tracking-wide text-gray-400'>
                KTC
              </div>
              <div className='h-px w-full bg-white/20' aria-hidden />
              <div className='grid gap-1 grid-cols-[minmax(2.75rem,3.25rem)_1fr_1fr]'>
                <div className='text-center'>Value</div>
                <div className={`text-center ${COL_A}`}>Rank</div>
                <div className='text-center'>Tier</div>
              </div>
            </div>
          </th>
          <th className={`${theadSticky} w-7 ${COL_A}`} aria-hidden />
        </tr>
      </thead>
      <tbody>
        <SectionDivider label='Starters' count={starters.length} />
        {starters.map((p) => (
          <PlayerRow
            key={p.player_id}
            player={p}
            expandedPlayer={expandedPlayer}
            onPlayerClick={onPlayerClick}
            playerOwnership={playerOwnership}
          />
        ))}
        <SectionDivider label='Bench' count={bench.length} />
        {bench.map((p) => (
          <PlayerRow
            key={p.player_id}
            player={p}
            expandedPlayer={expandedPlayer}
            onPlayerClick={onPlayerClick}
            playerOwnership={playerOwnership}
          />
        ))}
        {reserve.length > 0 && (
          <>
            <SectionDivider label='Reserve / IR' count={reserve.length} isReserve />
            {reserve.map((p) => (
              <PlayerRow
                key={p.player_id}
                player={p}
                isReserve
                expandedPlayer={expandedPlayer}
                onPlayerClick={onPlayerClick}
                playerOwnership={playerOwnership}
              />
            ))}
          </>
        )}
      </tbody>
    </table>
  </div>
));
