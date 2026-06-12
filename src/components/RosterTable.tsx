import React, { memo } from 'react';
import { Player } from '../types';
import { PlayerDetailContent } from './PlayerDetailContent';
import { PlayerStatRow } from './playerTable/PlayerStatRow';
import { PlayerStatHeader } from './playerTable/PlayerStatHeader';
import { statColumnCount } from './playerTable/layout';

export type OwnershipMap = Record<string, { owned: number; started?: number }>;

const PlayerDetailRow = memo(
  ({
    player,
    bundleSeason,
    leagueSeason,
    researchWeek,
    playerOwnership,
    colSpan,
  }: {
    player: Player;
    bundleSeason: string | null;
    leagueSeason: string | null;
    researchWeek: number | null;
    playerOwnership: OwnershipMap;
    colSpan: number;
  }) => (
    <tr>
      <td colSpan={colSpan} className='p-0 align-top'>
        {/* Cap width + sticky-left so the static profile stays a tidy, readable
            card pinned to the left instead of stretching across the wide table. */}
        <div className='player-detail-row sticky left-0 w-[min(100vw,60rem)] max-w-full'>
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
  )
);

const SectionDivider = ({
  label,
  count,
  colSpan,
  variant = 'default',
}: {
  label: string;
  count: number;
  colSpan: number;
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
        colSpan={colSpan}
        className={`hd px-3 py-1.5 text-sm font-semibold uppercase tracking-wider ${tone}`}
      >
        {label}{' '}
        <span className='font-normal normal-case tracking-normal text-ink-mid'>({count})</span>
      </td>
    </tr>
  );
};

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
  showRedraft: boolean;
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
    showRedraft,
  }: RosterTableProps) => {
    const colSpan = statColumnCount('standings', showRedraft);

    const renderSection = (
      list: Player[],
      rowVariant: 'default' | 'taxi' | 'reserve'
    ) =>
      list.map((p) => (
        <React.Fragment key={p.player_id}>
          <PlayerStatRow
            player={p}
            variant='standings'
            rowVariant={rowVariant}
            showRedraft={showRedraft}
            ownershipMap={playerOwnership}
            expanded={expandedPlayer === p.player_id}
            onClick={onPlayerClick}
          />
          {expandedPlayer === p.player_id && (
            <PlayerDetailRow
              player={p}
              bundleSeason={bundleSeason}
              leagueSeason={leagueSeason}
              researchWeek={researchWeek}
              playerOwnership={playerOwnership}
              colSpan={colSpan}
            />
          )}
        </React.Fragment>
      ));

    return (
      <div className='overflow-x-auto rounded-md border border-line-soft bg-surface-raised'>
        <table className='min-w-full border-collapse'>
          <PlayerStatHeader variant='standings' showRedraft={showRedraft} />
          <tbody>
            <SectionDivider label='Starters' count={starters.length} colSpan={colSpan} />
            {renderSection(starters, 'default')}
            <SectionDivider label='Bench' count={bench.length} colSpan={colSpan} />
            {renderSection(bench, 'default')}
            {taxi.length > 0 && (
              <>
                <SectionDivider label='Taxi' count={taxi.length} colSpan={colSpan} variant='taxi' />
                {renderSection(taxi, 'taxi')}
              </>
            )}
            {reserve.length > 0 && (
              <>
                <SectionDivider
                  label='Reserve / IR'
                  count={reserve.length}
                  colSpan={colSpan}
                  variant='reserve'
                />
                {renderSection(reserve, 'reserve')}
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }
);
