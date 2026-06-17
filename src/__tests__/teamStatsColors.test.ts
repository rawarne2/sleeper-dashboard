import { describe, it, expect } from 'vitest';
import {
  relativeTierClass,
  getEfficiencyColor,
  buildStandingsStatColors,
} from '../utils/teamStats';
import type { TeamData } from '../types';

const GOOD = 'text-green-300';
const OK = 'text-yellow-300';
const BAD = 'text-red-300';

describe('relativeTierClass', () => {
  const vals = [10, 20, 30, 40, 50, 60, 70, 80, 90]; // 9 teams

  it('puts the top third green and bottom third red (higher is better)', () => {
    expect(relativeTierClass(90, vals, true)).toBe(GOOD);
    expect(relativeTierClass(10, vals, true)).toBe(BAD);
    expect(relativeTierClass(50, vals, true)).toBe(OK);
  });

  it('inverts when lower is better (e.g. Points Against)', () => {
    expect(relativeTierClass(10, vals, false)).toBe(GOOD);
    expect(relativeTierClass(90, vals, false)).toBe(BAD);
  });

  it('returns no color with too few teams or all-equal values', () => {
    expect(relativeTierClass(10, [10, 20], true)).toBe('');
    expect(relativeTierClass(5, [5, 5, 5, 5], true)).toBe('');
    expect(relativeTierClass(NaN, vals, true)).toBe('');
  });
});

describe('getEfficiencyColor', () => {
  it('uses absolute thresholds', () => {
    expect(getEfficiencyColor(96)).toBe(GOOD);
    expect(getEfficiencyColor(95)).toBe(GOOD);
    expect(getEfficiencyColor(90)).toBe(OK);
    expect(getEfficiencyColor(85)).toBe(OK);
    expect(getEfficiencyColor(80)).toBe(BAD);
  });

  it('returns no color for non-positive efficiency (preseason)', () => {
    expect(getEfficiencyColor(0)).toBe('');
    expect(getEfficiencyColor(NaN)).toBe('');
  });
});

describe('buildStandingsStatColors', () => {
  function team(rosterId: number, fpts: number, against: number, ppts: number): TeamData {
    return {
      roster: {
        roster_id: rosterId,
        settings: {
          fpts,
          fpts_decimal: 0,
          fpts_against: against,
          fpts_against_decimal: 0,
          ppts,
          ppts_decimal: 0,
        },
      },
      // The builder only reads roster.settings; the rest is unused here.
    } as unknown as TeamData;
  }

  it('keys colors by roster_id with PF/PA/Diff relative and Eff absolute', () => {
    const teams = [
      team(1, 300, 250, 320), // high PF, eff ~93.75
      team(2, 200, 300, 400), // low PF, high PA, eff 50
      team(3, 250, 200, 250), // low PA, eff 100
    ];
    const colors = buildStandingsStatColors(teams);

    expect(colors.get(1)!.pf).toBe(GOOD); // highest PF
    expect(colors.get(2)!.pf).toBe(BAD); // lowest PF
    expect(colors.get(3)!.pa).toBe(GOOD); // lowest PA is best
    expect(colors.get(2)!.pa).toBe(BAD); // highest PA is worst
    expect(colors.get(3)!.eff).toBe(GOOD); // 100% efficiency
    expect(colors.get(2)!.eff).toBe(BAD); // 50% efficiency
  });
});
