import { describe, it, expect } from 'vitest';
import { playersAllCacheKey, isFresh } from '../playersAllCache';
import type { KtcConfig } from '../types';
const cfg = (o: Partial<KtcConfig> = {}): KtcConfig => ({ league_format: 'superflex', is_redraft: false, tep_level: 'tep', ...o });

describe('playersAll cache', () => {
  it('key includes league/format/redraft/tep/season', () => {
    expect(playersAllCacheKey('L1', cfg(), '2025')).toBe('L1|superflex|false|tep|2025');
  });
  it('isFresh respects the TTL', () => {
    const now = 1_000_000;
    expect(isFresh({ players: [], cachedAt: now - 1000 }, now, 60_000)).toBe(true);
    expect(isFresh({ players: [], cachedAt: now - 120_000 }, now, 60_000)).toBe(false);
  });
});
