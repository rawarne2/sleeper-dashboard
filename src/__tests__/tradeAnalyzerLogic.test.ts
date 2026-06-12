import { describe, it, expect } from 'vitest';
import type { Player, ProviderHealth, TeamData, TradeAnalyzerPick } from '../types';
import {
  createInitialState,
  reducer,
  uniqAssets,
  MAX_CONTEXT_CHARS,
  type State,
  type SelectedAsset,
} from '../pages/tradeAnalyzer/state';
import {
  avatarUrl,
  groupPlayersByPosition,
  inferAiRoutingDevChoice,
  inferAiRoutingFromProviders,
  isProviderUiDisabled,
  ownedPicksForRoster,
  pickLabel,
  picksAvailableToAdd,
  providerUiAvailable,
  teamDisplayName,
  teamSubtitle,
  tradeAnalyzerSeasonWire,
} from '../pages/tradeAnalyzer/helpers';

// --- fixtures -------------------------------------------------------------

const player = (id: string, position: string, ktcValue: number): Player =>
  ({
    player_id: id,
    playerName: id,
    position,
    // Backend hoists the league's TEP value to the top-level KTC block.
    ktc: { superflexValues: { value: ktcValue } },
  } as unknown as Player);

const team = (over: {
  rosterId?: number;
  team_name?: string;
  user_team_name?: string;
  display_name?: string;
  username?: string;
}): TeamData =>
  ({
    roster: { roster_id: over.rosterId ?? 1 },
    user: {
      metadata: over.team_name ? { team_name: over.team_name } : undefined,
      team_name: over.user_team_name,
      display_name: over.display_name ?? 'Display',
      username: over.username,
    },
  } as unknown as TeamData);

const pick = (over: Partial<TradeAnalyzerPick>): TradeAnalyzerPick => ({
  owner_roster_id: 1,
  season: 2026,
  round: 1,
  ...over,
});

const playerAsset = (playerId: string): SelectedAsset => ({ kind: 'player', playerId });
const pickAsset = (pickKey: string): SelectedAsset => ({ kind: 'pick', pickKey });

// --- state: uniqAssets ----------------------------------------------------

describe('uniqAssets', () => {
  it('dedupes players and picks, keeping first occurrence and order', () => {
    const input: SelectedAsset[] = [
      playerAsset('p1'),
      pickAsset('k1'),
      playerAsset('p1'),
      pickAsset('k1'),
      playerAsset('p2'),
    ];
    expect(uniqAssets(input)).toEqual([
      playerAsset('p1'),
      pickAsset('k1'),
      playerAsset('p2'),
    ]);
  });

  it('does not collapse a player and pick that share an id string', () => {
    expect(uniqAssets([playerAsset('x'), pickAsset('x')])).toHaveLength(2);
  });
});

// --- state: reducer -------------------------------------------------------

