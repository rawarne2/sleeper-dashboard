import { describe, it, expect } from 'vitest';
import { statColumnCount } from '../components/playerTable/layout';

describe('statColumnCount', () => {
  it('standings without redraft = 19, with redraft = 20', () => {
    expect(statColumnCount('standings', false)).toBe(19);
    expect(statColumnCount('standings', true)).toBe(20);
  });
  it('all-players without redraft = 21, with redraft = 22', () => {
    expect(statColumnCount('all-players', false)).toBe(21);
    expect(statColumnCount('all-players', true)).toBe(22);
  });
});
