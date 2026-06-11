import { type ReactNode } from 'react';
import { ValuesBlock } from '../../types';
import { formatValue, trendInfo } from '../../utils/valueDisplay';
import { SourceChip } from '../SourceChip';

/**
 * Consensus value cell: the labeled hero (KTC+FC blend) with a 30-day trend
 * arrow, and KTC / FC source values color-coded beneath. Shared by the roster
 * table, the All Players page, and the Trade Analyzer browse grid.
 */
export function ValueCell({ values }: { values?: ValuesBlock | null }) {
  const consensus = values?.blended ?? null;
  const ktc = values?.sources?.ktc?.value ?? null;
  const fc = values?.sources?.fantasycalc?.value ?? null;
  const trend = trendInfo(values?.sources?.fantasycalc?.trend_30day);

  return (
    <div className='flex flex-col items-center gap-0.5'>
      <div className='flex items-baseline justify-center gap-1'>
        <span className='num text-[15px] font-semibold leading-none text-ink-hi'>
          {formatValue(consensus)}
        </span>
        {trend && (
          <span
            className={`shrink-0 text-[11px] font-semibold leading-none ${trend.textClass}`}
            title={trend.label}
            aria-label={trend.label}
          >
            {trend.arrow}
          </span>
        )}
      </div>
      <div className='flex items-center justify-center gap-2'>
        <SourceChip sourceKey='ktc' value={ktc} />
        <SourceChip sourceKey='fantasycalc' value={fc} />
      </div>
    </div>
  );
}

/** 30-day trend cell: colored arrow + magnitude (shared by the All Players grid). */
export function TrendCell({ trend30 }: { trend30?: number | null }) {
  const t = trendInfo(trend30);
  if (!t) return <span className='num text-sm leading-none text-ink-dim'>—</span>;
  return (
    <span className={`num text-sm font-medium leading-none ${t.textClass}`} title={t.label}>
      {t.arrow} {t.display}
    </span>
  );
}

/** Generic centered numeric cell content with a tabular figure + em-dash gap. */
export function NumCell({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'strong';
}) {
  const toneClass =
    tone === 'strong' ? 'text-ink-hi font-medium' : tone === 'muted' ? 'text-ink-dim' : 'text-ink';
  return <span className={`num text-sm leading-none ${toneClass}`}>{children}</span>;
}