describe('reducer', () => {
  const base = (): State => {
    const s = createInitialState();
    s.sideA = { rosterId: 1, assets: [], isTanking: false };
    s.sideB = { rosterId: 2, assets: [], isTanking: false };
    return s;
  };

  it('setRoster sets roster, clears assets, preserves tanking', () => {
    const s0 = base();
    s0.sideA = { rosterId: 1, assets: [playerAsset('p1')], isTanking: true };
    const s1 = reducer(s0, { type: 'setRoster', side: 'a', rosterId: 5 });
    expect(s1.sideA).toEqual({ rosterId: 5, assets: [], isTanking: true });
  });

  it('setRoster clears the other side when it held the chosen roster', () => {
    const s0 = base();
    s0.sideB = { rosterId: 5, assets: [playerAsset('p9')], isTanking: true };
    const s1 = reducer(s0, { type: 'setRoster', side: 'a', rosterId: 5 });
    expect(s1.sideA.rosterId).toBe(5);
    expect(s1.sideB).toEqual({ rosterId: null, assets: [], isTanking: true });
  });

  it('togglePlayer is a no-op without a selected roster', () => {
    const s0 = createInitialState();
    expect(reducer(s0, { type: 'togglePlayer', side: 'a', playerId: 'p1' })).toBe(s0);
  });

  it('togglePlayer adds then removes the same player', () => {
    const added = reducer(base(), { type: 'togglePlayer', side: 'a', playerId: 'p1' });
    expect(added.sideA.assets).toEqual([playerAsset('p1')]);
    const removed = reducer(added, { type: 'togglePlayer', side: 'a', playerId: 'p1' });
    expect(removed.sideA.assets).toEqual([]);
  });

  it('togglePick adds then removes the same pick', () => {
    const added = reducer(base(), { type: 'togglePick', side: 'b', pickKey: 'k1' });
    expect(added.sideB.assets).toEqual([pickAsset('k1')]);
    const removed = reducer(added, { type: 'togglePick', side: 'b', pickKey: 'k1' });
    expect(removed.sideB.assets).toEqual([]);
  });

  it('clearSideAssets empties only the targeted side', () => {
    const s0 = base();
    s0.sideA = { rosterId: 1, assets: [playerAsset('p1')], isTanking: false };
    s0.sideB = { rosterId: 2, assets: [pickAsset('k1')], isTanking: false };
    const s1 = reducer(s0, { type: 'clearSideAssets', side: 'a' });
    expect(s1.sideA.assets).toEqual([]);
    expect(s1.sideB.assets).toEqual([pickAsset('k1')]);
  });

  it('setContext truncates to the max length', () => {
    const long = 'x'.repeat(MAX_CONTEXT_CHARS + 50);
    const s1 = reducer(createInitialState(), { type: 'setContext', value: long });
    expect(s1.context).toHaveLength(MAX_CONTEXT_CHARS);
  });

  it('analyze lifecycle moves results through loading/ready/idle', () => {
    const loading = reducer(createInitialState(), { type: 'analyzeStart' });
    expect(loading.results.status).toBe('loading');
    expect(reducer(loading, { type: 'analyzeReady' }).results.status).toBe('ready');
    expect(reducer(loading, { type: 'analyzeFailed' }).results.status).toBe('idle');
  });

  it('resetAll clears builder state but keeps the loaded providers', () => {
    const s0 = base();
    s0.providers = [{ provider: 'gemini', healthy: true }];
    s0.sideA = { rosterId: 1, assets: [playerAsset('p1')], isTanking: true };
    s0.context = 'notes';
    const s1 = reducer(s0, { type: 'resetAll' });
    expect(s1.providers).toBe(s0.providers);
    expect(s1.sideA).toEqual({ rosterId: null, assets: [], isTanking: false });
    expect(s1.context).toBe('');
    expect(s1.results.status).toBe('idle');
  });

  it('gate blocks until feedback resolved', () => {
    const ready = reducer(createInitialState(), { type: 'analyzeReady', analysisId: 'x1' });
    expect(ready.pendingFeedbackAnalysisId).toBe('x1');
    const resolved = reducer(ready, { type: 'feedbackResolved' });
    expect(resolved.pendingFeedbackAnalysisId).toBeNull();
  });
  it('analyzeReady with no id does not gate', () => {
    const ready = reducer(createInitialState(), { type: 'analyzeReady' });
    expect(ready.pendingFeedbackAnalysisId).toBeNull();
  });
});

// --- helpers: team labels -------------------------------------------------

describe('team label helpers', () => {
  it('teamDisplayName prefers metadata team_name, then column, then display_name', () => {
    expect(teamDisplayName(team({ team_name: 'Meta', user_team_name: 'Col', display_name: 'Disp' }))).toBe('Meta');
    expect(teamDisplayName(team({ user_team_name: 'Col', display_name: 'Disp' }))).toBe('Col');
    expect(teamDisplayName(team({ display_name: 'Disp' }))).toBe('Disp');
  });

  it('teamSubtitle prefers username, falling back to display_name', () => {
    expect(teamSubtitle(team({ username: 'user', display_name: 'Disp' }))).toBe('user');
    expect(teamSubtitle(team({ display_name: 'Disp' }))).toBe('Disp');
  });

  it('avatarUrl builds a sleepercdn url or null', () => {
    expect(avatarUrl('abc')).toBe('https://sleepercdn.com/avatars/thumbs/abc');
    expect(avatarUrl(undefined)).toBeNull();
  });
});

// --- helpers: groupPlayersByPosition --------------------------------------

