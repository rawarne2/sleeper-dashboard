import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BarChart3Icon,
  RefreshCwIcon,
  SettingsIcon,
} from 'lucide-react';
import { openDB } from 'idb';
import { useLeague } from '../useLeague';
import { resolveTradeAnalyzerSeason } from '../dashboardBundleCache';
import type {
  Player,
  ProviderHealth,
  TeamData,
  TradeAnalyzerPick,
  TradeAnalyzerRequest,
  TradeAnalyzerResponse,
} from '../types';
import {
  analyzeTrade,
  canonicalPickId,
  fetchTradeAnalyzerProviders,
  type TradeAnalyzerError,
} from '../services/tradeAnalyzer';

type SideKey = 'a' | 'b';

type SelectedPlayer = {
  kind: 'player';
  playerId: string;
};

type SelectedPick = {
  kind: 'pick';
  pickKey: string;
};

type SelectedAsset = SelectedPlayer | SelectedPick;

type SideState = {
  rosterId: number | null;
  assets: SelectedAsset[];
};

type ResultsState =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'ready'; analyzedAt: number; data: TradeAnalyzerResponse };

type State = {
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

type Action =
  | { type: 'setRoster'; side: SideKey; rosterId: number | null }
  | { type: 'togglePlayer'; side: SideKey; playerId: string }
  | { type: 'togglePick'; side: SideKey; pickKey: string }
  | { type: 'clearSideAssets'; side: SideKey }
  | { type: 'setContext'; value: string }
  | { type: 'setActiveSide'; side: SideKey }
  | { type: 'analyzeStart' }
  | { type: 'analyzeReady'; analyzedAt: number; data: TradeAnalyzerResponse }
  | { type: 'setProviders'; providers: ProviderHealth[] }
  | { type: 'setRateLimitUntil'; untilMs: number | null; message: string | null }
  | { type: 'setAnalysisError'; message: string | null }
  | { type: 'resetAll' };

const MAX_CONTEXT_CHARS = 1000;

function uniqAssets(assets: SelectedAsset[]): SelectedAsset[] {
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

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setRoster': {
      const nextSide: SideState = { rosterId: action.rosterId, assets: [] };
      if (action.side === 'a') {
        const sideB =
          state.sideB.rosterId === action.rosterId
            ? { rosterId: null, assets: [] }
            : state.sideB;
        return { ...state, sideA: nextSide, sideB };
      }
      const sideA =
        state.sideA.rosterId === action.rosterId
          ? { rosterId: null, assets: [] }
          : state.sideA;
      return { ...state, sideB: nextSide, sideA };
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
      return { ...state, results: { status: 'loading', startedAt: Date.now() } };
    }
    case 'analyzeReady': {
      return {
        ...state,
        results: { status: 'ready', analyzedAt: action.analyzedAt, data: action.data },
      };
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
        sideA: { rosterId: null, assets: [] },
        sideB: { rosterId: null, assets: [] },
        context: '',
        activeSide: 'a',
        results: { status: 'idle' },
        providers: state.providers,
        rateLimitUntilMs: null,
        rateLimitMessage: null,
        analysisError: null,
      };
    }
    default:
      return state;
  }
}

function teamDisplayName(team: TeamData): string {
  return team.user.metadata?.team_name || team.user.team_name || team.user.display_name;
}

function teamSubtitle(team: TeamData): string {
  return team.user.username || team.user.display_name;
}

function avatarUrl(avatar?: string) {
  return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : null;
}

type PlayerGroup = { label: string; players: Player[] };

function groupPlayersByPosition(players: Player[]): PlayerGroup[] {
  const order = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const byPos = new Map<string, Player[]>();
  for (const p of players) {
    const pos = (p.position || 'Other').trim() || 'Other';
    const arr = byPos.get(pos) ?? [];
    arr.push(p);
    byPos.set(pos, arr);
  }
  const sortName = (a: Player, b: Player) =>
    `${a.first_name ?? ''} ${a.last_name ?? ''}`.localeCompare(
      `${b.first_name ?? ''} ${b.last_name ?? ''}`
    );
  const groups: PlayerGroup[] = [];
  for (const pos of order) {
    const arr = byPos.get(pos);
    if (!arr || arr.length === 0) continue;
    groups.push({ label: pos, players: [...arr].sort(sortName) });
    byPos.delete(pos);
  }
  for (const [pos, arr] of byPos.entries()) {
    groups.push({ label: pos, players: [...arr].sort(sortName) });
  }
  return groups;
}

function sortPlayersByName(players: Player[]): Player[] {
  return [...players].sort((a, b) =>
    `${a.first_name ?? ''} ${a.last_name ?? ''}`.localeCompare(
      `${b.first_name ?? ''} ${b.last_name ?? ''}`
    )
  );
}

/**
 * Full border (width + style + color) per position so tags win over global `button { border: … }` in index.css.
 */
function tradePlayerChipBorder(position?: string): string {
  const pos = (position || '').trim().toUpperCase();
  switch (pos) {
    case 'QB':
      return 'border-2 border-solid border-red-500';
    case 'RB':
      return 'border-2 border-solid border-green-500';
    case 'WR':
      return 'border-2 border-solid border-blue-500';
    case 'TE':
      return 'border-2 border-solid border-amber-500';
    case 'K':
      return 'border-2 border-solid border-purple-500';
    case 'DEF':
      return 'border-2 border-solid border-cyan-500';
    default:
      return 'border-2 border-solid border-gray-500';
  }
}

const TRADE_PLAYER_CHIP =
  'box-border inline-flex items-center justify-center rounded-full bg-white/5 text-gray-100 text-xs sm:text-sm font-semibold leading-tight shadow-sm transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main';

const TRADE_PICK_CHIP =
  'box-border inline-flex min-w-[44px] items-center justify-center rounded-full border-2 border-solid border-amber-400 bg-white/5 text-gray-100 text-xs sm:text-sm font-semibold leading-tight shadow-sm transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main';

