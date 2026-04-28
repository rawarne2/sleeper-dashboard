import { Player, RosterSettings } from '../types';

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
  return player.height && player.height.trim().length > 0 ? player.height : 'N/A';
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