describe('groupPlayersByPosition', () => {
  it('orders standard positions and sorts each group by KTC descending', () => {
    const groups = groupPlayersByPosition([
      player('rb-lo', 'RB', 10),
      player('qb', 'QB', 50),
      player('rb-hi', 'RB', 90),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['QB', 'RB']);
    expect(groups[1].players.map((p) => p.player_id)).toEqual(['rb-hi', 'rb-lo']);
  });

  it('appends unknown positions after the standard order', () => {
    const groups = groupPlayersByPosition([
      player('flex', 'OL', 5),
      player('qb', 'QB', 5),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['QB', 'OL']);
  });
});

// --- helpers: provider routing --------------------------------------------

describe('provider availability', () => {
  it('locks non-gemini providers when client choice is disallowed', () => {
    expect(isProviderUiDisabled('openai', false)).toBe(true);
    expect(isProviderUiDisabled('gemini', false)).toBe(false);
    expect(isProviderUiDisabled('openai', true)).toBe(false);
  });

  it('providerUiAvailable requires both healthy and not-locked', () => {
    const gemini: ProviderHealth = { provider: 'gemini', healthy: true };
    const openai: ProviderHealth = { provider: 'openai', healthy: true };
    expect(providerUiAvailable(gemini, false)).toBe(true);
    expect(providerUiAvailable(openai, false)).toBe(false);
    expect(providerUiAvailable({ provider: 'gemini', healthy: false }, false)).toBe(false);
  });
});

describe('inferAiRoutingFromProviders', () => {
  it('returns an Unknown/backend-down message with no providers', () => {
    const out = inferAiRoutingFromProviders([]);
    expect(out.serviceLabel).toBe('Unknown');
    expect(out.modelLabel).toMatch(/backend/i);
  });

  it('uses the default provider and its first model', () => {
    const providers: ProviderHealth[] = [
      { provider: 'gemini', healthy: true, models: ['gemini-2.5-flash'] },
      { provider: 'openai', healthy: true, models: ['gpt'] },
    ];
    const out = inferAiRoutingFromProviders(providers, 'openai', true);
    expect(out.serviceLabel).toBe('openai');
    expect(out.modelLabel).toBe('gpt');
  });

  it('falls back to a server-side note when a provider lists no models', () => {
    const out = inferAiRoutingFromProviders([{ provider: 'gemini', healthy: true }], 'gemini');
    expect(out.modelLabel).toMatch(/server/i);
  });
});

describe('inferAiRoutingDevChoice', () => {
  it('reflects the chosen model draft over server hints', () => {
    const providers: ProviderHealth[] = [
      { provider: 'gemini', healthy: true, models: ['hint-model'] },
    ];
    const out = inferAiRoutingDevChoice({
      providers,
      defaultProvider: 'gemini',
      chosenProvider: 'gemini',
      chosenModelDraft: 'my-model',
      allowsClientChoice: true,
    });
    expect(out.serviceLabel).toBe('gemini');
    expect(out.modelLabel).toBe('my-model');
  });
});

// --- helpers: picks -------------------------------------------------------

describe('pick helpers', () => {
  it('pickLabel formats season/round with optional descriptor', () => {
    expect(pickLabel(pick({ season: 2026, round: 2 }))).toBe('2026 Round 2');
    expect(pickLabel(pick({ season: 2026, round: 1, descriptor: 'early' }))).toBe('2026 Round 1 (early)');
  });

  it('ownedPicksForRoster returns [] for null roster or unknown roster', () => {
    const map = new Map<number, TradeAnalyzerPick[]>([[1, [pick({})]]]);
    expect(ownedPicksForRoster(null, map)).toEqual([]);
    expect(ownedPicksForRoster(2, map)).toEqual([]);
    expect(ownedPicksForRoster(1, map)).toHaveLength(1);
  });

  it('picksAvailableToAdd excludes pickless, mis-owned, and already-selected picks', () => {
    const keep = pick({ pick_id: 'p:1', owner_roster_id: 1, season: 2026, round: 1 });
    const noId = pick({ pick_id: '', owner_roster_id: 1, season: 2026, round: 2 });
    const wrongOwner = pick({ pick_id: 'p:2', owner_roster_id: 2, season: 2026, round: 3 });
    const map = new Map<number, TradeAnalyzerPick[]>([[1, [keep, noId, wrongOwner]]]);
    const out = picksAvailableToAdd(1, map, new Set());
    expect(out).toEqual([keep]);
    // once selected, it drops out
    expect(picksAvailableToAdd(1, map, new Set(['1:1:2026:r1']))).toEqual([]);
  });
});

// --- helpers: season wire -------------------------------------------------

describe('tradeAnalyzerSeasonWire', () => {
  it('passes through a valid four-digit year', () => {
    expect(tradeAnalyzerSeasonWire(2026)).toBe('2026');
    expect(tradeAnalyzerSeasonWire(2026.9)).toBe('2026');
  });

  it('falls back to the current year for out-of-range values', () => {
    const current = String(new Date().getFullYear());
    expect(tradeAnalyzerSeasonWire(42)).toBe(current);
    expect(tradeAnalyzerSeasonWire(NaN)).toBe(current);
  });
});
