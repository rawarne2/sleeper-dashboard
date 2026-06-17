import { describe, it, expect } from 'vitest';
import { availablePositions } from '../utils/leagueConfig';

const lg = (rp: string[]) => ({ roster_positions: rp } as never);

describe('availablePositions', () => {
  it('hides DEF and K when not rostered (Salt Factory-style)', () => {
    const pos = availablePositions(lg(['QB','RB','RB','WR','WR','TE','FLEX','SUPER_FLEX','BN']));
    expect(pos).toEqual(['QB','RB','WR','TE']);
  });
  it('includes K and DEF when present', () => {
    const pos = availablePositions(lg(['QB','RB','WR','TE','K','DEF','FLEX']));
    expect(pos).toEqual(['QB','RB','WR','TE','K','DEF']);
  });
  it('defaults to all offensive positions when settings missing', () => {
    expect(availablePositions(null)).toEqual(['QB','RB','WR','TE','K','DEF']);
  });
});
