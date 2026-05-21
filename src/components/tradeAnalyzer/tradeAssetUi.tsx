export function tradeAssetBorder(): string {
  return 'border-gray-500';
}

export type TradeValueTone = 'win' | 'lose' | 'even';

export function tradeValueToneClass(tone: TradeValueTone): string {
  if (tone === 'win') return 'text-green-400';
  if (tone === 'lose') return 'text-red-400';
  return 'text-gray-200';
}

export function toneForSide(
  sideValue: number,
  otherValue: number
): TradeValueTone {
  if (sideValue < otherValue) return 'win';
  if (sideValue > otherValue) return 'lose';
  return 'even';
}

export type TradeAssetRow = {
  key: string;
  name: string;
  position?: string;
  ktc: number;
  rankLabel: string | null;
  meta?: string | null;
};

const ASSET_TAG_BASE =
  'box-border flex w-full min-h-11 items-stretch overflow-hidden rounded-md border border-solid bg-white/[0.06] shadow-sm';

export function TradeAssetTag(props: {
  asset: TradeAssetRow;
  valueTone?: TradeValueTone;
  isPick?: boolean;
  showPosition?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  onOpenDetail?: () => void;
  detailLabel?: string;
}) {
  const { asset } = props;
  const tone = props.valueTone ?? 'even';
  const showPosition = props.showPosition !== false;
  const metaParts = [
    ...(showPosition && asset.position ? [asset.position] : []),
    ...(asset.rankLabel ? [asset.rankLabel] : []),
  ];
  const meta = asset.meta ?? (metaParts.length > 0 ? metaParts.join(' · ') : null);
  const borderClass = tradeAssetBorder();
  const cardClass = `${ASSET_TAG_BASE} ${borderClass}`;

  const inner = (
    <>
      <div className='flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left'>
        <span className='truncate text-sm font-semibold text-gray-100 sm:text-base'>
          {asset.name}
        </span>
        {meta ? (
          <span className='truncate text-xs text-gray-400 sm:text-sm'>{meta}</span>
        ) : null}
      </div>
      <div
        className={`flex shrink-0 items-center border-l border-white/10 px-3 py-2 tabular-nums text-base font-bold sm:text-lg ${tradeValueToneClass(tone)}`}
      >
        {asset.ktc > 0 ? asset.ktc.toLocaleString() : '—'}
      </div>
    </>
  );

  const interactive = props.onOpenDetail != null;
  const body = interactive ? (
    <button
      type='button'
      className={`${cardClass} w-full overflow-hidden transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main`}
      onClick={props.onOpenDetail}
      aria-label={props.detailLabel ?? `View details for ${asset.name}`}
    >
      {inner}
    </button>
  ) : (
    <div className={`${cardClass} overflow-hidden`}>{inner}</div>
  );

  if (!props.onRemove && !interactive) {
    return body;
  }

  return (
    <div className='relative w-full'>
      {props.onRemove ? (
        <button
          type='button'
          className='absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-500! text-xs font-bold leading-none text-gray-100 ring-1 ring-white/15 transition-colors hover:bg-gray-400! focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove?.();
          }}
          aria-label={props.removeLabel ?? `Remove ${asset.name}`}
        >
          <span aria-hidden>×</span>
        </button>
      ) : null}
      {body}
    </div>
  );
}

export function TradeSideTotals(props: {
  value: number;
  pieceCount: number;
  tone: TradeValueTone;
}) {
  return (
    <div className='mt-3 flex items-end justify-between gap-2 border-t border-white/10 pt-3'>
      <div className='text-xs text-gray-400 sm:text-sm'>
        <div>
          {props.pieceCount} {props.pieceCount === 1 ? 'piece' : 'pieces'}
        </div>
      </div>
      <div
        className={`text-lg font-bold tabular-nums leading-none sm:text-xl md:text-2xl ${tradeValueToneClass(props.tone)}`}
      >
        {props.value.toLocaleString()}
      </div>
    </div>
  );
}

