import type { KtcConfig, League, Roster } from '../types';

/** Default KTC identity when a league's settings can't be detected. */
export const FALLBACK_KTC_CONFIG: KtcConfig = {
  league_format: 'superflex',
  is_redraft: false,
  tep_level: 'tep',
};

const SUPERFLEX_SLOTS = new Set(['SUPER_FLEX', 'SFLEX', 'QB/WR/RB/TE']);

/**
 * Map a league's `bonus_rec_te` to the nearest KTC TE-premium bucket
 * (0→'', 0.5→tep, 1.0→tepp, 1.5→teppp). Bucket edges sit at 0.25 / 0.75 / 1.25,
 * and anything at or above 1.25 clamps to the highest bucket.
 */
export function resolveTepLevel(bonusRecTe: number | null | undefined): KtcConfig['tep_level'] {
  const b = typeof bonusRecTe === 'number' ? bonusRecTe : 0;
  if (b < 0.25) return '';
  if (b < 0.75) return 'tep';
  if (b < 1.25) return 'tepp';
  return 'teppp';
}

/**
 * Best-effort detection of a league's KTC query identity from its Sleeper
 * settings. Each field falls back independently to FALLBACK_KTC_CONFIG so a
 * partially-populated league still yields a sensible config.
 *
 * - format: superflex if the roster has a SUPER_FLEX slot or 2+ QB slots.
 * - dynasty/redraft: Sleeper `type` 2=dynasty, 1=keeper, 0=redraft; a taxi
 *   squad implies dynasty. Defaults to dynasty.
 * - TE premium: `bonus_rec_te` rounded to the nearest KTC bucket via resolveTepLevel.
 */
export function resolveLeagueKtcConfig(
  league: League | null | undefined,
  _rosters?: Roster[]
): KtcConfig {
  if (!league) return { ...FALLBACK_KTC_CONFIG };

  let league_format = FALLBACK_KTC_CONFIG.league_format;
  const rp = league.roster_positions;
  if (Array.isArray(rp) && rp.length > 0) {
    const qbCount = rp.filter((p) => p === 'QB').length;
    const hasSuperflex = rp.some((p) => SUPERFLEX_SLOTS.has(p));
    league_format = hasSuperflex || qbCount >= 2 ? 'superflex' : '1qb';
  }

  let is_redraft = FALLBACK_KTC_CONFIG.is_redraft;
  const ls = league.league_settings;
  if (ls && typeof ls.type === 'number') {
    const taxi = ls.taxi_slots ?? 0;
    is_redraft = ls.type === 0 && taxi === 0;
  }

  const bte = league.scoring_settings?.bonus_rec_te;
  // Unknown scoring → assume the common TE-premium default; otherwise round to the
  // nearest KTC bucket.
  const tep_level: KtcConfig['tep_level'] =
    typeof bte === 'number' ? resolveTepLevel(bte) : FALLBACK_KTC_CONFIG.tep_level;

  return { league_format, is_redraft, tep_level };
}

export function ktcConfigEquals(a: KtcConfig, b: KtcConfig): boolean {
  return (
    a.league_format === b.league_format &&
    a.is_redraft === b.is_redraft &&
    a.tep_level === b.tep_level
  );
}

const FLEX_SLOTS = new Set(['FLEX','SUPER_FLEX','REC_FLEX','WRRB_FLEX','WRRB_WRT','IDP_FLEX']);
const FLEX_COVERS = ['RB','WR','TE'];

/** Position filter chips the league actually starts, in canonical order. */
export function availablePositions(league: { roster_positions?: string[] } | null | undefined): string[] {
  const rp = league?.roster_positions;
  if (!Array.isArray(rp) || rp.length === 0) return ['QB','RB','WR','TE','K','DEF'];
  const slots = new Set(rp);
  const hasFlex = rp.some((s) => FLEX_SLOTS.has(s));
  const show = (p: string) =>
    slots.has(p) ||
    (p === 'QB' && slots.has('SUPER_FLEX')) ||
    (hasFlex && FLEX_COVERS.includes(p));
  return ['QB','RB','WR','TE','K','DEF'].filter(show);
}

/** Query params for the dashboard / players-all endpoints. */
export function ktcConfigParams(config: KtcConfig): Record<string, string> {
  return {
    league_format: config.league_format,
    is_redraft: String(config.is_redraft),
    tep_level: config.tep_level,
  };
}
