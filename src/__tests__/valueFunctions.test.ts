// src/__tests__/valueFunctions.test.ts
import { describe, it, expect } from 'vitest';
import { consensusValue, valueSources } from '../playerFunctions';
import type { Player } from '../types';

const p = {
  player_id: '1', player_name: 'Josh Allen', position: 'QB',
  values: { consensus: 8050, sources: { ktc: { value: 8200 }, fantasycalc: { value: 7900 } } },
} as unknown as Player;

describe('value helpers', () => {
  it('consensusValue returns the consensus number', () => {
    expect(consensusValue(p)).toBe(8050);
  });
  it('valueSources lists present sources', () => {
    expect(valueSources(p).map((s) => s.key).sort()).toEqual(['fantasycalc', 'ktc']);
  });
  it('consensusValue is null when absent', () => {
    expect(consensusValue({} as Player)).toBeNull();
  });
});