function inferAiRoutingFromProviders(
  providers: ProviderHealth[],
  defaultProvider?: string
): {
  serviceLabel: string;
  modelLabel: string;
} {
  if (providers.length === 0) {
    return {
      serviceLabel: 'Unknown',
      modelLabel: 'Could not load AI details. Is the backend running?',
    };
  }
  const def = defaultProvider?.trim().toLowerCase();
  const primary = def
    ? providers.find((p) => p.provider.toLowerCase() === def) ??
      providers.find((p) => p.healthy) ??
      providers[0]
    : providers.find((p) => p.healthy) ?? providers[0];
  const serviceLabel = primary.provider || 'Unknown';
  const models =
    primary.models?.filter((m) => typeof m === 'string' && m.trim().length > 0) ?? [];
  const modelLabel =
    models.length > 0
      ? models.join(', ')
      : 'Set on the server (this API did not list model names)';
  return { serviceLabel, modelLabel };
}

/** When the API allows client overrides, reflect the dev picker in the header summary. */
function inferAiRoutingDevChoice(args: {
  providers: ProviderHealth[];
  defaultProvider: string;
  chosenProvider: string;
  chosenModelDraft: string;
}): { serviceLabel: string; modelLabel: string } {
  const { providers, defaultProvider, chosenProvider, chosenModelDraft } = args;
  if (providers.length === 0) {
    return {
      serviceLabel: 'Unknown',
      modelLabel: 'Could not load AI details. Is the backend running?',
    };
  }
  const key = (chosenProvider.trim().toLowerCase() || defaultProvider.toLowerCase());
  const row =
    providers.find((p) => p.provider.toLowerCase() === key) ??
    providers.find((p) => p.healthy) ??
    providers[0];
  const serverHint =
    row.models?.filter((m) => typeof m === 'string' && m.trim())[0] ?? '';
  const modelLabel =
    chosenModelDraft.trim() || serverHint || 'Server default from environment';
  return { serviceLabel: row.provider || key, modelLabel };
}

