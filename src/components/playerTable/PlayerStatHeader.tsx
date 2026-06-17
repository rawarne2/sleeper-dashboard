import { ColumnHeader, type SortDirection } from './ColumnHeader';
import { LeafTh, GroupTh, cellPad, COL_A, GROUP_EDGE } from './layout';

export type StatSortKey = 'consensus' | 'trend' | 'redraft' | 'vol' | 'liq' | 'rank' | 'tier' | 'own';

interface StatSort {
  dirFor: (k: StatSortKey) => SortDirection;
  onSort: (k: StatSortKey, defaultDir: 'asc' | 'desc') => void;
}

export interface PlayerStatHeaderProps {
  variant: 'standings' | 'all-players';
  showRedraft: boolean;
  /** When provided (All Players), the value-run leaf headers become sortable. */
  sort?: StatSort;
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

export function PlayerStatHeader({ variant, showRedraft, sort }: PlayerStatHeaderProps) {
  const tradeSpan = showRedraft ? 7 : 6;

  const groupRow = (
    <>
      <GroupTh label='Ownership' tip='Sleeper ownership across leagues' span={2} />
      <GroupTh label='Season' tip='Regular-season fantasy stats' span={3} />
      <GroupTh label='Proj' tip='Projected fantasy points' span={2} />
      <GroupTh
        label='Trade value'
        tip='Trade values blended from KTC and FantasyCalc'
        span={tradeSpan}
      />
      <GroupTh label='KTC Rank' tip='KeepTradeCut rankings' span={2} />
      <GroupTh label='KTC Tier' tip='KeepTradeCut tiers' span={2} />
    </>
  );

  const leafRow = (
    <>
      <LeafTh label='Own' tip='Owned — % of leagues rostering this player' edge />
      <LeafTh label='Start' tip='Started — % of leagues starting this player' tint />
      <LeafTh label='Avg' tip='Average fantasy points per game this season' edge />
      <LeafTh label='Tot' tip='Total fantasy points this season' tint />
      <LeafTh label='GP' tip='Games played this season' />
      <LeafTh label='ROS' tip='Rest-of-season projected fantasy points' edge />
      <LeafTh label='Wk' tip="Next week's projected fantasy points" tint />
      <ValTh label='Consensus' tip='Consensus — average of KTC and FantasyCalc.' k='consensus' edge sort={sort} />
      <ValTh label='30 Day' tip='FantasyCalc 30-day value trend (arrow + change).' k='trend' tint sort={sort} />
      <ValTh sort={sort} label='KTC' tip='KeepTradeCut trade value' />
      <ValTh sort={sort} label='FC' tip="FantasyCalc trade value (this league's PPR / team count)." tint />
      {showRedraft && (
        <ValTh sort={sort} label='Redraft' tip='FantasyCalc redraft (win-now) value' k='redraft' />
      )}
      <ValTh
        sort={sort}
        label='Vol'
        tip='FantasyCalc value volatility — higher means a less settled price'
        k='vol'
        tint
      />
      <ValTh
        sort={sort}
        label='Liq'
        tip='Trade liquidity — how frequently this player is traded'
        k='liq'
      />
      <ValTh sort={sort} label='Pos' tip='KTC positional rank' edge />
      <ValTh sort={sort} label='Ovr' tip='KTC overall rank' k='rank' defaultDir='asc' tint />
      <ValTh sort={sort} label='Pos' tip='KTC positional tier' edge />
      <ValTh sort={sort} label='Ovr' tip='KTC overall tier' k='tier' defaultDir='asc' tint />
    </>
  );

  return (
    <thead className='sticky top-0 z-20 bg-surface-header'>
      <tr className='border-b border-line-soft'>
        {variant === 'all-players' && (
          <th rowSpan={2} className={`${cellPad} text-right`} scope='col'>
            <ColumnHeader label='#' tooltip='Row number in the current sort' align='right' />
          </th>
        )}
        <th
          rowSpan={2}
          scope='col'
          className={`${cellPad} text-left sticky left-0 z-30 bg-surface-header border-r border-line`}
        >
          <ColumnHeader label='Player' tooltip='Player — position and name' align='left' />
        </th>
        {variant === 'all-players' && (
          <th rowSpan={2} className={cellPad} scope='col'>
            <ColumnHeader label='Team' tooltip='NFL team' />
          </th>
        )}
        {groupRow}
        <th rowSpan={2} className='w-7' aria-hidden />
      </tr>
      <tr className='border-b border-line'>{leafRow}</tr>
    </thead>
  );
}
