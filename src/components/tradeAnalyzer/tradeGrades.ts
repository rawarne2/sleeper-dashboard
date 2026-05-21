import type { TradeAnalyzerResponse } from '../../types';

const VALID_GRADES = new Set([
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D+',
  'D',
  'D-',
  'F+',
  'F',
  'F-',
]);

export function normalizeTradeGrade(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (VALID_GRADES.has(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase().replace(/\s/g, '');
  if (VALID_GRADES.has(upper)) return upper;
  return null;
}

/** Client fallback for legacy history rows missing trade_grade. */
export function fallbackTradeGrade(
  winner: TradeAnalyzerResponse['winner'],
  side: 'a' | 'b'
): string {
  if (winner === 'even') return 'C';
  if (winner === 'a') return side === 'a' ? 'B+' : 'D+';
  if (winner === 'b') return side === 'b' ? 'B+' : 'D+';
  return 'C';
}

export function resolveSideTradeGrade(
  sideData: TradeAnalyzerResponse['side_a'],
  winner: TradeAnalyzerResponse['winner'],
  side: 'a' | 'b'
): string {
  return (
    normalizeTradeGrade(sideData.trade_grade) ??
    fallbackTradeGrade(winner, side)
  );
}

export function tradeGradeColorClass(grade: string): string {
  const g = grade.trim();
  if (g.startsWith('A')) return 'text-green-400';
  if (g.startsWith('B')) return 'text-emerald-300';
  if (g.startsWith('C')) return 'text-amber-300';
  if (g.startsWith('D')) return 'text-orange-400';
  return 'text-red-400';
}

export function tradeGradeBorderClass(grade: string): string {
  const g = grade.trim();
  if (g.startsWith('A')) return 'border-green-500/40 bg-green-950/25';
  if (g.startsWith('B')) return 'border-emerald-500/35 bg-emerald-950/20';
  if (g.startsWith('C')) return 'border-amber-500/35 bg-amber-950/20';
  if (g.startsWith('D')) return 'border-orange-500/35 bg-orange-950/20';
  return 'border-red-500/40 bg-red-950/25';
}