function ktcValueForPlayer(p: Player): number {
  const v = p.ktc?.superflexValues?.tep?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function pickKey(p: TradeAnalyzerPick): string {
  return (
    p.pick_id ??
    `${p.owner_roster_id}_${p.season}_${p.round}_${String(p.descriptor ?? '')}`
  );
}

function pickLabel(p: TradeAnalyzerPick): string {
  const d = (p.descriptor || '').trim();
  return `${p.season} Round ${p.round}${d ? ` (${d})` : ''}`;
}

function mockAnalyzeResponse(args: {
  sideAAssets: Array<{ label: string; value: number }>;
  sideBAssets: Array<{ label: string; value: number }>;
}): TradeAnalyzerResponse {
  const aOut = args.sideAAssets.reduce((s, a) => s + a.value, 0);
  const bOut = args.sideBAssets.reduce((s, a) => s + a.value, 0);
  const diff = bOut - aOut;
  const fairness = Math.max(0, Math.min(100, Math.round(50 + diff / 200)));
  const winner: 'a' | 'b' | 'even' =
    Math.abs(diff) < 150 ? 'even' : diff > 0 ? 'b' : 'a';

  return {
    fairness_score: fairness,
    winner,
    summary_bullets: [
      'This analysis weighs KTC value, roster construction, and short-term points.',
      'Consider your contention window and positional depth before finalizing.',
    ],
    side_a: {
      pros: ['Improves lineup flexibility.', 'Converts value into a clearer weekly starter.'],
      cons: ['Risk of reducing depth at one position.', 'Market value can swing fast after injury news.'],
      ktc_delta: {
        values_in: bOut,
        values_out: aOut,
        net: bOut - aOut,
        per_asset: args.sideAAssets,
      },
      sleeper_data: {
        stats_trajectory: [
          { x: 'Wk1', y: 18.2 },
          { x: 'Wk2', y: 19.0 },
          { x: 'Wk3', y: 17.5 },
          { x: 'Wk4', y: 20.1 },
        ],
        positional_impact: 'QB depth improves slightly; WR depth decreases.',
        needs_addressed: ['Adds one reliable starter.', 'Shifts risk toward fewer high-leverage players.'],
      },
    },
    side_b: {
      pros: ['Adds depth and optionality.', 'Smoother risk distribution across positions.'],
      cons: ['May lower weekly ceiling if consolidating talent.', 'Requires active lineup management to realize value.'],
      ktc_delta: {
        values_in: aOut,
        values_out: bOut,
        net: aOut - bOut,
        per_asset: args.sideBAssets,
      },
      sleeper_data: {
        stats_trajectory: [
          { x: 'Wk1', y: 16.9 },
          { x: 'Wk2', y: 18.1 },
          { x: 'Wk3', y: 18.0 },
          { x: 'Wk4', y: 17.4 },
        ],
        positional_impact: 'RB depth improves; TE remains stable.',
        needs_addressed: ['Adds multiple playable pieces.', 'Creates more trade flexibility later.'],
      },
    },
  };
}

export const TradeAnalyzerPage: React.FC = () => {
  const {
    leagueIdReady,
    loading,
    teamsData,
    players,
    league,
    tradePicksByRoster,
    selectedLeagueId,
  } = useLeague();
  const tradeAnalysisSeason = useMemo(
    () => resolveTradeAnalyzerSeason(league, selectedLeagueId),
    [league, selectedLeagueId]
  );
  const picksByRosterId = useMemo(() => {
    const m = new Map<number, TradeAnalyzerPick[]>();
    for (const [rid, arr] of tradePicksByRoster.entries()) {
      m.set(
        rid,
        [...arr].sort((a, b) => (a.season - b.season) || (a.round - b.round))
      );
    }
    return m;
  }, [tradePicksByRoster]);
  const isReady = leagueIdReady && !loading;

  const [settingsOpen, setSettingsOpen] = useState(false);
  /** From GET /providers: dev builds may allow provider + model selection. */
  const [taBundle, setTaBundle] = useState<Awaited<
    ReturnType<typeof fetchTradeAnalyzerProviders>
  > | null>(null);
  const [devProvider, setDevProvider] = useState('');
  const [devModelDraft, setDevModelDraft] = useState('');
  const [taPrefsHydratedInternal, setTaPrefsHydratedInternal] = useState(false);
  const taPrefsHydrated = taBundle?.allowsClientProviderModelChoice
    ? taPrefsHydratedInternal
    : false;

  const [state, dispatch] = useReducer(reducer, {
    sideA: { rosterId: null, assets: [] },
    sideB: { rosterId: null, assets: [] },
    context: '',
    activeSide: 'a',
    results: { status: 'idle' },
    providers: [],
    rateLimitUntilMs: null,
    rateLimitMessage: null,
    analysisError: null,
  });

  const builderRef = useRef<HTMLDivElement | null>(null);

  const aiRouting = useMemo(() => {
    if (taBundle?.allowsClientProviderModelChoice) {
      return inferAiRoutingDevChoice({
        providers: state.providers,
        defaultProvider: taBundle.defaultProvider,
        chosenProvider: devProvider,
        chosenModelDraft: devModelDraft,
      });
    }
    return inferAiRoutingFromProviders(state.providers, taBundle?.defaultProvider);
  }, [state.providers, taBundle, devProvider, devModelDraft]);

  const selectedProviderDefaultModel = useMemo(() => {
    const key =
      devProvider.trim().toLowerCase() ||
      (taBundle?.defaultProvider ?? '').trim().toLowerCase() ||
      '';
    const row =
      state.providers.find((p) => p.provider.toLowerCase() === key) ?? state.providers[0];
    const m = row?.models?.find((x) => typeof x === 'string' && x.trim());
    return m?.trim() ?? '';
  }, [devProvider, taBundle?.defaultProvider, state.providers]);

  const [rateLimitNowMs, setRateLimitNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!state.rateLimitUntilMs) return;
    const tick = window.setInterval(() => setRateLimitNowMs(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [state.rateLimitUntilMs]);

  const rateLimitRemainingMs =
    state.rateLimitUntilMs != null ? Math.max(0, state.rateLimitUntilMs - rateLimitNowMs) : 0;
  const isRateLimited = state.rateLimitUntilMs != null && rateLimitRemainingMs > 0;
  const rateLimitText = useMemo(() => {
    if (!isRateLimited) return null;
    const totalSec = Math.ceil(rateLimitRemainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `You have hit the analysis limit. Try again in ${m}m ${s}s.`;
  }, [isRateLimited, rateLimitRemainingMs]);

  useEffect(() => {
    if (!isRateLimited && state.rateLimitUntilMs != null) {
      dispatch({ type: 'setRateLimitUntil', untilMs: null, message: null });
    }
  }, [isRateLimited, state.rateLimitUntilMs]);

  useEffect(() => {
    if (!leagueIdReady) return;
    let cancelled = false;
    (async () => {
      try {
        const db = await openDB('sleeper-players-db', 3);
        const last = (await db.get('app_prefs', 'trade_analyzer_last_result')) as
          | { createdAt: number; request: TradeAnalyzerRequest; response: TradeAnalyzerResponse }
          | undefined;
        if (!cancelled && last?.response) {
          dispatch({ type: 'analyzeReady', analyzedAt: last.createdAt, data: last.response });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueIdReady]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      try {
        const bundle = await fetchTradeAnalyzerProviders();
        if (cancelled) return;
        dispatch({ type: 'setProviders', providers: bundle.providers });
        setTaBundle(bundle);
      } catch {
        if (!cancelled) {
          dispatch({ type: 'setProviders', providers: [] });
          setTaBundle(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  useEffect(() => {
    if (!taBundle?.allowsClientProviderModelChoice) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const db = await openDB('sleeper-players-db', 3);
        const row = (await db.get(
          'app_prefs',
          'trade_analyzer_prefs'
        )) as { key: string; provider?: string | null; model?: string | null } | undefined;
        if (cancelled) return;
        const p =
          typeof row?.provider === 'string' && row.provider.trim()
            ? row.provider.trim().toLowerCase()
            : taBundle.defaultProvider;
        setDevProvider(p);
        setDevModelDraft(typeof row?.model === 'string' ? row.model : '');
        setTaPrefsHydratedInternal(true);
      } catch {
        if (!cancelled) {
          setDevProvider(taBundle.defaultProvider);
          setDevModelDraft('');
          setTaPrefsHydratedInternal(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taBundle?.allowsClientProviderModelChoice, taBundle?.defaultProvider]);

  useEffect(() => {
    if (!taPrefsHydrated || !taBundle?.allowsClientProviderModelChoice) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const db = await openDB('sleeper-players-db', 3);
          await db.put('app_prefs', {
            key: 'trade_analyzer_prefs',
            provider: devProvider.trim().toLowerCase() || taBundle.defaultProvider,
            model: devModelDraft.trim() || null,
          });
        } catch {
          // ignore
        }
      })();
    }, 450);
    return () => window.clearTimeout(t);
  }, [devProvider, devModelDraft, taPrefsHydrated, taBundle?.allowsClientProviderModelChoice, taBundle?.defaultProvider]);

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      dispatch({ type: 'clearSideAssets', side: state.activeSide });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.activeSide]);

  const teamsByRosterId = useMemo(() => {
    const m = new Map<number, TeamData>();
    for (const t of teamsData) m.set(t.roster.roster_id, t);
    return m;
  }, [teamsData]);

  const sideATeam = state.sideA.rosterId ? teamsByRosterId.get(state.sideA.rosterId) ?? null : null;
  const sideBTeam = state.sideB.rosterId ? teamsByRosterId.get(state.sideB.rosterId) ?? null : null;

  const sideASelectedPlayerIds = useMemo(
    () =>
      new Set(
        state.sideA.assets
          .filter((a): a is SelectedPlayer => a.kind === 'player')
          .map((a) => a.playerId)
      ),
    [state.sideA.assets]
  );
  const sideBSelectedPlayerIds = useMemo(
    () =>
      new Set(
        state.sideB.assets
          .filter((a): a is SelectedPlayer => a.kind === 'player')
          .map((a) => a.playerId)
      ),
    [state.sideB.assets]
  );

  const sideASelectedPickKeys = useMemo(
    () =>
      new Set(
        state.sideA.assets
          .filter((a): a is SelectedPick => a.kind === 'pick')
          .map((a) => a.pickKey)
      ),
    [state.sideA.assets]
  );
  const sideBSelectedPickKeys = useMemo(
    () =>
      new Set(
        state.sideB.assets
          .filter((a): a is SelectedPick => a.kind === 'pick')
          .map((a) => a.pickKey)
      ),
    [state.sideB.assets]
  );

  const sideASelectedPicks = useMemo(() => {
    if (!state.sideA.rosterId) return [];
    const all = picksByRosterId.get(state.sideA.rosterId) ?? [];
    return all.filter((p) => sideASelectedPickKeys.has(pickKey(p)));
  }, [picksByRosterId, sideASelectedPickKeys, state.sideA.rosterId]);

  const sideBSelectedPicks = useMemo(() => {
    if (!state.sideB.rosterId) return [];
    const all = picksByRosterId.get(state.sideB.rosterId) ?? [];
    return all.filter((p) => sideBSelectedPickKeys.has(pickKey(p)));
  }, [picksByRosterId, sideBSelectedPickKeys, state.sideB.rosterId]);

  const sideASelectedPlayers = useMemo(() => {
    const out: Player[] = [];
    for (const id of sideASelectedPlayerIds) {
      const p = players[id];
      if (p) out.push(p);
    }
    return out;
  }, [players, sideASelectedPlayerIds]);
  const sideBSelectedPlayers = useMemo(() => {
    const out: Player[] = [];
    for (const id of sideBSelectedPlayerIds) {
      const p = players[id];
      if (p) out.push(p);
    }
    return out;
  }, [players, sideBSelectedPlayerIds]);

  const sideASubtotal = useMemo(
    () =>
      sideASelectedPlayers.reduce((s, p) => s + ktcValueForPlayer(p), 0) +
      sideASelectedPicks.reduce((s, p) => s + (p.ktc_value ?? 0), 0),
    [sideASelectedPlayers, sideASelectedPicks]
  );
  const sideBSubtotal = useMemo(
    () =>
      sideBSelectedPlayers.reduce((s, p) => s + ktcValueForPlayer(p), 0) +
      sideBSelectedPicks.reduce((s, p) => s + (p.ktc_value ?? 0), 0),
    [sideBSelectedPlayers, sideBSelectedPicks]
  );

  const canAnalyze =
    isReady &&
    state.sideA.rosterId != null &&
    state.sideB.rosterId != null &&
    (state.sideA.assets.length > 0 || state.sideB.assets.length > 0) &&
    state.sideA.assets.length > 0 &&
    state.sideB.assets.length > 0 &&
    state.results.status !== 'loading' &&
    !isRateLimited;

  const fairness = state.results.status === 'ready' ? state.results.data.fairness_score : 50;
  const winnerLabel =
    state.results.status === 'ready'
      ? state.results.data.winner === 'even'
        ? 'Even trade'
        : state.results.data.winner === 'a'
          ? 'Side A wins'
          : 'Side B wins'
      : null;

  const sideAAssetLabels = useMemo(() => {
    return sideASelectedPlayers.map((p) => {
      const name =
        `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() ||
        p.playerName ||
        'Player';
      const ktc = ktcValueForPlayer(p);
      return { key: p.player_id ?? name, label: name, position: p.position, ktc };
    });
  }, [sideASelectedPlayers]);

  const sideBAssetLabels = useMemo(() => {
    return sideBSelectedPlayers.map((p) => {
      const name =
        `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() ||
        p.playerName ||
        'Player';
      const ktc = ktcValueForPlayer(p);
      return { key: p.player_id ?? name, label: name, position: p.position, ktc };
    });
  }, [sideBSelectedPlayers]);

  const [summaryExpanded, setSummaryExpanded] = useState(false);

  return (
    <div className='mx-auto w-full max-w-xl px-3 py-4 sm:max-w-2xl sm:px-5 sm:py-5 md:max-w-4xl md:px-6 lg:max-w-5xl'>
      <div ref={builderRef} className='rounded-xl border border-white/10 bg-[#0d1e2e] p-4 sm:p-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <BarChart3Icon className='h-5 w-5 text-primary-main' />
              <div className='text-base sm:text-lg font-semibold text-gray-100'>
                Trade Analyzer
              </div>
            </div>
            <p className='mt-2 text-xs sm:text-sm text-gray-300'>
              <span className='font-semibold text-gray-200'>AI service: </span>
              <span>{aiRouting.serviceLabel}</span>
              <span className='mx-2 text-gray-500' aria-hidden>
                ·
              </span>
              <span className='font-semibold text-gray-200'>Model: </span>
              <span>{aiRouting.modelLabel}</span>
            </p>
          </div>

          <div className='flex items-center justify-between gap-2 sm:justify-end'>
            <button
              type='button'
              className='inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-200 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              aria-label='Show AI routing details and health checks'
            >
              <SettingsIcon className='h-4 w-4' />
              AI details
            </button>
          </div>
        </div>

        {settingsOpen ? (
          <div className='mt-3 rounded-lg border border-white/10 bg-black/10 p-3 text-xs sm:text-sm text-gray-300'>
            <p className='text-xs sm:text-sm text-gray-400'>
              {taBundle == null ? (
                <>Loading…</>
              ) : taBundle.allowsClientProviderModelChoice ? (
                <>
                  Dev: optional <span className='font-semibold text-gray-200'>provider / model</span>{' '}
                  override.
                </>
              ) : (
                <>
                  API uses <span className='font-semibold text-gray-200'>Anthropic</span> only; model
                  comes from server config.
                </>
              )}
            </p>
            {taBundle?.allowsClientProviderModelChoice ? (
              <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <label className='block text-xs sm:text-sm'>
                  <span className='font-semibold text-gray-200'>Provider</span>
                  <select
                    className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-2 py-2 text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
                    value={devProvider.trim().toLowerCase() || taBundle.defaultProvider}
                    onChange={(ev) =>
                      setDevProvider(ev.target.value.trim().toLowerCase())
                    }
                  >
                    {state.providers.map((p) => (
                      <option key={p.provider} value={p.provider.toLowerCase()}>
                        {p.provider}
                        {p.healthy ? '' : ' (unavailable)'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className='block text-xs sm:text-sm'>
                  <span className='font-semibold text-gray-200'>Model override</span>
                  <input
                    type='text'
                    className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-2 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
                    placeholder={
                      selectedProviderDefaultModel ||
                      'Leave blank for server default'
                    }
                    value={devModelDraft}
                    onChange={(ev) => setDevModelDraft(ev.target.value)}
                    autoComplete='off'
                    spellCheck={false}
                  />
                </label>
                <p className='sm:col-span-2 text-xs text-gray-400'>
                  Saved in this browser until you clear site data.
                </p>
              </div>
            ) : null}
            <div className='mt-3 rounded-md border border-white/10 bg-[#0b1624]/80 p-3'>
              <div className='text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400'>
                Active routing (from GET /trade-analyzer/providers)
              </div>
              <div className='mt-2 space-y-1 text-sm text-gray-100'>
                <div>
                  <span className='text-gray-400'>Service </span>
                  <span className='font-semibold'>{aiRouting.serviceLabel}</span>
                </div>
                <div>
                  <span className='text-gray-400'>Model </span>
                  <span className='font-semibold'>{aiRouting.modelLabel}</span>
                </div>
              </div>
            </div>

            <div className='mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2'>
              {state.providers.length === 0 ? (
                <div className='text-[10px] sm:text-xs text-gray-400'>
                  No provider rows returned. The backend may be offline or the endpoint may have changed.
                </div>
              ) : (
                state.providers.map((p) => (
                  <div
                    key={p.provider}
                    className='rounded-md border border-white/10 bg-white/5 p-2 text-[10px] sm:text-xs text-gray-300'
                  >
                    <span className='font-semibold text-gray-200'>{p.provider}</span>{' '}
                    <span className={p.healthy ? 'text-green-300' : 'text-red-300'}>
                      {p.healthy ? 'healthy' : 'unhealthy'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {!isReady ? (
          <div className='mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs sm:text-sm text-gray-300'>
            Loading league…
          </div>
        ) : null}

        <div className='mt-3 grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SideCard
            title='Side A'
            side='a'
            disabled={!isReady}
            teams={teamsData}
            selectedRosterId={state.sideA.rosterId}
            otherRosterId={state.sideB.rosterId}
            selectedPlayerIds={sideASelectedPlayerIds}
            selectedPlayers={sideASelectedPlayers}
            selectedPicks={sideASelectedPicks}
            subtotal={sideASubtotal}
            picks={state.sideA.rosterId ? (picksByRosterId.get(state.sideA.rosterId) ?? []) : []}
            selectedPickKeys={sideASelectedPickKeys}
            onActive={() => dispatch({ type: 'setActiveSide', side: 'a' })}
            onRosterChange={(rid) => dispatch({ type: 'setRoster', side: 'a', rosterId: rid })}
            onTogglePlayer={(pid) => dispatch({ type: 'togglePlayer', side: 'a', playerId: pid })}
            onTogglePick={(key) => dispatch({ type: 'togglePick', side: 'a', pickKey: key })}
            onClear={() => dispatch({ type: 'clearSideAssets', side: 'a' })}
          />
          <SideCard
            title='Side B'
            side='b'
            disabled={!isReady}
            teams={teamsData}
            selectedRosterId={state.sideB.rosterId}
            otherRosterId={state.sideA.rosterId}
            selectedPlayerIds={sideBSelectedPlayerIds}
            selectedPlayers={sideBSelectedPlayers}
            selectedPicks={sideBSelectedPicks}
            subtotal={sideBSubtotal}
            picks={state.sideB.rosterId ? (picksByRosterId.get(state.sideB.rosterId) ?? []) : []}
            selectedPickKeys={sideBSelectedPickKeys}
            onActive={() => dispatch({ type: 'setActiveSide', side: 'b' })}
            onRosterChange={(rid) => dispatch({ type: 'setRoster', side: 'b', rosterId: rid })}
            onTogglePlayer={(pid) => dispatch({ type: 'togglePlayer', side: 'b', playerId: pid })}
            onTogglePick={(key) => dispatch({ type: 'togglePick', side: 'b', pickKey: key })}
            onClear={() => dispatch({ type: 'clearSideAssets', side: 'b' })}
          />
        </div>

        <div className='mt-3 rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'>
          <div className='flex items-center justify-between gap-3'>
            <label className='text-xs sm:text-sm font-semibold text-gray-200' htmlFor='trade-analyzer-context'>
              Additional context
            </label>
            <div className='text-[10px] sm:text-xs tabular-nums text-gray-400'>
              {state.context.length}/{MAX_CONTEXT_CHARS}
            </div>
          </div>
          <textarea
            id='trade-analyzer-context'
            value={state.context}
            disabled={!isReady}
            onChange={(ev) => dispatch({ type: 'setContext', value: ev.target.value })}
            placeholder='Optional: injuries, timeline, league context…'
            className='mt-2 w-full min-h-[110px] resize-y rounded-lg border border-white/10 bg-[#0b1624] px-3 py-2.5 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
          />
        </div>

        <div className='mt-3 flex flex-col gap-2'>
          <button
            type='button'
            disabled={!canAnalyze}
            className='inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-main px-4 py-3 text-sm sm:text-base font-semibold text-white shadow-lg ring-1 ring-white/10 transition-[filter,opacity] hover:brightness-110 disabled:pointer-events-none disabled:opacity-45'
            onClick={() => {
              dispatch({ type: 'setAnalysisError', message: null });
              dispatch({ type: 'setRateLimitUntil', untilMs: null, message: null });
              dispatch({ type: 'analyzeStart' });

              const seasonNum = tradeAnalysisSeason;
              const seasonFallback = String(new Date().getFullYear());
              const seasonWire =
                Number.isFinite(seasonNum) &&
                seasonNum >= 1900 &&
                seasonNum <= 3000 &&
                `${Math.trunc(seasonNum)}`.length === 4
                  ? `${Math.trunc(seasonNum)}`
                  : seasonFallback;

              const playerIdsFrom = (list: Player[]) =>
                list
                  .map((p) => p.player_id)
                  .filter((id): id is string => typeof id === 'string' && !!id);

              const req: TradeAnalyzerRequest = {
                league_id: selectedLeagueId,
                season: /^\d{4}$/.test(seasonWire) ? seasonWire : seasonFallback,
                side_a: {
                  roster_id: state.sideA.rosterId ?? 0,
                  player_ids: playerIdsFrom(sideASelectedPlayers),
                  pick_ids: sideASelectedPicks.map((p) => canonicalPickId(p)),
                },
                side_b: {
                  roster_id: state.sideB.rosterId ?? 0,
                  player_ids: playerIdsFrom(sideBSelectedPlayers),
                  pick_ids: sideBSelectedPicks.map((p) => canonicalPickId(p)),
                },
                additional_context: state.context.trim() || undefined,
              };

              if (taBundle?.allowsClientProviderModelChoice) {
                const p =
                  devProvider.trim().toLowerCase() || taBundle.defaultProvider;
                if (p) req.provider = p;
                const m = devModelDraft.trim();
                if (m) req.model = m;
              }

              const analyzedAt = Date.now();
              void (async () => {
                try {
                  const res = await analyzeTrade(req);
                  dispatch({ type: 'analyzeReady', analyzedAt, data: res });
                  try {
                    const db = await openDB('sleeper-players-db', 3);
                    await db.put('app_prefs', {
                      key: 'trade_analyzer_last_result',
                      createdAt: analyzedAt,
                      request: req,
                      response: res,
                    });
                  } catch {
                    // ignore
                  }
                  const el = document.getElementById('trade-analyzer-results');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (e) {
                  const err = e as TradeAnalyzerError;
                  if (err?.kind === 'rate_limit') {
                    dispatch({
                      type: 'setRateLimitUntil',
                      untilMs: Date.now() + err.retryAfterSeconds * 1000,
                      message: err.message,
                    });
                  } else {
                    dispatch({
                      type: 'setAnalysisError',
                      message:
                        err && typeof err === 'object' && 'message' in err
                          ? String((err as { message?: unknown }).message ?? 'Analyze failed')
                          : 'Analyze failed',
                    });
                  }
                  dispatch({ type: 'analyzeReady', analyzedAt, data: mockAnalyzeResponse({
                    sideAAssets: sideASelectedPlayers.map((p) => ({
                      label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.playerName ?? 'Player'),
                      value: ktcValueForPlayer(p),
                    })),
                    sideBAssets: sideBSelectedPlayers.map((p) => ({
                      label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.playerName ?? 'Player'),
                      value: ktcValueForPlayer(p),
                    })),
                  }) });
                }
              })();
            }}
          >
            {state.results.status === 'loading' ? (
              <>
                <span className='inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white' />
                Analyzing…
              </>
            ) : (
              <>
                <RefreshCwIcon className='h-4 w-4' />
                Analyze Trade
              </>
            )}
          </button>
          {rateLimitText ? (
            <div className='text-xs sm:text-sm text-red-300'>{rateLimitText}</div>
          ) : state.rateLimitMessage ? (
            <div className='text-xs sm:text-sm text-red-300'>{state.rateLimitMessage}</div>
          ) : state.analysisError ? (
            <div className='text-xs sm:text-sm text-red-300'>{state.analysisError}</div>
          ) : null}
        </div>
      </div>

      {state.results.status === 'ready' ? (
        <div
          id='trade-analyzer-results'
          className='mt-4 rounded-xl border border-white/10 bg-[#0d1e2e] p-4 sm:p-5'
        >
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <div className='text-base sm:text-lg font-semibold text-gray-100'>Analysis Results</div>
              <div className='mt-1 text-xs sm:text-sm text-gray-400'>
                Analyzed at {new Date(state.results.analyzedAt).toLocaleString()}
              </div>
            </div>
            <button
              type='button'
              className='inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-200 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
              onClick={() => {
                dispatch({ type: 'resetAll' });
                void (async () => {
                  try {
                    const db = await openDB('sleeper-players-db', 3);
                    await db.delete('app_prefs', 'trade_analyzer_last_result');
                  } catch {
                    // ignore
                  }
                })();
                builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Run another
            </button>
          </div>

        <div className='mt-3 rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <div className='text-xs sm:text-sm font-semibold text-gray-200'>Fairness score</div>
              </div>
              {winnerLabel ? (
                <div className='inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-100'>
                  {winnerLabel}
                </div>
              ) : null}
            </div>

            <div className='mt-3'>
              <FairnessGauge value={fairness} />
            </div>

            <div className='mt-3 grid grid-cols-1 gap-3 md:grid-cols-2'>
              <TradeAssetStrip
                title='Side A assets'
                emptyLabel='No assets selected'
                assets={sideAAssetLabels}
              />
              <TradeAssetStrip
                title='Side B assets'
                emptyLabel='No assets selected'
                assets={sideBAssetLabels}
              />
            </div>
          </div>

          <div className='mt-3 rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'>
            <div className='flex items-start justify-between gap-2'>
              <div className='text-xs sm:text-sm font-semibold text-gray-200'>Summary</div>
              <button
                type='button'
                className='btn-ghost text-[10px] sm:text-xs font-semibold text-gray-300 hover:text-white'
                onClick={() => setSummaryExpanded((v) => !v)}
                aria-expanded={summaryExpanded}
              >
                {summaryExpanded ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className='mt-2 text-xs sm:text-sm text-gray-300'>
              {summaryExpanded ? (
                <ul className='list-disc pl-5 space-y-1'>
                  {state.results.data.summary_bullets.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div className='line-clamp-2 text-gray-300'>
                  {state.results.data.summary_bullets.slice(0, 1)[0] ?? ''}
                </div>
              )}
            </div>
          </div>

          <div className='mt-3 grid grid-cols-1 gap-4 md:grid-cols-2'>
            <ResultsColumn
              title='Side A'
              team={sideATeam}
              data={state.results.data.side_a}
            />
            <ResultsColumn
              title='Side B'
              team={sideBTeam}
              data={state.results.data.side_b}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

function SideCard(props: {
  title: string;
  side: SideKey;
  disabled: boolean;
  teams: TeamData[];
  selectedRosterId: number | null;
  otherRosterId: number | null;
  selectedPlayerIds: Set<string>;
  selectedPlayers: Player[];
  picks: TradeAnalyzerPick[];
  selectedPickKeys: Set<string>;
  selectedPicks: TradeAnalyzerPick[];
  subtotal: number;
  onActive: () => void;
  onRosterChange: (rosterId: number | null) => void;
  onTogglePlayer: (playerId: string) => void;
  onTogglePick: (pickKey: string) => void;
  onClear: () => void;
}) {
  const selectedTeam =
    props.selectedRosterId != null
      ? props.teams.find((t) => t.roster.roster_id === props.selectedRosterId) ?? null
      : null;

  const groupedPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return groupPlayersByPosition(sortPlayersByName(selectedTeam.players));
  }, [selectedTeam]);

  return (
    <div
      className='rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'
      onMouseDown={props.onActive}
      onFocusCapture={props.onActive}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='text-sm sm:text-base font-semibold text-gray-100'>{props.title}</div>
        <button
          type='button'
          className='btn-ghost text-xs sm:text-sm text-gray-400 hover:text-white'
          onClick={props.onClear}
          disabled={
            props.disabled ||
            props.selectedRosterId == null ||
            (props.selectedPlayers.length === 0 && props.selectedPicks.length === 0)
          }
        >
          Clear
        </button>
      </div>

      <div className='mt-3'>
        <label className='block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400'>
          Team
        </label>
        <select
          disabled={props.disabled}
          className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-3 py-2.5 text-xs sm:text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
          value={props.selectedRosterId ?? ''}
          onChange={(ev) => {
            const v = ev.target.value;
            props.onRosterChange(v ? Number(v) : null);
          }}
        >
          <option value=''>Select a team</option>
          {props.teams.map((t) => {
            const rid = t.roster.roster_id;
            const disabledOpt = props.otherRosterId != null && props.otherRosterId === rid;
            return (
              <option key={rid} value={rid} disabled={disabledOpt}>
                {teamDisplayName(t)} ({teamSubtitle(t)})
              </option>
            );
          })}
        </select>
      </div>

      {selectedTeam ? (
        <>
          <div className='mt-3 rounded-lg border border-white/10 bg-white/5 p-2'>
            <div className='flex items-center gap-2'>
              <div className='h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/5'>
                {selectedTeam.user.avatar ? (
                  <img
                    alt={selectedTeam.user.display_name}
                    src={avatarUrl(selectedTeam.user.avatar) ?? undefined}
                    className='h-full w-full object-cover'
                  />
                ) : (
                  <div className='flex h-full w-full items-center justify-center text-[10px] text-gray-400'>
                    N/A
                  </div>
                )}
              </div>
              <div className='min-w-0'>
                <div className='truncate text-xs sm:text-sm font-semibold text-gray-100'>
                  {teamDisplayName(selectedTeam)}
                </div>
                <div className='truncate text-[10px] sm:text-xs text-gray-400'>
                  {teamSubtitle(selectedTeam)}
                </div>
              </div>
            </div>
          </div>

          <div className='mt-3'>
            <div className='flex items-center justify-between gap-2'>
              <div className='text-xs sm:text-sm font-semibold text-gray-200'>Trading away</div>
              <div className='text-[10px] sm:text-xs text-gray-400'>
                Subtotal {props.subtotal.toLocaleString()}
              </div>
            </div>
            {props.selectedPlayers.length === 0 && props.selectedPicks.length === 0 ? (
              <div className='mt-2 text-xs sm:text-sm text-gray-400'>No assets yet.</div>
            ) : (
              <div className='mt-2 flex flex-wrap gap-2'>
                {props.selectedPlayers.map((p) => {
                  const name =
                    `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.playerName || 'Player';
                  return (
                    <button
                      key={p.player_id}
                      type='button'
                      className={`${TRADE_PLAYER_CHIP} ${tradePlayerChipBorder(p.position)} inline-flex min-h-10 min-w-[44px] px-2.5 py-1.5 sm:min-h-9 sm:px-2 sm:py-1`}
                      onClick={() => p.player_id && props.onTogglePlayer(p.player_id)}
                      aria-label={`Remove ${name} from ${props.title}`}
                    >
                      {name}
                    </button>
                  );
                })}
                {props.selectedPicks.map((p) => {
                  const key = pickKey(p);
                  const label = pickLabel(p);
                  const ktc = p.ktc_value ?? 0;
                  return (
                    <button
                      key={key}
                      type='button'
                      className={`${TRADE_PICK_CHIP} min-h-10 px-2.5 py-1.5 sm:min-h-9 sm:px-2 sm:py-1`}
                      onClick={() => props.onTogglePick(key)}
                      aria-label={`Remove ${label} from ${props.title}`}
                      title={ktc ? `KTC ${ktc}` : undefined}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className='mt-4 rounded-lg border border-white/10 bg-white/5 p-3'>
            <div className='text-xs sm:text-sm font-semibold text-gray-200'>
              Add players
            </div>
            <div className='mt-2'>
              <select
                id={`trade-side-${props.side}-player-select`}
                aria-label={`Add player to ${props.title}`}
                disabled={props.disabled}
                className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-3 py-2.5 text-xs sm:text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
                value=''
                onChange={(ev) => {
                  const id = ev.target.value;
                  if (!id) return;
                  if (!props.selectedPlayerIds.has(id)) {
                    props.onTogglePlayer(id);
                  }
                  ev.currentTarget.value = '';
                }}
              >
                <option value=''>Select a player to add</option>
                {groupedPlayers.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.players.map((p) => {
                      const id = p.player_id;
                      if (!id) return null;
                      const name =
                        `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() ||
                        p.playerName ||
                        'Player';
                      const ktc = ktcValueForPlayer(p);
                      const already = props.selectedPlayerIds.has(id);
                      const label = ktc > 0 ? `${name} (${ktc})` : name;
                      return (
                        <option key={id} value={id} disabled={already}>
                          {label}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className='mt-3 rounded-lg border border-white/10 bg-white/5 p-3'>
            <div className='text-xs sm:text-sm font-semibold text-gray-200'>Add picks</div>
            {props.picks.length === 0 ? (
              <div className='mt-2 text-xs sm:text-sm text-gray-400'>
                Picks are not available for this league yet.
              </div>
            ) : (
              <div className='mt-2'>
                <select
                  id={`trade-side-${props.side}-pick-select`}
                  aria-label={`Add draft pick to ${props.title}`}
                  disabled={props.disabled}
                  className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-3 py-2.5 text-xs sm:text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
                  value=''
                  onChange={(ev) => {
                    const key = ev.target.value;
                    if (!key) return;
                    if (!props.selectedPickKeys.has(key)) {
                      props.onTogglePick(key);
                    }
                    ev.currentTarget.value = '';
                  }}
                >
                  <option value=''>Select a pick to add</option>
                  {props.picks.map((p) => {
                    const key = pickKey(p);
                    const label = pickLabel(p);
                    const ktc = p.ktc_value ?? 0;
                    const already = props.selectedPickKeys.has(key);
                    return (
                      <option key={key} value={key} disabled={already}>
                        {ktc ? `${label} (${ktc})` : label}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function FairnessGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const left = `${clamped}%`;
  return (
    <div className='relative h-10'>
      <div className='h-3 w-full rounded-full bg-linear-to-r from-red-500/70 via-gray-300/40 to-green-500/70' />
      <div
        className='absolute top-0 -mt-1.5 h-6 w-0'
        style={{ left }}
        aria-hidden
      >
        <div className='-translate-x-1/2'>
          <div className='h-6 w-1 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.35)]' />
        </div>
      </div>
      <div className='mt-2 flex items-center justify-between text-[10px] sm:text-xs text-gray-400'>
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

function TradeAssetStrip(props: {
  title: string;
  emptyLabel: string;
  assets: Array<{ key: string; label: string; position?: string; ktc: number }>;
}) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400'>
          {props.title}
        </div>
        <div className='text-[10px] sm:text-xs tabular-nums text-gray-400'>
          {props.assets.reduce((s, a) => s + (a.ktc || 0), 0).toLocaleString()}
        </div>
      </div>
      {props.assets.length === 0 ? (
        <div className='mt-2 text-xs sm:text-sm text-gray-400'>{props.emptyLabel}</div>
      ) : (
        <div className='mt-2 flex flex-wrap gap-2'>
          {props.assets.map((a) => (
            <span
              key={a.key}
              className={`${TRADE_PLAYER_CHIP} ${tradePlayerChipBorder(a.position)} inline-flex min-h-10 min-w-[44px] px-2.5 py-1.5 sm:min-h-9 sm:px-2 sm:py-1`}
              title={a.ktc > 0 ? `KTC ${a.ktc}` : undefined}
            >
              {a.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsColumn(props: {
  title: string;
  team: TeamData | null;
  data: TradeAnalyzerResponse['side_a'];
}) {
  return (
    <div className='rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <div className='text-sm sm:text-base font-semibold text-gray-100'>{props.title}</div>
          <div className='mt-1 text-xs sm:text-sm text-gray-400'>
            {props.team ? teamDisplayName(props.team) : 'Team not selected'}
          </div>
        </div>
      </div>

      <div className='mt-3 grid grid-cols-1 gap-3'>
        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='text-xs sm:text-sm font-semibold text-gray-200'>Pros</div>
          <ul className='mt-2 list-disc pl-5 text-xs sm:text-sm text-gray-300 space-y-1'>
            {props.data.pros.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='text-xs sm:text-sm font-semibold text-gray-200'>Cons</div>
          <ul className='mt-2 list-disc pl-5 text-xs sm:text-sm text-gray-300 space-y-1'>
            {props.data.cons.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='flex items-center justify-between gap-2'>
            <div className='text-xs sm:text-sm font-semibold text-gray-200'>KTC Delta</div>
          </div>
          <div className='mt-2 grid grid-cols-3 gap-2 text-xs sm:text-sm'>
            <div className='rounded-md border border-white/10 bg-black/10 p-2'>
              <div className='text-gray-400'>Value in</div>
              <div className='mt-1 text-sm sm:text-base font-semibold tabular-nums text-gray-100'>
                {props.data.ktc_delta.values_in.toLocaleString()}
              </div>
            </div>
            <div className='rounded-md border border-white/10 bg-black/10 p-2'>
              <div className='text-gray-400'>Value out</div>
              <div className='mt-1 text-sm sm:text-base font-semibold tabular-nums text-gray-100'>
                {props.data.ktc_delta.values_out.toLocaleString()}
              </div>
            </div>
            <div className='rounded-md border border-white/10 bg-black/10 p-2'>
              <div className='text-gray-400'>Net</div>
              <div className='mt-1 text-sm sm:text-base font-semibold tabular-nums text-gray-100'>
                {props.data.ktc_delta.net.toLocaleString()}
              </div>
            </div>
          </div>

          <div className='mt-3 overflow-hidden rounded-md border border-white/10'>
            <table className='min-w-full border-collapse text-xs sm:text-sm'>
              <thead className='bg-black/20'>
                <tr className='border-b border-white/10'>
                  <th className='p-2 text-left font-semibold text-gray-300'>Asset</th>
                  <th className='p-2 text-right font-semibold text-gray-300'>KTC</th>
                </tr>
              </thead>
              <tbody>
                {props.data.ktc_delta.per_asset.map((a) => (
                  <tr key={a.label} className='border-b border-white/5 last:border-b-0'>
                    <td className='p-2 text-gray-100'>{a.label}</td>
                    <td className='p-2 text-right tabular-nums font-semibold text-gray-100'>
                      {a.value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
          <div className='flex items-start justify-between gap-2'>
            <div>
              <div className='text-xs sm:text-sm font-semibold text-gray-200'>Sleeper Data</div>
            </div>
          </div>
          {/*
            TODO: Sleeper data trajectory chart is temporarily disabled.
            The upstream trajectory values are not yet stable (net duplication / per-team mapping issues).
          */}
          <div className='mt-2 text-xs sm:text-sm text-gray-300'>
            {props.data.sleeper_data.positional_impact}
          </div>
          <ul className='mt-2 list-disc pl-5 text-xs sm:text-sm text-gray-300 space-y-1'>
            {props.data.sleeper_data.needs_addressed.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

