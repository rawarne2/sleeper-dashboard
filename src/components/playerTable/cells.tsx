import { type ReactNode } from 'react';
import { ValuesBlock } from '../../types';
import { formatValue, trendInfo } from '../../utils/valueDisplay';
import { SourceChip } from '../SourceChip';

/** Consensus (KTC+FC blend) hero number — its own column (trend is separate now). */
export function ConsensusCell({ values }: { values?: ValuesBlock | null }) {
  const consensus = values?.blended ?? null;
  return (
    <div className='flex items-baseline justify-center'>
      <span className='num text-[15px] font-semibold leading-none text-ink-hi'>{formatValue(consensus)}</span>
    </div>
  );
}

/** Single source value (KTC or FantasyCalc) in that source's color identity — its own column. */
export function SourceValueCell({
  sourceKey,
  value,
}: {
  sourceKey: 'ktc' | 'fantasycalc';
  value?: number | null;
}) {
  return <SourceChip sourceKey={sourceKey} value={value ?? null} />;
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
