import { type ReactNode } from 'react';
import { ColumnHeader } from './ColumnHeader';

// Subtle zebra tint + group edge keep the wide table scannable. Shared by the
// roster (League Standings) table and the All Players grid.
export const COL_A = 'bg-white/[0.025]';
export const GROUP_EDGE = 'border-l border-line';
export const cellPad = 'px-1.5 py-1.5';

/** Centered numeric leaf cell with optional zebra tint and group edge. */
export const Cell = ({
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

/** Leaf-column header cell wrapping a tooltip-capable ColumnHeader. */
export const LeafTh = ({
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
  <th className={`${cellPad} ${tint ? COL_A : ''} ${edge ? GROUP_EDGE : ''}`} scope='col'>
    <ColumnHeader label={label} tooltip={tip} />
  </th>
);

/**
 * Total leaf-column count for a table variant, used for full-width `colSpan`s
 * (section dividers + expand row in standings, the empty-state row in All Players).
 * Shared run = Consensus, KTC, FC, (Redraft), 30 Day, Liq, Vol, RankPos, RankOvr, TierPos, TierOvr.
 */
export function statColumnCount(
  variant: 'standings' | 'all-players',
  showRedraft: boolean
): number {
  const run = showRedraft ? 11 : 10;        // +1 for the new 30d column
  const common = 2 + 3 + 2 + run;           // Own/Start + Season + Proj + run
  if (variant === 'standings') return 1 + common + 1;   // Player + common + expand
  return 1 + 1 + 1 + common + 1;            // # + Player + Team + common + expand
}

/** Shared scroll shell for player tables with a sticky header inside the panel. */
const PLAYER_TABLE_SCROLL_SHELL =
  'overflow-auto rounded-md border border-line-soft bg-surface-raised';

/** League Standings expanded roster — keeps sticky header scoped to one team. */
export const PLAYER_ROSTER_SCROLL =
  `${PLAYER_TABLE_SCROLL_SHELL} max-h-[min(70dvh,42rem)]`;

/** All Players grid — taller panel below tab bar and filter controls. */
export const PLAYER_LIST_SCROLL =
  `${PLAYER_TABLE_SCROLL_SHELL} max-h-[calc(100dvh-var(--dashboard-tab-bar-height)-11rem)]`;

/** Grouped (colgroup) header spanning several leaf columns. */
export const GroupTh = ({
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
