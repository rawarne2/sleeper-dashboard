import { describe, it, expect } from 'vitest';
import { API_CONFIG } from '../apiConfig';
describe('EXAMPLE_LEAGUES', () => {
  it('has 8 entries with full shape', () => {
    const ls = API_CONFIG.EXAMPLE_LEAGUES;
    expect(ls).toHaveLength(8);
    for (const l of ls) {
      expect(typeof l.id).toBe('string'); expect(typeof l.name).toBe('string');
      expect(typeof l.season).toBe('number');
      expect(['1qb','superflex']).toContain(l.format);
      expect(['dynasty','redraft','keeper']).toContain(l.league_type);
      expect(['none','tep','tepp','teppp']).toContain(l.tep);
    }
  });
  it('covers every TEP level + a redraft + a 1qb', () => {
    const ls = API_CONFIG.EXAMPLE_LEAGUES;
    expect(new Set(ls.map((l) => l.tep))).toEqual(new Set(['none','tep','tepp','teppp']));
    expect(ls.some((l) => l.league_type === 'redraft')).toBe(true);
    expect(ls.some((l) => l.format === '1qb')).toBe(true);
  });
});
