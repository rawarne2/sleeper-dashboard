// src/__tests__/valueFunctions.test.ts
import { describe, it, expect } from 'vitest';
import { blendedValue, valueSources } from '../playerFunctions';
import type { Player } from '../types';

const p = {
  player_id: '1', player_name: 'Josh Allen', position: 'QB',
  values: { blended: 8050, sources: { ktc: { value: 8200 }, fantasycalc: { value: 7900 } } },
} as unknown as Player;

describe('value helpers', () => {
  it('blendedValue returns the blended number', () => {
    expect(blendedValue(p)).toBe(8050);
  });
  it('valueSources lists present sources', () => {
    expect(valueSources(p).map((s) => s.key).sort()).toEqual(['fantasycalc', 'ktc']);
  });
  it('blendedValue is null when absent', () => {
    expect(blendedValue({} as Player)).toBeNull();
  });
});
