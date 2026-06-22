import { ColumnHeader, type SortDirection } from './ColumnHeader';
import { LeafTh, GroupTh, cellPad, COL_A, GROUP_EDGE } from './layout';

export type StatSortKey =
  | 'team'
  | 'own'
  | 'start'
  | 'avg'
  | 'tot'
  | 'ros'
  | 'week'
  | 'consensus'
  | 'trend'
  | 'ktc'
  | 'fc'
  | 'redraft'
  | 'vol'
  | 'liq'
  | 'rankPos'
  | 'rank'
  | 'tierPos'
  | 'tier';

export const DEFAULT_STAT_SORT_KEY: StatSortKey = 'consensus';
export const DEFAULT_STAT_SORT_DIR = 'desc' as const;

interface StatSort {
  dirFor: (k: StatSortKey) => SortDirection;
  onSort: (k: StatSortKey, defaultDir: 'asc' | 'desc') => void;
}

export interface PlayerStatHeaderProps {
  variant: 'standings' | 'all-players';
  showRedraft: boolean;
  /** When provided (All Players), sortable headers wire to the page sort state. */
  sort?: StatSort;
  /** Sleeper research week for the WK projection column label (defaults to 1). */
  projectedWeek?: number | null;
}

/** Value-run leaf header — sortable when `sort` and a key are provided, else a plain tooltip header. */
function ValTh({
  sort,
  label,
  tip,
  k,
  defaultDir = 'desc',
  tint = false,
  edge = false,
}: {
  sort?: StatSort;
  label: string;
  tip: string;
  k?: StatSortKey;
  defaultDir?: 'asc' | 'desc';
  tint?: boolean;
  edge?: boolean;
}) {
  if (sort && k) {
    return (
      <th className={`${cellPad} ${tint ? COL_A : ''} ${edge ? GROUP_EDGE : ''}`} scope='col'>
        <ColumnHeader
          label={label}
          tooltip={tip}
          sortable
          sortDirection={sort.dirFor(k)}
          onSort={() => sort.onSort(k, defaultDir)}
        />
      </th>
    );
  }
  return <LeafTh label={label} tip={tip} tint={tint} edge={edge} />;
}

export function PlayerStatHeader({
  variant,
  showRedraft,
  sort,
  projectedWeek,
}: PlayerStatHeaderProps) {
  const tradeSpan = showRedraft ? 7 : 6;
  const weekLabel = `WK ${projectedWeek ?? 1}`;

  const groupRow = (
    <>
      <GroupTh label='Ownership' tip='Sleeper ownership across leagues' span={2} />
      <GroupTh label='Season' tip='Regular-season fantasy stats' span={3} />
      <GroupTh label='Proj' tip='Projected fantasy points' span={2} />
      <GroupTh
        label='Trade value'
        tip='Consensus trade value (KTC and FantasyCalc)'
        span={tradeSpan}
      />
      <GroupTh label='KTC Rank' tip='KeepTradeCut rankings' span={2} />
      <GroupTh label='KTC Tier' tip='KeepTradeCut tiers' span={2} />
    </>
  );

  const leafRow = (
    <>
      <ValTh sort={sort} label='Own' tip='Owned — % of leagues rostering this player' k='own' edge />
      <ValTh sort={sort} label='Start' tip='Started — % of leagues starting this player' k='start' tint />
      <ValTh sort={sort} label='Avg' tip='Average fantasy points per game this season' k='avg' edge />
      <ValTh sort={sort} label='Tot' tip='Total fantasy points this season' k='tot' tint />
      <LeafTh label='GP' tip='Games played this season' />
      <ValTh sort={sort} label='ROS' tip='Rest-of-season projected fantasy points' k='ros' edge />
      <ValTh
        sort={sort}
        label={weekLabel}
        tip={`Week ${projectedWeek ?? 1} projected fantasy points`}
        k='week'
        tint
      />
      <ValTh label='Consensus' tip='Consensus — average of KTC and FantasyCalc.' k='consensus' edge sort={sort} />
      <ValTh sort={sort} label='KTC' tip='KeepTradeCut trade value' k='ktc' tint />
      <ValTh
        sort={sort}
        label='FC'
        tip="FantasyCalc trade value (this league's PPR / team count)."
        k='fc'
      />
      {showRedraft && (
        <ValTh sort={sort} label='Redraft' tip='FantasyCalc redraft (win-now) value' k='redraft' tint />
      )}
      <ValTh label='30 Day' tip='FantasyCalc 30-day value trend (arrow + change).' k='trend' sort={sort} />
      <ValTh
        sort={sort}
        label='Liq'
        tip='Trade liquidity — how frequently this player is traded (FantasyCalc trade frequency)'
        k='liq'
        tint
      />
      <ValTh
        sort={sort}
        label='Vol'
        tip='FantasyCalc value volatility — higher means a less settled price'
        k='vol'
      />
      <ValTh sort={sort} label='Pos' tip='KTC positional rank' k='rankPos' defaultDir='asc' edge />
      <ValTh sort={sort} label='Ovr' tip='KTC overall rank' k='rank' defaultDir='asc' tint />
      <ValTh sort={sort} label='Pos' tip='KTC positional tier' k='tierPos' defaultDir='asc' edge />
      <ValTh sort={sort} label='Ovr' tip='KTC overall tier' k='tier' defaultDir='asc' tint />
    </>
  );

  return (
    <thead className='sticky top-0 z-20 bg-surface-header shadow-[0_1px_0_var(--color-line-soft)]'>
      <tr className='border-b border-line-soft'>
        {variant === 'all-players' && (
          <th rowSpan={2} className={`${cellPad} text-right`} scope='col'>
            <ColumnHeader label='#' tooltip='Row number in the current sort' align='right' />
          </th>
        )}
        <th
          rowSpan={2}
          scope='col'
          className={`${cellPad} text-left static z-30 bg-surface-header border-r border-line sm:sticky sm:left-0`}
        >
          <ColumnHeader label='Player' tooltip='Player — position and name' align='left' />
        </th>
        {variant === 'all-players' && (
          <th rowSpan={2} className={cellPad} scope='col'>
            {sort ? (
              <ColumnHeader
                label='Team'
                tooltip='NFL team'
                sortable
                sortDirection={sort.dirFor('team')}
                onSort={() => sort.onSort('team', 'asc')}
              />
            ) : (
              <ColumnHeader label='Team' tooltip='NFL team' />
            )}
          </th>
        )}
        {groupRow}
        <th rowSpan={2} className='w-7' aria-hidden />
      </tr>
      <tr className='border-b border-line'>{leafRow}</tr>
    </thead>
  );
}
