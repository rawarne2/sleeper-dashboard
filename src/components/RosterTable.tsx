import React, { memo } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Player } from '../types';
import { getOwnershipTier } from '../utils/teamStats';
import { formatPoints } from '../utils/formatting';
import { ktcDisplayValues, blendedValue, valueSources } from '../playerFunctions';
import { PlayerDetailContent } from './PlayerDetailContent';
import { SourceChip } from './SourceChip';

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

const TrendingChip = () => (
  <span className='ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30'>
    Trending
  </span>
);

const COL_A = 'bg-white/[0.04]';
const theadSticky = 'sticky top-0 z-10 bg-[#0d1e2e]';
const thBase = 'text-xs sm:text-sm font-medium text-gray-400';

const PlayerDetailRow = memo(({
  player,
  bundleSeason,
  leagueSeason,
  researchWeek,
  playerOwnership,
}: {
  player: Player;
  bundleSeason: string | null;
  leagueSeason: string | null;
  researchWeek: number | null;
  playerOwnership: OwnershipMap;
}) => (
  <tr>
    <td colSpan={10} className='p-0 align-top'>
      <div className='player-detail-row'>
        <PlayerDetailContent
          player={player}
          bundleSeason={bundleSeason}
          leagueSeason={leagueSeason}
          researchWeek={researchWeek}
          ownershipMap={playerOwnership}
          compact
        />
      </div>
    </td>
  </tr>
));

const SectionDivider = ({
  label,
  count,
  variant = 'default',
}: {
  label: string;
  count: number;
  variant?: 'default' | 'taxi' | 'reserve';
}) => {
  const tone =
    variant === 'reserve'
      ? 'text-red-400/70'
      : variant === 'taxi'
        ? 'text-amber-300/80'
        : 'text-gray-500';
  return (
    <tr className='bg-[#0d1a27]'>
      <td
        colSpan={10}
        className={`px-3 py-1.5 text-sm font-semibold uppercase tracking-wider ${tone}`}
      >
        {label}{' '}
        <span className='font-normal normal-case tracking-normal text-gray-400'>
          ({count})
        </span>
      </td>
    </tr>
  );
};

interface PlayerRowProps {
  player: Player;
  variant?: 'default' | 'taxi' | 'reserve';
  expandedPlayer: string | null;
  onPlayerClick: (id: string) => void;
  playerOwnership: OwnershipMap;
  bundleSeason: string | null;
  leagueSeason: string | null;
  researchWeek: number | null;
}

