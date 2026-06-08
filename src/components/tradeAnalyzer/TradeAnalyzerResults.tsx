import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { normalizeTradeAnalyzerResponse } from '../../services/tradeAnalyzer';
import type {
  TradeAnalyzerHistoryEntry,
  TradeAnalyzerResponse,
} from '../../types';
import {
  KtcTradeComparison,
  type TradeAssetRow,
} from './tradeAssetUi';
import {
  resolveSideTradeGrade,
  tradeGradeBorderClass,
  tradeGradeColorClass,
} from './tradeGrades';

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
    ...picks.map((p, i) => ({
      key: `${p.pick_id ?? p.label}-${i}`,
      name: p.label,
      ktc: p.ktc_value,
      rankLabel: null,
    })),
  ];
}

function formatSideAssetList(side: TradeAnalyzerHistoryEntry['side_a']): string {
  const names = [
    ...side.players.map((p) => p.name),
    ...side.picks.map((p) => p.label),
  ];
  return names.length > 0 ? names.join(', ') : '—';
}

function TradeGradeBadge(props: { grade: string; className?: string }) {
  return (
    <span
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md border px-2 py-0.5 text-sm font-bold tabular-nums sm:text-base ${tradeGradeBorderClass(props.grade)} ${tradeGradeColorClass(props.grade)} ${props.className ?? ''}`}
      aria-label={`Trade grade ${props.grade}`}
    >
      {props.grade}
    </span>
  );
}

function TeamGradeRow(props: {
  teamName: string;
  grade: string;
}) {
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2'>
      <span className='truncate text-xs font-semibold text-gray-200 sm:text-sm'>
        {props.teamName}
      </span>
      <span className='text-gray-500' aria-hidden>
        ·
      </span>
      <TradeGradeBadge grade={props.grade} />
    </div>
  );
}

function ResultsColumn(props: {
  teamName: string;
  teamSubtitle: string;
  grade: string;
  data: TradeAnalyzerResponse['side_a'];
}) {
  const hasPros = props.data.pros.length > 0;
  const hasCons = props.data.cons.length > 0;

  return (
    <div className='rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div>
          <div className='text-sm font-semibold text-gray-100 sm:text-base'>{props.teamName}</div>
          {props.teamSubtitle ? (
            <div className='mt-1 text-xs text-gray-400 sm:text-sm'>{props.teamSubtitle}</div>
          ) : null}
        </div>
        <TradeGradeBadge grade={props.grade} />
      </div>

      <div className='mt-2 grid grid-cols-1 gap-2'>
        {hasPros ? (
          <div className='rounded-lg border border-white/10 bg-white/5 p-2 sm:p-3'>
            <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Pros</div>
            <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-300 sm:text-sm'>
              {props.data.pros.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {hasCons ? (
          <div className='rounded-lg border border-white/10 bg-white/5 p-2 sm:p-3'>
            <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Cons</div>
            <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-300 sm:text-sm'>
              {props.data.cons.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
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
  const res = normalizeTradeAnalyzerResponse(entry.response);
  const sideAReceives = assetsFromSide(entry.side_b);
  const sideBReceives = assetsFromSide(entry.side_a);
  const gradeA = resolveSideTradeGrade(res.side_a, res.winner, 'a');
  const gradeB = resolveSideTradeGrade(res.side_b, res.winner, 'b');

  return (
    <div
      id={props.compact ? undefined : 'trade-analyzer-results'}
      className={props.compact ? 'pt-2' : 'mt-3 rounded-xl border border-white/10 bg-[#0d1e2e] p-3 sm:p-4'}
    >
      {!props.compact ? (
        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
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
        <div className='mb-2 text-xs text-gray-400 sm:text-sm'>
          {new Date(entry.createdAt).toLocaleString()}
        </div>
      )}

      <div
        className={
          props.compact
            ? 'rounded-lg border border-white/10 bg-black/10 p-2'
            : 'mt-2 rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'
        }
      >
        <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Trade grades</div>
        <div className='mt-3'>
          <KtcTradeComparison
            sideALabel={entry.side_a.team_name}
            sideBLabel={entry.side_b.team_name}
            sideAValue={entry.side_b.ktc_subtotal}
            sideBValue={entry.side_a.ktc_subtotal}
            sideAAssets={sideAReceives}
            sideBAssets={sideBReceives}
          />
        </div>
      </div>

      <div
        className={
          props.compact
            ? 'mt-2 rounded-lg border border-white/10 bg-black/10 p-2'
            : 'mt-2 rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'
        }
      >
        <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Summary</div>
        <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-300 sm:text-sm'>
          {res.summary_bullets.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <div className='mt-2 grid grid-cols-1 gap-3 md:grid-cols-2'>
        <ResultsColumn
          teamName={entry.side_a.team_name}
          teamSubtitle={entry.side_a.team_subtitle}
          grade={gradeA}
          data={res.side_a}
        />
        <ResultsColumn
          teamName={entry.side_b.team_name}
          teamSubtitle={entry.side_b.team_subtitle}
          grade={gradeB}
          data={res.side_b}
        />
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
    <div className='mt-3 rounded-xl border border-white/10 bg-[#0d1e2e] p-3 sm:p-4'>
      <div className='text-base font-semibold text-gray-100 sm:text-lg'>Recent trade analyses</div>
      <div className='mt-2 space-y-1.5'>
        {props.entries.map((entry) => {
          const isExpanded = props.expandedId === entry.id;
          const isPinned = props.pinnedId === entry.id;
          if (isPinned) return null;
          const res = normalizeTradeAnalyzerResponse(entry.response);
          const gradeA = resolveSideTradeGrade(res.side_a, res.winner, 'a');
          const gradeB = resolveSideTradeGrade(res.side_b, res.winner, 'b');
          return (
            <div
              key={entry.id}
              className='overflow-hidden rounded-lg border border-white/10 bg-black/10'
            >
              <button
                type='button'
                className='flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
                onClick={() => props.onToggleExpand(entry.id)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronUpIcon className='mt-0.5 h-4 w-4 shrink-0 text-primary-main' aria-hidden />
                ) : (
                  <ChevronDownIcon className='mt-0.5 h-4 w-4 shrink-0 text-gray-400' aria-hidden />
                )}
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm'>
                    <TeamGradeRow teamName={entry.side_a.team_name} grade={gradeA} />
                    <span className='text-gray-500' aria-hidden>
                      vs
                    </span>
                    <TeamGradeRow teamName={entry.side_b.team_name} grade={gradeB} />
                    <span className='text-gray-400'>
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className='mt-1.5 space-y-0.5 text-xs text-gray-300 sm:text-sm'>
                    <p>
                      <span className='font-semibold text-gray-200'>{entry.side_a.team_name}:</span>{' '}
                      {formatSideAssetList(entry.side_a)}
                    </p>
                    <p>
                      <span className='font-semibold text-gray-200'>{entry.side_b.team_name}:</span>{' '}
                      {formatSideAssetList(entry.side_b)}
                    </p>
                  </div>
                </div>
              </button>
              {isExpanded ? (
                <div className='border-t border-white/10 px-3 pb-2 pt-1'>
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