export function KtcTradeComparison(props: {
  sideALabel: string;
  sideBLabel: string;
  sideAValue: number;
  sideBValue: number;
  sideAAssets: TradeAssetRow[];
  sideBAssets: TradeAssetRow[];
}) {
  const a = Math.max(0, props.sideAValue);
  const b = Math.max(0, props.sideBValue);
  const total = a + b || 1;
  const aShare = (a / total) * 100;
  const toneA = toneForSide(b, a);
  const toneB = toneForSide(a, b);
  const diff = Math.abs(a - b);
  const favorsA = a > b;
  const favorsB = b > a;
  const even = !favorsA && !favorsB;

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div>
          <div className='rounded-t-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-gray-100 sm:text-sm'>
            {props.sideALabel} gets…
          </div>
          <div className='space-y-2 rounded-b-md border border-t-0 border-white/10 bg-black/20 p-2'>
            {props.sideAAssets.length === 0 ? (
              <div className='px-2 py-3 text-sm text-gray-400'>No assets</div>
            ) : (
              props.sideAAssets.map((asset) => (
                <TradeAssetTag key={asset.key} asset={asset} valueTone={toneA} />
              ))
            )}
            <TradeSideTotals
              value={a}
              pieceCount={props.sideAAssets.length}
              tone={toneA}
            />
          </div>
        </div>
        <div>
          <div className='rounded-t-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-gray-100 sm:text-sm'>
            {props.sideBLabel} gets…
          </div>
          <div className='space-y-2 rounded-b-md border border-t-0 border-white/10 bg-black/20 p-2'>
            {props.sideBAssets.length === 0 ? (
              <div className='px-2 py-3 text-sm text-gray-400'>No assets</div>
            ) : (
              props.sideBAssets.map((asset) => (
                <TradeAssetTag key={asset.key} asset={asset} valueTone={toneB} />
              ))
            )}
            <TradeSideTotals
              value={b}
              pieceCount={props.sideBAssets.length}
              tone={toneB}
            />
          </div>
        </div>
      </div>

      <div
        className='relative h-6 overflow-hidden rounded-sm bg-rose-950/40 sm:h-7'
        role='img'
        aria-label={`${props.sideALabel} ${a.toLocaleString()} KTC versus ${props.sideBLabel} ${b.toLocaleString()} KTC`}
      >
        <div
          className={`absolute inset-y-0 left-0 ${favorsA ? 'bg-green-600/85' : favorsB ? 'bg-red-600/85' : 'bg-gray-500/70'}`}
          style={{ width: `${aShare}%` }}
          aria-hidden
        />
        <div
          className='pointer-events-none absolute inset-y-0 left-1/2 z-10 w-1.5 -translate-x-1/2 border-x border-dashed border-gray-400/90 bg-gray-900/50'
          aria-hidden
        />
        <span
          className='pointer-events-none absolute inset-y-0 left-1 z-20 flex max-w-[45%] items-center truncate px-1 text-[10px] font-bold tabular-nums text-white drop-shadow sm:text-xs'
          title={`${props.sideALabel}: ${a.toLocaleString()} KTC`}
        >
          {a.toLocaleString()}
        </span>
        <span
          className='pointer-events-none absolute inset-y-0 right-1 z-20 flex max-w-[45%] items-center justify-end truncate px-1 text-[10px] font-bold tabular-nums text-white drop-shadow sm:text-xs'
          title={`${props.sideBLabel}: ${b.toLocaleString()} KTC`}
        >
          {b.toLocaleString()}
        </span>
      </div>

      <div className='rounded-md border border-rose-900/35 bg-rose-950/25 px-3 py-3 text-center sm:px-4'>
        {even ? (
          <p className='text-sm font-semibold text-gray-200 sm:text-base'>Even on KTC value</p>
        ) : favorsA ? (
          <>
            <p className='text-sm font-bold text-gray-100 sm:text-base'>
              ← Favors {props.sideALabel}
            </p>
            <p className='mt-1 text-xs text-red-300/90 sm:text-sm'>
              Add about{' '}
              <span className='font-bold tabular-nums text-red-200'>
                {diff.toLocaleString()}
              </span>{' '}
              KTC to {props.sideBLabel} to even the trade →
            </p>
          </>
        ) : (
          <>
            <p className='text-sm font-bold text-gray-100 sm:text-base'>
              Favors {props.sideBLabel} →
            </p>
            <p className='mt-1 text-xs text-red-300/90 sm:text-sm'>
              ← Add about{' '}
              <span className='font-bold tabular-nums text-red-200'>
                {diff.toLocaleString()}
              </span>{' '}
              KTC to {props.sideALabel} to even the trade
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const MODEL_FRIENDLY_HINTS: Record<string, string> = {
  'gemini-2.0-flash': 'higher rate limits, slightly slower',
};

export function buildModelSelectOptions(
  selectableModels: string[],
  serverDefault: string
): Array<{ value: string; label: string }> {
  const defaultNorm = serverDefault.trim();
  const extras = selectableModels
    .map((m) => m.trim())
    .filter((m) => m && m !== defaultNorm);
  const options: Array<{ value: string; label: string }> = [
    {
      value: '',
      label: defaultNorm ? `${defaultNorm} (default)` : 'Server default',
    },
  ];
  for (const m of extras) {
    const hint = MODEL_FRIENDLY_HINTS[m];
    options.push({ value: m, label: hint ? `${m} (${hint})` : m });
  }
  return options;
}
