import React, { memo, type ReactNode } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Player } from '../types';
import { getOwnershipTier } from '../utils/teamStats';
import { formatPoints } from '../utils/formatting';
import {
  formatValue,
  formatCount,
  formatDecimal,
  formatLiquidity,
} from '../utils/valueDisplay';
import { ktcDisplayValues } from '../playerFunctions';
import { PlayerDetailContent } from './PlayerDetailContent';
import { ColumnHeader } from './playerTable/ColumnHeader';
import { PositionBadge } from './playerTable/PositionBadge';
import { ValueCell, NumCell } from './playerTable/cells';

export type OwnershipMap = Record<string, { owned: number; started?: number }>;

/** Total leaf-column count, used for full-width rows (dividers, expand). */
const TOTAL_COLS = 17;

function resolveOwnership(player: Player, ownershipMap: OwnershipMap) {
  if (player.owned != null) return { owned: player.owned, started: player.started ?? null };
  if (player.player_id && ownershipMap[player.player_id]) {
    const o = ownershipMap[player.player_id];
    return { owned: o.owned, started: o.started ?? null };
  }
  return null;
}

const TrendingChip = () => (
  <span className='ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30'>
    Trending
  </span>
);

// Subtle zebra tint to keep paired columns scannable across the wide table.
const COL_A = 'bg-white/[0.025]';
const GROUP_EDGE = 'border-l border-line';
const cellPad = 'px-1.5 py-1.5';

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
    <td colSpan={TOTAL_COLS} className='p-0 align-top'>
      <div className='player-detail-row sticky left-0'>
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
        : 'text-ink-mid';
  return (
    <tr className='bg-[#0d1a27]'>
      <td
        colSpan={TOTAL_COLS}
        className={`hd px-3 py-1.5 text-sm font-semibold uppercase tracking-wider ${tone}`}
      >
        {label}{' '}
        <span className='font-normal normal-case tracking-normal text-ink-mid'>({count})</span>
      </td>
    </tr>
  );
};

