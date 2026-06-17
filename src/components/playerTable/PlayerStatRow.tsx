import { memo } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Player } from '../../types';
import { getOwnershipTier } from '../../utils/teamStats';
import { formatPoints } from '../../utils/formatting';
import {
  formatValue,
  formatCount,
  formatDecimal,
  formatLiquidity,
} from '../../utils/valueDisplay';
import {
  ktcDisplayValues,
  resolveOwnership,
  playerDisplayName,
  injuryBadge,
  type InjuryBadge,
} from '../../playerFunctions';
import type { OwnershipMap } from '../RosterTable';
import { PositionBadge } from './PositionBadge';
import { ConsensusCell, SourceValueCell, NumCell, TrendCell } from './cells';
import { Cell, cellPad, GROUP_EDGE } from './layout';

const TrendingChip = () => (
  <span className='ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30'>
    Trending
  </span>
);

/** Compact injury indicator: a short status code, color-coded by severity. */
const InjuryChip = ({ badge }: { badge: InjuryBadge }) => (
  <span
    title={badge.title}
    aria-label={badge.title}
    className={`inline-flex shrink-0 items-center rounded px-1 py-0.5 text-[10px] font-semibold uppercase leading-none border ${
      badge.tone === 'danger'
        ? 'bg-red-500/15 text-red-300 border-red-500/30'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    }`}
  >
    {badge.code}
  </span>
);

export interface PlayerStatRowProps {
  player: Player;
  variant: 'standings' | 'all-players';
  /** All Players row number (0-based). */
  index?: number;
  /** Standings roster-section accent. */
  rowVariant?: 'default' | 'taxi' | 'reserve';
  showRedraft: boolean;
  ownershipMap: OwnershipMap;
  // standings-only:
  expanded?: boolean;
  onClick?: (id: string) => void;
}

export const PlayerStatRow = memo((props: PlayerStatRowProps) => {
  const {
    player,
    variant,
    index,
    rowVariant = 'default',
    showRedraft,
    ownershipMap,
    expanded,
    onClick,
  } = props;

  const own = resolveOwnership(player, ownershipMap);
  const stats = player.stats;
  const proj = player.values?.projection;
  const v = player.values;
  const fc = v?.sources?.fantasycalc;
  const ktcv = ktcDisplayValues(player);
  const accent =
    rowVariant === 'reserve'
      ? 'border-l-2 border-l-red-500/50'
      : rowVariant === 'taxi'
        ? 'border-l-2 border-l-amber-500/40'
        : '';
  const showTrending = !expanded && player.ktc?.isTrending === true;
  const injury = injuryBadge(player);

  const playerCell = (
    <td
      className={`${cellPad} align-middle sticky left-0 z-10 bg-[#0e2034] group-hover:bg-[#162640] border-r border-line`}
    >
      <div className='flex items-center gap-1.5'>
        <PositionBadge position={player.position} className='shrink-0' />
        <span className='min-w-0 truncate text-sm font-medium leading-tight text-ink-hi sm:text-base'>
          {playerDisplayName(player)}
        </span>
        {injury && <InjuryChip badge={injury} />}
        {showTrending && <TrendingChip />}
      </div>
    </td>
  );

  const ownStartCells = (
    <>
      <Cell edge>
        {own?.owned != null ? (
          <span className={`num text-sm font-medium ${getOwnershipTier(own.owned)}`}>
            {own.owned}%
          </span>
        ) : (
          <NumCell tone='muted'>—</NumCell>
        )}
      </Cell>
      <Cell tint>
        {own?.started != null ? (
          <span className={`num text-sm font-medium ${getOwnershipTier(own.started)}`}>
            {own.started}%
          </span>
        ) : (
          <NumCell tone='muted'>—</NumCell>
        )}
      </Cell>
    </>
  );

  const seasonCells = (
    <>
      <Cell edge>
        <NumCell tone='strong'>{formatPoints(stats?.average_points)}</NumCell>
      </Cell>
      <Cell tint>
        <NumCell>{formatPoints(stats?.total_points)}</NumCell>
      </Cell>
      <Cell>
        <NumCell>{stats?.games_played ?? '—'}</NumCell>
      </Cell>
    </>
  );

  const projCells = (
    <>
      <Cell edge>
        <NumCell>{formatDecimal(proj?.proj_ros)}</NumCell>
      </Cell>
      <Cell tint>
        <NumCell>{formatDecimal(proj?.proj_week)}</NumCell>
      </Cell>
    </>
  );

  const valueRunCells = (
    <>
      <td className={`${cellPad} text-center align-middle ${GROUP_EDGE} min-w-[72px]`}><ConsensusCell values={v} /></td>
      <Cell><TrendCell trend30={fc?.trend_30day} /></Cell>
      <Cell tint><SourceValueCell sourceKey='ktc' value={v?.sources?.ktc?.value} /></Cell>
      <Cell><SourceValueCell sourceKey='fantasycalc' value={fc?.value} /></Cell>
      {showRedraft && <Cell tint><NumCell>{formatValue(fc?.redraft_value)}</NumCell></Cell>}
      <Cell><NumCell>{formatCount(fc?.volatility)}</NumCell></Cell>
      <Cell tint><NumCell>{formatLiquidity(fc?.trade_frequency)}</NumCell></Cell>
      <Cell edge><NumCell tone='strong'>{ktcv?.positionalRank != null ? `${player.position}${ktcv.positionalRank}` : '—'}</NumCell></Cell>
      <Cell tint><NumCell>{formatCount(ktcv?.rank)}</NumCell></Cell>
      <Cell edge><NumCell tone='strong'>{ktcv?.positionalTier != null ? `T${ktcv.positionalTier}` : '—'}</NumCell></Cell>
      <Cell tint><NumCell>{ktcv?.overallTier != null ? `T${ktcv.overallTier}` : '—'}</NumCell></Cell>
    </>
  );

  if (variant === 'all-players') {
    return (
      <tr className='group cursor-pointer border-b border-white/5 hover:bg-white/[0.04]'
          onClick={() => player.player_id && onClick?.(player.player_id)}>
        <td className={`${cellPad} text-right align-middle`}><NumCell tone='muted'>{(index ?? 0) + 1}</NumCell></td>
        {playerCell}
        <Cell><NumCell tone='muted'>{player.team || '—'}</NumCell></Cell>
        {ownStartCells}{seasonCells}{projCells}{valueRunCells}
        <td className='w-7 px-1 align-middle text-center'>
          {expanded ? <ChevronUpIcon className='inline h-5 w-5 text-ink-mid' />
                    : <ChevronDownIcon className='inline h-5 w-5 text-ink-mid' />}
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`group hover:bg-white/[0.04] cursor-pointer border-b border-white/5 transition-colors ${accent}`}
      onClick={() => player.player_id && onClick?.(player.player_id)}
    >
      {playerCell}
      {ownStartCells}
      {seasonCells}
      {projCells}
      {valueRunCells}
      <td className='w-7 px-1 align-middle text-center'>
        {expanded ? (
          <ChevronUpIcon className='inline h-5 w-5 text-ink-mid' />
        ) : (
          <ChevronDownIcon className='inline h-5 w-5 text-ink-mid' />
        )}
      </td>
    </tr>
  );
});
