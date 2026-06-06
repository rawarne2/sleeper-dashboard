const chipBase =
  'inline-flex items-baseline gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-tight bg-white/5';

export function SourceChip({ label, value }: { label: string; value: number | string | null }) {
  return (
    <span className={chipBase} title={`${label}: ${value ?? '—'}`}>
      <span className='shrink-0 text-gray-400'>{label}</span>
      <span className='tabular-nums text-gray-200'>{value ?? '—'}</span>
    </span>
  );
}
