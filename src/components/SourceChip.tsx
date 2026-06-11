import { sourceMeta, formatValue } from '../utils/valueDisplay';

/**
 * Color-coded source value (KTC teal / FC violet) shown beneath the Consensus
 * hero. The label takes the source accent; the figure stays neutral.
 */
export function SourceChip({
  sourceKey,
  value,
}: {
  sourceKey: 'ktc' | 'fantasycalc';
  value: number | null;
}) {
  const meta = sourceMeta(sourceKey);
  return (
    <span
      className='inline-flex items-baseline gap-1 text-[11px] leading-none'
      title={`${meta?.fullLabel ?? sourceKey}: ${value != null ? formatValue(value) : '—'}`}
    >
      <span className={`font-semibold ${meta?.textClass ?? ''}`}>{meta?.label ?? sourceKey}</span>
      <span className='num text-ink'>{value != null ? formatValue(value) : '—'}</span>
    </span>
  );
}
