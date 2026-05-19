import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import type { TradeAnalyzerHistoryEntry, TradeAnalyzerResponse } from '../../types';
import {
  KtcTradeComparison,
  type TradeAssetRow,
} from './tradeAssetUi';

function fairnessScoreColor(score: number): string {
  if (score >= 65) return 'text-green-400';
  if (score >= 45) return 'text-amber-300';
  return 'text-red-400';
}

function winnerLabelFor(winner: TradeAnalyzerResponse['winner']): string {
  if (winner === 'even') return 'Even trade';
  if (winner === 'a') return 'Side A wins';
  return 'Side B wins';
}

function historyTradeSummary(entry: TradeAnalyzerHistoryEntry): string {
  const aNames = [
    ...entry.side_a.players.map((p) => p.name),
    ...entry.side_a.picks.map((p) => p.label),
  ];
  const bNames = [
    ...entry.side_b.players.map((p) => p.name),
    ...entry.side_b.picks.map((p) => p.label),
  ];
  const fmt = (names: string[]) =>
    names.length === 0
      ? '—'
      : names.length <= 2
        ? names.join(', ')
        : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  return `${entry.side_a.team_name} (${fmt(aNames)}) ↔ ${entry.side_b.team_name} (${fmt(bNames)})`;
}

function assetsFromSide(side: TradeAnalyzerHistoryEntry['side_a']): TradeAssetRow[] {
  const { players, picks } = side;
  return [
    ...players.map((p) => ({
      key: p.player_id,
      name: p.name,
      position: p.position,
      ktc: p.ktc_value,
      rankLabel: p.rank_label,
    })),
    ...picks.map((p) => ({
      key: p.pick_id ?? p.label,
      name: p.label,
      ktc: p.ktc_value,
      rankLabel: null,
    })),
  ];
}

function FairnessScoreBadge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div
      className={`text-5xl font-bold tabular-nums leading-none sm:text-6xl ${fairnessScoreColor(clamped)}`}
      aria-label={`Fairness score ${clamped} out of 100`}
    >
      {clamped}
    </div>
  );
}

