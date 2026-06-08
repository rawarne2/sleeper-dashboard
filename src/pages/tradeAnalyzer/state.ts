import type { ProviderHealth } from '../../types';

export type SideKey = 'a' | 'b';

export type SelectedPlayer = {
  kind: 'player';
  playerId: string;
};

export type SelectedPick = {
  kind: 'pick';
  pickKey: string;
};

export type SelectedAsset = SelectedPlayer | SelectedPick;

export type SideState = {
  rosterId: number | null;
  assets: SelectedAsset[];
  isTanking: boolean;
};

export type ResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' };

export type State = {
  sideA: SideState;
  sideB: SideState;
  context: string;
  activeSide: SideKey;
  results: ResultsState;
  providers: ProviderHealth[];
  rateLimitUntilMs: number | null;
  rateLimitMessage: string | null;
  analysisError: string | null;
};

export type Action =
  | { type: 'setRoster'; side: SideKey; rosterId: number | null }
  | { type: 'togglePlayer'; side: SideKey; playerId: string }
  | { type: 'togglePick'; side: SideKey; pickKey: string }
  | { type: 'clearSideAssets'; side: SideKey }
  | { type: 'setTanking'; side: SideKey; value: boolean }
  | { type: 'setContext'; value: string }
  | { type: 'setActiveSide'; side: SideKey }
  | { type: 'analyzeStart' }
  | { type: 'analyzeReady' }
  | { type: 'analyzeFailed' }
  | { type: 'setProviders'; providers: ProviderHealth[] }
  | { type: 'setRateLimitUntil'; untilMs: number | null; message: string | null }
  | { type: 'setAnalysisError'; message: string | null }
  | { type: 'resetAll' };

export const MAX_CONTEXT_CHARS = 1000;

export function createInitialState(): State {
  return {
    sideA: { rosterId: null, assets: [], isTanking: false },
    sideB: { rosterId: null, assets: [], isTanking: false },
    context: '',
    activeSide: 'a',
    results: { status: 'idle' },
    providers: [],
    rateLimitUntilMs: null,
    rateLimitMessage: null,
    analysisError: null,
  };
}

export function uniqAssets(assets: SelectedAsset[]): SelectedAsset[] {
  const seen = new Set<string>();
  const out: SelectedAsset[] = [];
  for (const a of assets) {
    const k =
      a.kind === 'player'
        ? `${a.kind}:${a.playerId}`
        : `${a.kind}:${a.pickKey}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setRoster': {
      const prevSide = action.side === 'a' ? state.sideA : state.sideB;
      const nextSide: SideState = {
        rosterId: action.rosterId,
        assets: [],
        // Preserve user's tanking choice across roster changes — they're describing the team's posture, not the trade.
        isTanking: prevSide.isTanking,
      };
      if (action.side === 'a') {
        const sideB =
          state.sideB.rosterId === action.rosterId
            ? { rosterId: null, assets: [], isTanking: state.sideB.isTanking }
            : state.sideB;
        return { ...state, sideA: nextSide, sideB };
      }
      const sideA =
        state.sideA.rosterId === action.rosterId
          ? { rosterId: null, assets: [], isTanking: state.sideA.isTanking }
          : state.sideA;
      return { ...state, sideB: nextSide, sideA };
    }
    case 'setTanking': {
      const nextSide: SideState =
        action.side === 'a'
          ? { ...state.sideA, isTanking: action.value }
          : { ...state.sideB, isTanking: action.value };
      return action.side === 'a'
        ? { ...state, sideA: nextSide }
        : { ...state, sideB: nextSide };
    }
    case 'togglePlayer': {
      const side = action.side === 'a' ? state.sideA : state.sideB;
      const rosterId = side.rosterId;
      if (!rosterId) return state;
      const exists = side.assets.some(
        (a) => a.kind === 'player' && a.playerId === action.playerId
      );
      const nextAssets = exists
        ? side.assets.filter(
            (a) => !(a.kind === 'player' && a.playerId === action.playerId)
          )
        : uniqAssets([...side.assets, { kind: 'player', playerId: action.playerId }]);
      const nextSide: SideState = { ...side, assets: nextAssets };
      return action.side === 'a'
        ? { ...state, sideA: nextSide }
        : { ...state, sideB: nextSide };
    }
    case 'togglePick': {
      const side = action.side === 'a' ? state.sideA : state.sideB;
      const rosterId = side.rosterId;
      if (!rosterId) return state;
      const exists = side.assets.some(
        (a) => a.kind === 'pick' && a.pickKey === action.pickKey
      );
      const nextAssets = exists
        ? side.assets.filter(
            (a) => !(a.kind === 'pick' && a.pickKey === action.pickKey)
          )
        : uniqAssets([...side.assets, { kind: 'pick', pickKey: action.pickKey }]);
      const nextSide: SideState = { ...side, assets: nextAssets };
      return action.side === 'a'
        ? { ...state, sideA: nextSide }
        : { ...state, sideB: nextSide };
    }
    case 'clearSideAssets': {
      const nextSide: SideState = { ...(action.side === 'a' ? state.sideA : state.sideB), assets: [] };
      return action.side === 'a'
        ? { ...state, sideA: nextSide }
        : { ...state, sideB: nextSide };
    }
    case 'setContext': {
      return { ...state, context: action.value.slice(0, MAX_CONTEXT_CHARS) };
    }
    case 'setActiveSide': {
      return { ...state, activeSide: action.side };
    }
    case 'analyzeStart': {
      return { ...state, results: { status: 'loading' } };
    }
    case 'analyzeReady': {
      return { ...state, results: { status: 'ready' } };
    }
    case 'analyzeFailed': {
      return { ...state, results: { status: 'idle' } };
    }
    case 'setProviders': {
      return { ...state, providers: action.providers };
    }
    case 'setRateLimitUntil': {
      return { ...state, rateLimitUntilMs: action.untilMs, rateLimitMessage: action.message };
    }
    case 'setAnalysisError': {
      return { ...state, analysisError: action.message };
    }
    case 'resetAll': {
      return {
        ...createInitialState(),
        // Provider list is fetched once and reused across resets.
        providers: state.providers,
      };
    }
    default:
      return state;
  }
}
