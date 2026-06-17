// src/__tests__/injuryResolution.test.ts
import { describe, it, expect } from 'vitest';
import { resolveInjury, injuryBadge } from '../playerFunctions';
import type { Player } from '../types';

const base = { player_id: '1', position: 'WR' } as Player;

describe('injuryBadge', () => {
  it('returns null for a healthy player', () => {
    expect(injuryBadge(base)).toBeNull();
  });
  it('maps Out/IR to a danger code and Questionable/Doubtful to warn', () => {
    expect(injuryBadge({ ...base, injury_status: 'Out' } as Player)).toMatchObject({ code: 'OUT', tone: 'danger' });
    expect(injuryBadge({ ...base, injury_status: 'IR' } as Player)).toMatchObject({ code: 'IR', tone: 'danger' });
    expect(injuryBadge({ ...base, injury_status: 'Questionable' } as Player)).toMatchObject({ code: 'Q', tone: 'warn' });
    expect(injuryBadge({ ...base, injury_status: 'Doubtful' } as Player)).toMatchObject({ code: 'D', tone: 'warn' });
  });
  it('falls back to a generic code and includes a tooltip title', () => {
    const b = injuryBadge({ ...base, weekly_injury_status: 'Limited' } as Player);
    expect(b?.code).toBe('INJ');
    expect(b?.title).toContain('Limited');
  });
});

describe('resolveInjury source precedence', () => {
  it('prefers Sleeper injury status (danger) over KTC', () => {
    const p = {
      ...base,
      injury_status: 'Questionable',
      injury_body_part: 'Hamstring',
      ktc: { injury: { injuryName: 'Knee' } },
    } as Player;
    const r = resolveInjury(p);
    expect(r?.source).toBe('sleeper');
    expect(r?.severity).toBe('danger');
    expect(r?.text).toContain('Questionable');
    expect(r?.text).toContain('Hamstring');
  });

  it('treats practice participation alone as a Sleeper signal (warn)', () => {
    const p = { ...base, practice_participation: 'Limited Practice' } as Player;
    const r = resolveInjury(p);
    expect(r?.source).toBe('sleeper');
    expect(r?.severity).toBe('warn');
  });

  it('falls back to KTC injury blob when Sleeper is empty', () => {
    const p = { ...base, injury_status: '', ktc: { injury: { injuryName: 'Ankle' } } } as Player;
    const r = resolveInjury(p);
    expect(r?.source).toBe('ktc');
    expect(r?.text).toContain('Ankle');
  });

  it('falls back to weekly injury status last', () => {
    const p = { ...base, weekly_injury_status: 'Out' } as Player;
    expect(resolveInjury(p)?.source).toBe('weekly');
  });

  it('returns null when every source is healthy', () => {
    const p = { ...base, injury_status: '', ktc: { injury: { injuryCode: 1 } } } as Player;
    expect(resolveInjury(p)).toBeNull();
  });
});