function ResultsColumn(props: {
  title: string;
  teamName: string;
  teamSubtitle: string;
  data: TradeAnalyzerResponse['side_a'];
}) {
  return (
    <div className='rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'>
      <div>
        <div className='text-sm font-semibold text-gray-100 sm:text-base'>{props.title}</div>
        <div className='mt-1 text-xs text-gray-400 sm:text-sm'>{props.teamName}</div>
        {props.teamSubtitle ? (
          <div className='text-[10px] text-gray-400'>{props.teamSubtitle}</div>
        ) : null}
      </div>

      <div className='mt-3 grid grid-cols-1 gap-3'>
        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='text-xs font-semibold text-gray-200 sm:text-sm'>KTC Delta</div>
          <div className='mt-2 grid grid-cols-3 gap-2 text-xs sm:text-sm'>
            <div className='rounded-md border border-white/10 bg-black/10 p-2'>
              <div className='text-gray-400'>Value in</div>
              <div className='mt-1 text-lg font-semibold tabular-nums text-gray-100 sm:text-xl'>
                {props.data.ktc_delta.values_in.toLocaleString()}
              </div>
            </div>
            <div className='rounded-md border border-white/10 bg-black/10 p-2'>
              <div className='text-gray-400'>Value out</div>
              <div className='mt-1 text-lg font-semibold tabular-nums text-gray-100 sm:text-xl'>
                {props.data.ktc_delta.values_out.toLocaleString()}
              </div>
            </div>
            <div className='rounded-md border border-white/10 bg-black/10 p-2'>
              <div className='text-gray-400'>Net</div>
              <div className='mt-1 text-lg font-semibold tabular-nums text-gray-100 sm:text-xl'>
                {props.data.ktc_delta.net.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Sleeper Data</div>
          <div className='mt-2 text-xs text-gray-300 sm:text-sm'>
            {props.data.sleeper_data.positional_impact}
          </div>
          <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-300 sm:text-sm'>
            {props.data.sleeper_data.needs_addressed.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Pros</div>
          <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-300 sm:text-sm'>
            {props.data.pros.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Cons</div>
          <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-300 sm:text-sm'>
            {props.data.cons.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AnalysisResultsPanel(props: {
  entry: TradeAnalyzerHistoryEntry;
  compact?: boolean;
  onRunAnother?: () => void;
}) {
  const { entry } = props;
  const res = entry.response;
  const sideAAssets = assetsFromSide(entry.side_a);
  const sideBAssets = assetsFromSide(entry.side_b);

  return (
    <div
      id={props.compact ? undefined : 'trade-analyzer-results'}
      className={props.compact ? 'pt-2' : 'mt-4 rounded-xl border border-white/10 bg-[#0d1e2e] p-4 sm:p-5'}
    >
      {!props.compact ? (
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <div className='text-base font-semibold text-gray-100 sm:text-lg'>Analysis Results</div>
            <div className='mt-1 text-xs text-gray-400 sm:text-sm'>
              Analyzed at {new Date(entry.createdAt).toLocaleString()}
            </div>
          </div>
          {props.onRunAnother ? (
            <button
              type='button'
              className='inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main sm:text-sm'
              onClick={props.onRunAnother}
            >
              Run another
            </button>
          ) : null}
        </div>
      ) : (
        <div className='mb-2 text-[10px] text-gray-400 sm:text-xs'>
          {new Date(entry.createdAt).toLocaleString()}
        </div>
      )}

      <div
        className={
          props.compact
            ? 'rounded-lg border border-white/10 bg-black/10 p-3'
            : 'mt-3 rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'
        }
      >
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Fairness score</div>
            <FairnessScoreBadge score={res.fairness_score} />
          </div>
          <div className='flex flex-col items-start gap-2 sm:items-end sm:pt-1'>
            <div className='inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-100 sm:text-sm'>
              {winnerLabelFor(res.winner)}
            </div>
          </div>
        </div>

        <div className='mt-4'>
          <KtcTradeComparison
            sideALabel={entry.side_a.team_name}
            sideBLabel={entry.side_b.team_name}
            sideAValue={entry.side_a.ktc_subtotal}
            sideBValue={entry.side_b.ktc_subtotal}
            sideAAssets={sideAAssets}
            sideBAssets={sideBAssets}
          />
        </div>
      </div>

      <div className='mt-3 grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ResultsColumn
          title='Side A'
          teamName={entry.side_a.team_name}
          teamSubtitle={entry.side_a.team_subtitle}
          data={res.side_a}
        />
        <ResultsColumn
          title='Side B'
          teamName={entry.side_b.team_name}
          teamSubtitle={entry.side_b.team_subtitle}
          data={res.side_b}
        />
      </div>

      <div
        className={
          props.compact
            ? 'mt-3 rounded-lg border border-white/10 bg-black/10 p-3'
            : 'mt-3 rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'
        }
      >
        <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Summary</div>
        <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-300 sm:text-sm'>
          {res.summary_bullets.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function RecentTradeAnalysesSection(props: {
  entries: TradeAnalyzerHistoryEntry[];
  expandedId: string | null;
  pinnedId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <div className='mt-4 rounded-xl border border-white/10 bg-[#0d1e2e] p-4 sm:p-5'>
      <div className='text-base font-semibold text-gray-100 sm:text-lg'>Recent trade analyses</div>
      <div className='mt-3 space-y-2'>
        {props.entries.map((entry) => {
          const isExpanded = props.expandedId === entry.id;
          const isPinned = props.pinnedId === entry.id;
          if (isPinned) return null;
          return (
            <div
              key={entry.id}
              className='overflow-hidden rounded-lg border border-white/10 bg-black/10'
            >
              <button
                type='button'
                className='flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
                onClick={() => props.onToggleExpand(entry.id)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronUpIcon className='h-4 w-4 shrink-0 text-primary-main' aria-hidden />
                ) : (
                  <ChevronDownIcon className='h-4 w-4 shrink-0 text-gray-400' aria-hidden />
                )}
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-2 text-xs sm:text-sm'>
                    <span
                      className={`text-lg font-bold tabular-nums ${fairnessScoreColor(entry.response.fairness_score)}`}
                    >
                      {Math.round(entry.response.fairness_score)}
                    </span>
                    <span className='text-gray-400'>
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    <span className='rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-200 sm:text-xs'>
                      {winnerLabelFor(entry.response.winner)}
                    </span>
                  </div>
                  <div className='mt-0.5 truncate text-[10px] text-gray-400 sm:text-xs'>
                    {historyTradeSummary(entry)}
                  </div>
                </div>
              </button>
              {isExpanded ? (
                <div className='border-t border-white/10 px-3 pb-3 pt-1'>
                  <AnalysisResultsPanel entry={entry} compact />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