/** Centered numeric leaf cell with optional zebra tint and group edge. */
const Cell = ({
  children,
  tint = false,
  edge = false,
  width = '',
}: {
  children: ReactNode;
  tint?: boolean;
  edge?: boolean;
  width?: string;
}) => (
  <td
    className={`${cellPad} text-center align-middle ${tint ? COL_A : ''} ${
      edge ? GROUP_EDGE : ''
    } ${width}`}
  >
    {children}
  </td>
);

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
    const fc = player.values?.sources?.fantasycalc;
    const proj = player.values?.projection;
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
          className={`group hover:bg-white/[0.04] cursor-pointer border-b border-white/5 transition-colors ${accentClass}`}
          onClick={() => player.player_id && onPlayerClick(player.player_id)}
        >
          {/* Player — sticky left so it stays pinned during horizontal scroll */}
          <td className={`${cellPad} align-middle sticky left-0 z-10 bg-[#0e2034] group-hover:bg-[#162640] border-r border-line`}>
            <div className='flex items-center gap-2'>
              <PositionBadge position={player.position} className='shrink-0' />
              <span className='min-w-0 truncate text-sm font-medium leading-tight text-ink-hi sm:text-base'>
                {player.first_name} {player.last_name}
              </span>
              {showTrendingInline && <TrendingChip />}
            </div>
          </td>

          {/* Ownership */}
          <Cell edge>
            {owned != null ? (
              <span className={`num text-sm font-medium ${getOwnershipTier(owned)}`}>{owned}%</span>
            ) : (
              <NumCell tone='muted'>—</NumCell>
            )}
          </Cell>
          <Cell tint>
            {started != null ? (
              <span className={`num text-sm font-medium ${getOwnershipTier(started)}`}>
                {started}%
              </span>
            ) : (
              <NumCell tone='muted'>—</NumCell>
            )}
          </Cell>

          {/* Season */}
          <Cell edge>
            <NumCell tone='strong'>{formatPoints(stats?.average_points)}</NumCell>
          </Cell>
          <Cell tint>
            <NumCell>{formatPoints(stats?.total_points)}</NumCell>
          </Cell>
          <Cell>
            <NumCell>{stats?.games_played ?? '—'}</NumCell>
          </Cell>

          {/* Proj */}
          <Cell edge>
            <NumCell>{formatDecimal(proj?.proj_ros)}</NumCell>
          </Cell>
          <Cell tint>
            <NumCell>{formatDecimal(proj?.proj_week)}</NumCell>
          </Cell>

          {/* Trade value */}
          <td className={`${cellPad} text-center align-middle ${GROUP_EDGE} min-w-[92px]`}>
            <ValueCell values={player.values} />
          </td>
          <Cell>
            <NumCell>{formatValue(fc?.redraft_value)}</NumCell>
          </Cell>
          <Cell tint>
            <NumCell>{formatCount(fc?.volatility)}</NumCell>
          </Cell>
          <Cell>
            <NumCell>{formatLiquidity(fc?.trade_frequency)}</NumCell>
          </Cell>

          {/* KTC Rank */}
          <Cell edge>
            <NumCell tone='strong'>
              {ktcValues?.positionalRank != null
                ? `${player.position}${ktcValues.positionalRank}`
                : '—'}
            </NumCell>
          </Cell>
          <Cell tint>
            <NumCell>{formatCount(ktcValues?.rank)}</NumCell>
          </Cell>

          {/* KTC Tier */}
          <Cell edge>
            <NumCell tone='strong'>
              {ktcValues?.positionalTier != null ? `T${ktcValues.positionalTier}` : '—'}
            </NumCell>
          </Cell>
          <Cell tint>
            <NumCell>
              {ktcValues?.overallTier != null ? `T${ktcValues.overallTier}` : '—'}
            </NumCell>
          </Cell>

          {/* Expand chevron */}
          <td className='w-7 px-1 align-middle text-center'>
            {isExpanded ? (
              <ChevronUpIcon className='inline h-5 w-5 text-ink-mid' />
            ) : (
              <ChevronDownIcon className='inline h-5 w-5 text-ink-mid' />
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

/** Leaf-column header cell wrapping a tooltip-capable ColumnHeader. */
const LeafTh = ({
  label,
  tip,
  tint = false,
  edge = false,
}: {
  label: string;
  tip: string;
  tint?: boolean;
  edge?: boolean;
}) => (
  <th
    className={`${cellPad} ${tint ? COL_A : ''} ${edge ? GROUP_EDGE : ''}`}
    scope='col'
  >
    <ColumnHeader label={label} tooltip={tip} />
  </th>
);

const GroupTh = ({
  label,
  tip,
  span,
}: {
  label: string;
  tip: string;
  span: number;
}) => (
  <th colSpan={span} scope='colgroup' className={`${cellPad} ${GROUP_EDGE}`}>
    <ColumnHeader label={label} tooltip={tip} variant='group' />
  </th>
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
      <div className='overflow-x-auto rounded-md border border-line-soft bg-surface-raised'>
        <table className='min-w-full border-collapse'>
          <thead className='sticky top-0 z-20 bg-surface-header'>
            <tr className='border-b border-line-soft'>
              <th
                rowSpan={2}
                scope='col'
                className={`${cellPad} text-left sticky left-0 z-30 bg-surface-header border-r border-line`}
              >
                <ColumnHeader label='Player' tooltip='Player — position and name' align='left' />
              </th>
              <GroupTh label='Ownership' tip='Sleeper ownership across leagues' span={2} />
              <GroupTh label='Season' tip='Regular-season fantasy stats' span={3} />
              <GroupTh label='Proj' tip='Projected fantasy points' span={2} />
              <GroupTh
                label='Trade value'
                tip='Trade values blended from KTC and FantasyCalc'
                span={4}
              />
              <GroupTh label='KTC Rank' tip='KeepTradeCut rankings' span={2} />
              <GroupTh label='KTC Tier' tip='KeepTradeCut tiers' span={2} />
              <th rowSpan={2} className='w-7' aria-hidden />
            </tr>
            <tr className='border-b border-line'>
              <LeafTh label='Own' tip='Owned — % of leagues rostering this player' edge />
              <LeafTh label='Start' tip='Started — % of leagues starting this player' tint />
              <LeafTh label='Avg' tip='Average fantasy points per game this season' edge />
              <LeafTh label='Tot' tip='Total fantasy points this season' tint />
              <LeafTh label='GP' tip='Games played this season' />
              <LeafTh label='ROS' tip='Rest-of-season projected fantasy points' edge />
              <LeafTh label='Wk' tip="Next week's projected fantasy points" tint />
              <LeafTh
                label='Consensus'
                tip='Consensus value — average of KTC and FantasyCalc. Arrow shows the 30-day trend.'
                edge
              />
              <LeafTh label='Redraft' tip='FantasyCalc redraft (win-now) value' />
              <LeafTh
                label='Vol'
                tip='FantasyCalc value volatility — higher means a less settled price'
                tint
              />
              <LeafTh
                label='Liq'
                tip='Trade liquidity — how frequently this player is traded (FantasyCalc)'
              />
              <LeafTh label='Pos' tip='KTC positional rank' edge />
              <LeafTh label='Ovr' tip='KTC overall rank' tint />
              <LeafTh label='Pos' tip='KTC positional tier' edge />
              <LeafTh label='Ovr' tip='KTC overall tier' tint />
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
                  <PlayerRow key={p.player_id} player={p} variant='taxi' {...rowProps} />
                ))}
              </>
            )}
            {reserve.length > 0 && (
              <>
                <SectionDivider label='Reserve / IR' count={reserve.length} variant='reserve' />
                {reserve.map((p) => (
                  <PlayerRow key={p.player_id} player={p} variant='reserve' {...rowProps} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }
);