const PlayerRow = memo(
  ({
    player,
    variant = 'default',
    expandedPlayer,
    onPlayerClick,
    playerOwnership,
    bundleSeason,
    leagueSeason,
    researchWeek,
  }: PlayerRowProps) => {
    const ownership = resolveOwnership(player, playerOwnership);
    const owned = ownership?.owned;
    const started = ownership?.started;
    const stats = player.stats;
    const ktcValues = ktcDisplayValues(player);
    const isExpanded = expandedPlayer === player.player_id;
    const accentClass =
      variant === 'reserve'
        ? 'border-l-2 border-l-red-500/50'
        : variant === 'taxi'
          ? 'border-l-2 border-l-amber-500/40'
          : '';
    const showTrendingInline = !isExpanded && player.ktc?.isTrending === true;

    return (
      <React.Fragment>
        <tr
          className={`hover:bg-white/4 cursor-pointer border-b border-white/5 transition-colors ${accentClass}`}
          onClick={() => player.player_id && onPlayerClick(player.player_id)}
        >
          <td className={`p-2 align-middle ${COL_A}`}>
            <div className='flex items-center gap-2'>
              <div className='shrink-0'>
                <PositionChip player={player} />
              </div>
              <span className='text-sm sm:text-base font-medium text-gray-100 leading-tight min-w-0 truncate'>
                {player.first_name} {player.last_name}
              </span>
              {showTrendingInline && <TrendingChip />}
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

          <td className='p-1.5 w-12 text-center align-middle border-l border-white/10'>
            <span className='text-sm font-medium tabular-nums text-gray-100'>
              {formatPoints(stats?.average_points)}
            </span>
          </td>
          <td className={`p-1.5 w-14 text-center align-middle tabular-nums ${COL_A}`}>
            <span className='text-sm text-gray-100'>{formatPoints(stats?.total_points)}</span>
          </td>
          <td className='p-1.5 w-10 text-center align-middle tabular-nums'>
            <span className='text-sm text-gray-100'>{stats?.games_played ?? '—'}</span>
          </td>

          <td className={`p-1.5 w-[70px] text-center align-middle border-l border-white/10 ${COL_A}`}>
            <span className='text-sm font-medium tabular-nums text-gray-100'>
              {blendedValue(player) ?? ktcValues?.value ?? '—'}
            </span>
            <div className='mt-0.5 flex flex-wrap justify-center gap-0.5'>
              {valueSources(player).map((s) => (
                <SourceChip key={s.key} label={s.label} value={s.value} />
              ))}
            </div>
          </td>

          <td className='p-1.5 text-center align-middle whitespace-nowrap'>
            <div className='text-sm leading-snug'>
              <div className='text-gray-100 font-medium'>
                {player.position} {ktcValues?.positionalRank ?? '—'}
              </div>
              <div className='text-gray-400 font-medium'>
                OVR {ktcValues?.rank ?? '—'}
              </div>
            </div>
          </td>

          <td className={`p-1.5 text-center align-middle whitespace-nowrap ${COL_A}`}>
            <div className='text-sm leading-snug'>
              <div className='text-gray-100 font-medium'>
                {player.position} T{ktcValues?.positionalTier ?? '—'}
              </div>
              <div className='text-gray-400 font-medium'>
                OVR T{ktcValues?.overallTier ?? '—'}
              </div>
            </div>
          </td>

          <td className='p-1.5 w-7 align-middle text-center'>
            {isExpanded ? (
              <ChevronUpIcon className='h-5 w-5 inline' />
            ) : (
              <ChevronDownIcon className='h-5 w-5 inline' />
            )}
          </td>
        </tr>
        {isExpanded && (
          <PlayerDetailRow
            player={player}
            bundleSeason={bundleSeason}
            leagueSeason={leagueSeason}
            researchWeek={researchWeek}
            playerOwnership={playerOwnership}
          />
        )}
      </React.Fragment>
    );
  }
);

export interface RosterTableProps {
  starters: Player[];
  bench: Player[];
  reserve: Player[];
  taxi: Player[];
  expandedPlayer: string | null;
  onPlayerClick: (id: string) => void;
  playerOwnership: OwnershipMap;
  bundleSeason: string | null;
  leagueSeason: string | null;
  researchWeek: number | null;
}

export const RosterTable = memo(
  ({
    starters,
    bench,
    reserve,
    taxi,
    expandedPlayer,
    onPlayerClick,
    playerOwnership,
    bundleSeason,
    leagueSeason,
    researchWeek,
  }: RosterTableProps) => {
    const rowProps = {
      expandedPlayer,
      onPlayerClick,
      playerOwnership,
      bundleSeason,
      leagueSeason,
      researchWeek,
    };
    return (
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
                    Season Stats
                  </div>
                  <div className='h-px w-full bg-white/20' aria-hidden />
                  <div className='grid gap-1 grid-cols-3'>
                    <div className='text-center'>Avg</div>
                    <div className={`text-center ${COL_A}`}>Total</div>
                    <div className='text-center'>GP</div>
                  </div>
                </div>
              </th>
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
                    <div className={`text-center ${COL_A}`}>Value</div>
                    <div className='text-center'>Rank</div>
                    <div className={`text-center ${COL_A}`}>Tier</div>
                  </div>
                </div>
              </th>
              <th className={`${theadSticky} w-7`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            <SectionDivider label='Starters' count={starters.length} />
            {starters.map((p) => (
              <PlayerRow key={p.player_id} player={p} {...rowProps} />
            ))}
            <SectionDivider label='Bench' count={bench.length} />
            {bench.map((p) => (
              <PlayerRow key={p.player_id} player={p} {...rowProps} />
            ))}
            {taxi.length > 0 && (
              <>
                <SectionDivider label='Taxi' count={taxi.length} variant='taxi' />
                {taxi.map((p) => (
                  <PlayerRow
                    key={p.player_id}
                    player={p}
                    variant='taxi'
                    {...rowProps}
                  />
                ))}
              </>
            )}
            {reserve.length > 0 && (
              <>
                <SectionDivider
                  label='Reserve / IR'
                  count={reserve.length}
                  variant='reserve'
                />
                {reserve.map((p) => (
                  <PlayerRow
                    key={p.player_id}
                    player={p}
                    variant='reserve'
                    {...rowProps}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }
);
