import { Player, RosterSettings, TeamData } from '../types';

export function getLeagueStatusInfo(status: string): { label: string; className: string } {
  switch (status.toLowerCase()) {
    case 'in_season': return { label: 'In Season', className: 'bg-green-600/20 text-green-400 border border-green-600/30' };
    case 'post_season': return { label: 'Playoffs', className: 'bg-purple-600/20 text-purple-400 border border-purple-600/30' };
    case 'pre_draft': return { label: 'Pre-Draft', className: 'bg-blue-600/20 text-blue-400 border border-blue-600/30' };
    case 'drafting': return { label: 'Drafting', className: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' };
    case 'complete': return { label: 'Season Completed', className: 'bg-gray-600/20 text-gray-400 border border-gray-600/30' };
    default: return { label: status, className: 'bg-gray-600/20 text-gray-400 border border-gray-600/30' };
  }
}

export function getOwnershipTier(pct: number): string {
  if (pct >= 90) return 'text-green-300';
  if (pct >= 65) return 'text-blue-300';
  if (pct >= 30) return 'text-yellow-300';
  if (pct >= 8) return 'text-red-300';
  return 'text-gray-400';
}

export function formatBirthDate(birthDate: string): string {
  // Append T00:00:00 so the ISO date is parsed in local time and not shifted by tz.
  const d = new Date(birthDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return birthDate;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatHeight(player: Player): string {
  const h = player.height?.trim();
  if (!h) return 'N/A';
  // Sleeper stores some heights as plain inches (e.g. "77"); render as 6'5".
  if (/^\d{1,2}$/.test(h)) {
    const inches = parseInt(h, 10);
    if (inches > 0) return `${Math.floor(inches / 12)}'${inches % 12}"`;
  }
  return h;
}

export function getTeamRecord(s: RosterSettings): string {
  const w = s.wins || 0, l = s.losses || 0, t = s.ties || 0;
  return `${w}-${l}${t > 0 ? `-${t}` : ''}`;
}

export function getGamesPlayed(s: RosterSettings): number {
  return (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
}

export function getPF(s: RosterSettings): string {
  return ((s.fpts || 0) + (s.fpts_decimal || 0) / 100).toFixed(2);
}

export function getPA(s: RosterSettings): string {
  return ((s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100).toFixed(2);
}

export function getMaxPF(s: RosterSettings): string {
  return ((s.ppts || 0) + (s.ppts_decimal || 0) / 100).toFixed(2);
}

export function getPPG(s: RosterSettings): string {
  const g = getGamesPlayed(s);
  return g ? (Number(getPF(s)) / g).toFixed(2) : '0.00';
}

export function getPAG(s: RosterSettings): string {
  const g = getGamesPlayed(s);
  return g ? (Number(getPA(s)) / g).toFixed(2) : '0.00';
}

export function getEff(s: RosterSettings): string {
  const pf = (s.fpts || 0) + (s.fpts_decimal || 0) / 100;
  const pp = (s.ppts || 0) + (s.ppts_decimal || 0) / 100;
  return pp > 0 ? ((pf / pp) * 100).toFixed(1) + '%' : '0.0%';
}

const TIER_GOOD = 'text-green-300';
const TIER_OK = 'text-yellow-300';
const TIER_BAD = 'text-red-300';

/**
 * League-relative color tier for a value within its peer set, split into
 * tertiles. Returns '' (no color) when there are too few teams or every value
 * is identical — nothing meaningful to rank. Set `higherIsBetter=false` for
 * stats where lower is better (e.g. Points Against).
 */
export function relativeTierClass(
  value: number,
  allValues: number[],
  higherIsBetter: boolean
): string {
  const finite = allValues.filter((v) => Number.isFinite(v));
  if (finite.length < 3 || !Number.isFinite(value)) return '';
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) return '';

  const below = finite.filter((v) => v < value).length;
  const frac = below / (finite.length - 1); // 0 = lowest, 1 = highest
  const goodness = higherIsBetter ? frac : 1 - frac;
  if (goodness >= 2 / 3) return TIER_GOOD;
  if (goodness >= 1 / 3) return TIER_OK;
  return TIER_BAD;
}

/**
 * Absolute color for lineup efficiency (PF ÷ MaxPF, as a percent). Efficiency
 * is meaningful on its own, so it uses fixed thresholds rather than a
 * league-relative rank. Returns '' for non-positive values (e.g. preseason).
 */
export function getEfficiencyColor(effPct: number): string {
  if (!Number.isFinite(effPct) || effPct <= 0) return '';
  if (effPct >= 95) return TIER_GOOD;
  if (effPct >= 85) return TIER_OK;
  return TIER_BAD;
}

export interface StandingsStatColors {
  pf: string;
  pa: string;
  diff: string;
  eff: string;
}

/**
 * Precompute per-team color tiers for the standings grid: league-relative for
 * the comparative stats (PF, PA, Diff) and absolute for efficiency. Keyed by
 * `roster_id` so the memoized `TeamPanel` can look up its own colors.
 */
export function buildStandingsStatColors(
  teams: TeamData[]
): Map<number, StandingsStatColors> {
  const pfVals = teams.map((t) => Number(getPF(t.roster.settings)));
  const paVals = teams.map((t) => Number(getPA(t.roster.settings)));
  const diffVals = teams.map((_, i) => pfVals[i] - paVals[i]);

  const map = new Map<number, StandingsStatColors>();
  teams.forEach((t, i) => {
    map.set(t.roster.roster_id, {
      pf: relativeTierClass(pfVals[i], pfVals, true),
      pa: relativeTierClass(paVals[i], paVals, false),
      diff: relativeTierClass(diffVals[i], diffVals, true),
      eff: getEfficiencyColor(parseFloat(getEff(t.roster.settings))),
    });
  });
  return map;
}
