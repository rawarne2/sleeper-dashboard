// src/__tests__/leagueConfig.test.ts
import { describe, it, expect } from 'vitest';
import {
  resolveLeagueKtcConfig,
  resolveTepLevel,
  FALLBACK_KTC_CONFIG,
  formatLeagueFormatLabel,
  formatLeagueTypeLabel,
  formatTepLevelLabel,
} from '../utils/leagueConfig';
import type { League } from '../types';

const league = (over: Partial<League>): League => ({
  league_id: 'x',
  name: 'L',
  season: '2025',
  total_rosters: 12,
  status: 'complete',
  ...over,
});

describe('resolveLeagueKtcConfig', () => {
  it('falls back to SF / dynasty / tep when league is null', () => {
    expect(resolveLeagueKtcConfig(null)).toEqual(FALLBACK_KTC_CONFIG);
  });

  it('detects superflex dynasty TEP (SUPER_FLEX, type 2, bonus_rec_te 0.5)', () => {
    const cfg = resolveLeagueKtcConfig(
      league({
        roster_positions: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN'],
        league_settings: { type: 2, taxi_slots: 4 },
        scoring_settings: { bonus_rec_te: 0.5, rec: 0.5 },
      })
    );
    expect(cfg).toEqual({ league_format: 'superflex', is_redraft: false, tep_level: 'tep' });
  });

  it('detects 1QB redraft non-TEP', () => {
    const cfg = resolveLeagueKtcConfig(
      league({
        roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN'],
        league_settings: { type: 0, taxi_slots: 0 },
        scoring_settings: { bonus_rec_te: 0, rec: 1 },
      })
    );
    expect(cfg).toEqual({ league_format: '1qb', is_redraft: true, tep_level: '' });
  });

  it('treats 2+ QB slots as superflex even without a SUPER_FLEX slot', () => {
    expect(
      resolveLeagueKtcConfig(league({ roster_positions: ['QB', 'QB', 'RB', 'WR'] })).league_format
    ).toBe('superflex');
  });

  it('maps TE-premium tiers from bonus_rec_te', () => {
    const tep = (bte: number) =>
      resolveLeagueKtcConfig(league({ scoring_settings: { bonus_rec_te: bte } })).tep_level;
    expect(tep(1.0)).toBe('tepp');
    expect(tep(1.5)).toBe('teppp');
    expect(tep(0)).toBe('');
  });

  it('keeps a taxi-squad keeper league as dynasty (not redraft)', () => {
    expect(
      resolveLeagueKtcConfig(league({ league_settings: { type: 1, taxi_slots: 2 } })).is_redraft
    ).toBe(false);
  });
});

describe('resolveTepLevel', () => {
  it('rounds bonus_rec_te to the nearest KTC bucket', () => {
    expect(resolveTepLevel(0)).toBe('');
    expect(resolveTepLevel(0.5)).toBe('tep');
    expect(resolveTepLevel(0.75)).toBe('tepp');    // 0.75 is the tep/tepp edge → tepp
    expect(resolveTepLevel(0.8)).toBe('tepp');     // nearest 1.0
    expect(resolveTepLevel(1.33)).toBe('teppp');   // ≥1.25 edge → teppp
    expect(resolveTepLevel(2.0)).toBe('teppp');    // clamps to highest bucket
  });

  it('treats null/undefined as no TE premium', () => {
    expect(resolveTepLevel(null)).toBe('');
    expect(resolveTepLevel(undefined)).toBe('');
  });
});

describe('formatKtcConfigLabels', () => {
  it('formats league format, type, and TE premium for display', () => {
    expect(formatLeagueFormatLabel('1qb')).toBe('1QB');
    expect(formatLeagueFormatLabel('superflex')).toBe('Superflex');
    expect(formatTepLevelLabel('')).toBe('No TEP');
    expect(formatTepLevelLabel('tepp')).toBe('TEPP');
    expect(
      formatLeagueTypeLabel(
        league({ league_settings: { type: 1, taxi_slots: 2 } }),
        { league_format: 'superflex', is_redraft: false, tep_level: 'tep' }
      )
    ).toBe('Keeper');
    expect(
      formatLeagueTypeLabel(
        league({ league_settings: { type: 0, taxi_slots: 0 } }),
        { league_format: '1qb', is_redraft: true, tep_level: '' }
      )
    ).toBe('Redraft');
  });
});
