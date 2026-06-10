/**
 * Shared value/source/trend display helpers.
 *
 * Single source of truth for how trade values are labeled, colored, and
 * formatted across the standings roster table, the All Players page, and the
 * Trade Analyzer. Colors reference the `--color-*` design tokens registered in
 * index.css so utilities (`text-cons`) and inline `var()` usage stay in sync.
 */

// ---------------------------------------------------------------------------
// Value sources
// ---------------------------------------------------------------------------

export type ValueSourceKey = 'consensus' | 'ktc' | 'fantasycalc';

export interface ValueSourceMeta {
  key: ValueSourceKey;
  /** Compact label used in cells (Consensus / KTC / FC). */
  label: string;
  /** Full wording for header tooltips. */
  fullLabel: string;
  /** CSS variable for inline styles. */
  colorVar: string;
  /** Tailwind text-color utility backed by the same token. */
  textClass: string;
}

export const VALUE_SOURCES: Record<ValueSourceKey, ValueSourceMeta> = {
  consensus: {
    key: 'consensus',
    label: 'Consensus',
    fullLabel: 'Consensus — average of KeepTradeCut and FantasyCalc values',
    colorVar: 'var(--color-cons)',
    textClass: 'text-cons',
  },
  ktc: {
    key: 'ktc',
    label: 'KTC',
    fullLabel: 'KeepTradeCut trade value',
    colorVar: 'var(--color-ktc)',
    textClass: 'text-ktc',
  },
  fantasycalc: {
    key: 'fantasycalc',
    label: 'FC',
    fullLabel: 'FantasyCalc trade value',
    colorVar: 'var(--color-fc)',
    textClass: 'text-fc',
  },
};

/** Maps a backend `values.sources` key to its display metadata. */
export function sourceMeta(key: string): ValueSourceMeta | null {
  if (key === 'ktc' || key === 'fantasycalc') return VALUE_SOURCES[key];
  return null;
}

/** Short label for a backend source key, falling back to the raw key. */
export function sourceLabel(key: string): string {
  return sourceMeta(key)?.label ?? key;
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/** Whole-number trade value with thousands separators, or em-dash when absent. */
export function formatValue(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

/** Fixed-decimal number (projections, per-game averages), em-dash when absent. */
export function formatDecimal(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

/** Integer count (games, ranks), em-dash when absent. */
export function formatCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// 30-day trend
// ---------------------------------------------------------------------------

export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendInfo {
  direction: TrendDirection;
  /** ▲ / ▼ / · glyph for the cell. */
  arrow: string;
  /** Absolute magnitude, rounded. */
  magnitude: number;
  /** Display string for the magnitude (e.g. "120"). */
  display: string;
  colorVar: string;
  textClass: string;
  /** Accessible/tooltip label. */
  label: string;
}

/**
 * Resolves `fantasycalc.trend_30day` (a signed change in value over ~30 days)
 * into a renderable trend. Returns null when no trend data exists so callers
 * can omit the indicator rather than show a misleading flat arrow.
 */
export function trendInfo(trend30: number | null | undefined): TrendInfo | null {
  if (trend30 == null || Number.isNaN(trend30)) return null;
  const magnitude = Math.abs(Math.round(trend30));
  if (trend30 > 0) {
    return {
      direction: 'up',
      arrow: '▲',
      magnitude,
      display: String(magnitude),
      colorVar: 'var(--color-trend-up)',
      textClass: 'text-trend-up',
      label: `Up ${magnitude} over the last 30 days`,
    };
  }
  if (trend30 < 0) {
    return {
      direction: 'down',
      arrow: '▼',
      magnitude,
      display: String(magnitude),
      colorVar: 'var(--color-trend-down)',
      textClass: 'text-trend-down',
      label: `Down ${magnitude} over the last 30 days`,
    };
  }
  return {
    direction: 'flat',
    arrow: '·',
    magnitude: 0,
    display: '0',
    colorVar: 'var(--color-trend-flat)',
    textClass: 'text-trend-flat',
    label: 'No change over the last 30 days',
  };
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
export type PositionKey = (typeof POSITION_ORDER)[number];

const POSITION_TOKEN: Record<string, string> = {
  QB: 'qb',
  RB: 'rb',
  WR: 'wr',
  TE: 'te',
  K: 'k',
  DEF: 'def',
};

/** CSS variable for a position accent, defaulting to DEF for unknowns. */
export function positionColorVar(position?: string | null): string {
  const token = POSITION_TOKEN[(position ?? '').toUpperCase()] ?? 'def';
  return `var(--color-pos-${token})`;
}

/** Tailwind text-color utility for a position accent. */
export function positionTextClass(position?: string | null): string {
  const token = POSITION_TOKEN[(position ?? '').toUpperCase()] ?? 'def';
  return `text-pos-${token}`;
}
