import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BarChart3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  RefreshCwIcon,
  SettingsIcon,
} from 'lucide-react';
import { useLeague } from '../useLeague';
import { resolveTradeAnalyzerSeason } from '../dashboardBundleCache';
import type {
  Player,
  ProviderHealth,
  TeamData,
  TradeAnalyzerHistoryEntry,
  TradeAnalyzerPick,
  TradeAnalyzerRequest,
} from '../types';
import {
  analyzeTrade,
  canonicalPickId,
  fetchTradeAnalyzerProviders,
  type TradeAnalyzerError,
} from '../services/tradeAnalyzer';
import {
  buildTradeAnalyzerHistoryEntry,
  ktcValueForPlayer,
  loadTradeAnalyzerHistory,
  loadTradeAnalyzerPrefs,
  playerDisplayName,
  playerRankLabel,
  saveTradeAnalyzerHistory,
  saveTradeAnalyzerPrefs,
} from '../services/tradeAnalyzerStorage';
import {
  AnalysisResultsPanel,
  RecentTradeAnalysesSection,
} from '../components/tradeAnalyzer/TradeAnalyzerResults';
import {
  buildModelSelectOptions,
  toneForSide,
  tradeValueToneClass,
  TradeAssetTag,
} from '../components/tradeAnalyzer/tradeAssetUi';

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

type ResultsState = { status: 'idle' } | { status: 'loading' } | { status: 'ready' };

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
  | { type: 'analyzeReady' }
  | { type: 'analyzeFailed' }
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

/** Production lock: show all providers but only Gemini is selectable. */
function isProviderUiDisabled(provider: string, allowsClientChoice: boolean): boolean {
  return !allowsClientChoice && provider.trim().toLowerCase() !== 'gemini';
}

function providerUiAvailable(p: ProviderHealth, allowsClientChoice: boolean): boolean {
  return p.healthy && !isProviderUiDisabled(p.provider, allowsClientChoice);
}

function inferAiRoutingFromProviders(
  providers: ProviderHealth[],
  defaultProvider?: string,
  allowsClientChoice = false
): {
  serviceLabel: string;
  modelLabel: string;
} {
  if (providers.length === 0) {
    return {
      serviceLabel: 'Unknown',
      modelLabel: 'Could not load AI settings. Is the backend running?',
    };
  }
  const def = defaultProvider?.trim().toLowerCase();
  const primary = def
    ? providers.find((p) => p.provider.toLowerCase() === def) ??
      providers.find((p) => providerUiAvailable(p, allowsClientChoice)) ??
      providers[0]
    : providers.find((p) => providerUiAvailable(p, allowsClientChoice)) ?? providers[0];
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
  allowsClientChoice: boolean;
}): { serviceLabel: string; modelLabel: string } {
  const { providers, defaultProvider, chosenProvider, chosenModelDraft, allowsClientChoice } =
    args;
  if (providers.length === 0) {
    return {
      serviceLabel: 'Unknown',
      modelLabel: 'Could not load AI settings. Is the backend running?',
    };
  }
  const key = (chosenProvider.trim().toLowerCase() || defaultProvider.toLowerCase());
  const row =
    providers.find((p) => p.provider.toLowerCase() === key) ??
    providers.find((p) => providerUiAvailable(p, allowsClientChoice)) ??
    providers[0];
  const serverHint =
    row.models?.filter((m) => typeof m === 'string' && m.trim())[0] ?? '';
  const modelLabel =
    chosenModelDraft.trim() || serverHint || 'Server default from environment';
  return { serviceLabel: row.provider || key, modelLabel };
}

function pickKey(p: TradeAnalyzerPick): string {
  if (p.pick_id?.trim()) return p.pick_id.trim();
  return `${p.owner_roster_id}_${p.season}_${p.round}_${String(p.descriptor ?? '')}`;
}

function pickLabel(p: TradeAnalyzerPick, ownerRosterId: number): string {
  const d = (p.descriptor || '').trim();
  const base = `${p.season} Round ${p.round}${d ? ` (${d})` : ''}`;
  if (
    p.original_roster_id != null &&
    Number.isFinite(p.original_roster_id) &&
    p.original_roster_id !== ownerRosterId
  ) {
    return `${base} (from R${p.original_roster_id})`;
  }
  return base;
}

/** Owned picks for a roster from the dashboard bundle (`picks_by_roster`). */
function ownedPicksForRoster(
  rosterId: number | null,
  picksByRosterId: Map<number, TradeAnalyzerPick[]>
): TradeAnalyzerPick[] {
  if (rosterId == null) return [];
  return picksByRosterId.get(rosterId) ?? [];
}

/** Picks this roster owns that can still be added to the trade (server pick_id required). */
function picksAvailableToAdd(
  rosterId: number | null,
  picksByRosterId: Map<number, TradeAnalyzerPick[]>,
  selectedPickKeys: Set<string>
): TradeAnalyzerPick[] {
  return ownedPicksForRoster(rosterId, picksByRosterId).filter((p) => {
    if (!p.pick_id?.trim()) return false;
    if (p.owner_roster_id !== rosterId) return false;
    return !selectedPickKeys.has(pickKey(p));
  });
}

function tradeAnalyzerSeasonWire(seasonNum: number): string {
  const year = Math.trunc(seasonNum);
  if (Number.isFinite(year) && year >= 1900 && year <= 3000 && `${year}`.length === 4) {
    return `${year}`;
  }
  return String(new Date().getFullYear());
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
  const [history, setHistory] = useState<TradeAnalyzerHistoryEntry[]>([]);
  const [pinnedAnalysisId, setPinnedAnalysisId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const allowsClientProviderChoice = Boolean(
    taBundle?.allowsClientProviderModelChoice
  );

  const selectedProviderKey = useMemo(
    () =>
      devProvider.trim().toLowerCase() ||
      (taBundle?.defaultProvider ?? '').trim().toLowerCase() ||
      '',
    [devProvider, taBundle?.defaultProvider]
  );

  const selectedProviderRow = useMemo(
    () =>
      state.providers.find((p) => p.provider.toLowerCase() === selectedProviderKey) ??
      state.providers[0] ??
      null,
    [state.providers, selectedProviderKey]
  );

  const selectableModels = useMemo(() => {
    if (!selectedProviderRow?.healthy) return [];
    return (selectedProviderRow.models ?? []).filter(
      (m): m is string => typeof m === 'string' && !!m.trim()
    );
  }, [selectedProviderRow]);

  const modelSelectDisabled =
    !selectedProviderRow?.healthy || selectableModels.length === 0;

  const serverDefaultModelLabel = useMemo(() => {
    const fromApi = selectedProviderRow?.models?.[0]?.trim();
    if (fromApi) return fromApi;
    return '';
  }, [selectedProviderRow]);

  const modelSelectOptions = useMemo(
    () => buildModelSelectOptions(selectableModels, serverDefaultModelLabel),
    [selectableModels, serverDefaultModelLabel]
  );

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
    void (async () => {
      const entries = await loadTradeAnalyzerHistory();
      if (cancelled) return;
      setHistory(entries);
      setPinnedAnalysisId(null);
      setExpandedHistoryId(null);
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
    void (async () => {
      const saved = await loadTradeAnalyzerPrefs();
      if (cancelled) return;
      setDevProvider(saved?.provider || taBundle.defaultProvider);
      setDevModelDraft(saved?.model ?? '');
      setTaPrefsHydratedInternal(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [taBundle?.allowsClientProviderModelChoice, taBundle?.defaultProvider]);

  const devModelSelectValue = useMemo(() => {
    const m = devModelDraft.trim();
    return m && selectableModels.includes(m) ? m : '';
  }, [devModelDraft, selectableModels]);

  const aiRouting = useMemo(() => {
    if (allowsClientProviderChoice && taBundle) {
      return inferAiRoutingDevChoice({
        providers: state.providers,
        defaultProvider: taBundle.defaultProvider,
        chosenProvider: devProvider,
        chosenModelDraft: devModelSelectValue,
        allowsClientChoice: true,
      });
    }
    return inferAiRoutingFromProviders(
      state.providers,
      taBundle?.defaultProvider,
      allowsClientProviderChoice
    );
  }, [
    state.providers,
    taBundle,
    devProvider,
    devModelSelectValue,
    allowsClientProviderChoice,
  ]);

  useEffect(() => {
    if (!taPrefsHydrated || !taBundle?.allowsClientProviderModelChoice) return;
    const t = window.setTimeout(() => {
      void saveTradeAnalyzerPrefs(
        devProvider.trim().toLowerCase() || taBundle.defaultProvider,
        devModelSelectValue || null
      );
    }, 450);
    return () => window.clearTimeout(t);
  }, [
    devProvider,
    devModelSelectValue,
    taPrefsHydrated,
    taBundle?.allowsClientProviderModelChoice,
    taBundle?.defaultProvider,
  ]);

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

  const sideAOwnedPicks = useMemo(
    () => ownedPicksForRoster(state.sideA.rosterId, picksByRosterId),
    [picksByRosterId, state.sideA.rosterId]
  );
  const sideBOwnedPicks = useMemo(
    () => ownedPicksForRoster(state.sideB.rosterId, picksByRosterId),
    [picksByRosterId, state.sideB.rosterId]
  );

  const sideAPicksToAdd = useMemo(
    () =>
      picksAvailableToAdd(
        state.sideA.rosterId,
        picksByRosterId,
        sideASelectedPickKeys
      ),
    [picksByRosterId, sideASelectedPickKeys, state.sideA.rosterId]
  );
  const sideBPicksToAdd = useMemo(
    () =>
      picksAvailableToAdd(
        state.sideB.rosterId,
        picksByRosterId,
        sideBSelectedPickKeys
      ),
    [picksByRosterId, sideBSelectedPickKeys, state.sideB.rosterId]
  );

  const sideASelectedPicks = useMemo(
    () => sideAOwnedPicks.filter((p) => sideASelectedPickKeys.has(pickKey(p))),
    [sideAOwnedPicks, sideASelectedPickKeys]
  );

  const sideBSelectedPicks = useMemo(
    () => sideBOwnedPicks.filter((p) => sideBSelectedPickKeys.has(pickKey(p))),
    [sideBOwnedPicks, sideBSelectedPickKeys]
  );

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

  const hasTradeBuilderAssets =
    state.sideA.assets.length > 0 || state.sideB.assets.length > 0;

  const canAnalyze =
    isReady &&
    state.sideA.rosterId != null &&
    state.sideB.rosterId != null &&
    state.sideA.assets.length > 0 &&
    state.sideB.assets.length > 0 &&
    state.results.status !== 'loading' &&
    !isRateLimited;

  const displayPinnedId = hasTradeBuilderAssets ? pinnedAnalysisId : null;

  const pinnedEntry = useMemo(
    () => history.find((e) => e.id === displayPinnedId) ?? null,
    [history, displayPinnedId]
  );

  const showPinnedResults =
    pinnedEntry != null && state.results.status !== 'loading';

  const showRecentSection = history.length > 0 && (!showPinnedResults || !hasTradeBuilderAssets);

  return (
    <div className='w-full'>
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
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main ${
                settingsOpen
                  ? 'border-primary-main/40 bg-primary-main/15 text-white hover:bg-primary-main/25'
                  : 'border-white/15 bg-white/5 text-gray-200 hover:border-white/25 hover:bg-white/10 hover:text-white'
              }`}
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              aria-controls='trade-analyzer-ai-settings'
              aria-label={
                settingsOpen
                  ? 'Close AI settings panel'
                  : 'Open AI settings panel'
              }
            >
              <SettingsIcon className='h-4 w-4' />
              AI Settings
              {settingsOpen ? (
                <ChevronUpIcon className='h-4 w-4 text-primary-main' aria-hidden />
              ) : (
                <ChevronDownIcon className='h-4 w-4 text-gray-400' aria-hidden />
              )}
            </button>
          </div>
        </div>

        {settingsOpen ? (
          <div
            id='trade-analyzer-ai-settings'
            className='mt-3 rounded-lg border border-primary-main/25 bg-black/10 p-3 text-xs sm:text-sm text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          >
            <p className='text-xs sm:text-sm text-gray-400'>
              {taBundle == null ? (
                <>Loading…</>
              ) : taBundle.allowsClientProviderModelChoice ? (
                <>
                  Local dev: choose a <span className='font-semibold text-gray-200'>provider</span> and{' '}
                  <span className='font-semibold text-gray-200'>model</span> from what the server reports
                  as available.
                </>
              ) : (
                <>
                  Production uses <span className='font-semibold text-gray-200'>Gemini</span> only.
                  Anthropic, echo, and ollama stay wired up but are disabled here until
                  configured.
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
                    onChange={(ev) => {
                      setDevProvider(ev.target.value.trim().toLowerCase());
                      setDevModelDraft('');
                    }}
                  >
                    {state.providers.map((p) => {
                      const key = p.provider.toLowerCase();
                      const uiDisabled = isProviderUiDisabled(key, allowsClientProviderChoice);
                      const unavailable = uiDisabled || !p.healthy;
                      return (
                        <option key={p.provider} value={key} disabled={uiDisabled}>
                          {p.provider}
                          {unavailable ? ' (unavailable)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className='block text-xs sm:text-sm'>
                  <span className='font-semibold text-gray-200'>Model</span>
                  <select
                    className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-2 py-2 text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
                    value={devModelSelectValue}
                    disabled={modelSelectDisabled}
                    onChange={(ev) => setDevModelDraft(ev.target.value)}
                  >
                    {modelSelectOptions.map((opt) => (
                      <option key={opt.value || '__default__'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {modelSelectDisabled ? (
                    <p className='mt-1 text-xs text-gray-400'>
                      {!selectedProviderRow?.healthy
                        ? 'This provider is unavailable. Choose another provider or fix its configuration.'
                        : 'No models are available for this provider.'}
                    </p>
                  ) : null}
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
                state.providers.map((p) => {
                  const uiAvailable = providerUiAvailable(p, allowsClientProviderChoice);
                  return (
                    <div
                      key={p.provider}
                      className='rounded-md border border-white/10 bg-white/5 p-2 text-[10px] sm:text-xs text-gray-300'
                    >
                      <span className='font-semibold text-gray-200'>{p.provider}</span>{' '}
                      <span className={uiAvailable ? 'text-green-300' : 'text-red-300'}>
                        {uiAvailable
                          ? 'healthy'
                          : isProviderUiDisabled(p.provider, allowsClientProviderChoice)
                            ? 'unavailable'
                            : 'unhealthy'}
                      </span>
                    </div>
                  );
                })
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
            otherSubtotal={sideBSubtotal}
            picksToAdd={sideAPicksToAdd}
            ownedPickCount={sideAOwnedPicks.length}
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
            otherSubtotal={sideASubtotal}
            picksToAdd={sideBPicksToAdd}
            ownedPickCount={sideBOwnedPicks.length}
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

              const seasonWire = tradeAnalyzerSeasonWire(tradeAnalysisSeason);

              const playerIdsFrom = (list: Player[]) =>
                list
                  .map((p) => p.player_id)
                  .filter((id): id is string => typeof id === 'string' && !!id);

              const req: TradeAnalyzerRequest = {
                league_id: selectedLeagueId,
                season: seasonWire,
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

              if (allowsClientProviderChoice && taBundle) {
                const p =
                  devProvider.trim().toLowerCase() || taBundle.defaultProvider;
                if (p) req.provider = p;
                if (devModelSelectValue) req.model = devModelSelectValue;
              }

              const analyzedAt = Date.now();
              void (async () => {
                try {
                  const res = await analyzeTrade(req);
                  const entry = buildTradeAnalyzerHistoryEntry({
                    leagueId: selectedLeagueId,
                    createdAt: analyzedAt,
                    request: req,
                    response: res,
                    additionalContext: state.context,
                    sideATeam,
                    sideBTeam,
                    sideAPlayers: sideASelectedPlayers,
                    sideBPlayers: sideBSelectedPlayers,
                    sideAPicks: sideASelectedPicks,
                    sideBPicks: sideBSelectedPicks,
                    pickLabel,
                  });
                  const nextHistory = await saveTradeAnalyzerHistory(entry);
                  setHistory(nextHistory);
                  setPinnedAnalysisId(entry.id);
                  setExpandedHistoryId(null);
                  dispatch({ type: 'analyzeReady' });
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
                  dispatch({ type: 'analyzeFailed' });
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

      {showRecentSection ? (
        <RecentTradeAnalysesSection
          entries={history}
          expandedId={expandedHistoryId}
          pinnedId={showPinnedResults ? displayPinnedId : null}
          onToggleExpand={(id: string) =>
            setExpandedHistoryId((cur) => (cur === id ? null : id))
          }
        />
      ) : null}

      {showPinnedResults && pinnedEntry ? (
        <AnalysisResultsPanel
          entry={pinnedEntry}
          onRunAnother={() => {
            setPinnedAnalysisId(null);
            setExpandedHistoryId(null);
            dispatch({ type: 'resetAll' });
            builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
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
  picksToAdd: TradeAnalyzerPick[];
  ownedPickCount: number;
  selectedPickKeys: Set<string>;
  selectedPicks: TradeAnalyzerPick[];
  subtotal: number;
  otherSubtotal: number;
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

  const valueTone = toneForSide(props.subtotal, props.otherSubtotal);

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
              <div className='text-xs font-semibold text-gray-200 sm:text-sm'>Trading away</div>
              <div
                className={`text-base font-bold tabular-nums sm:text-lg ${tradeValueToneClass(valueTone)}`}
              >
                {props.subtotal.toLocaleString()}
              </div>
            </div>
            {props.selectedPlayers.length === 0 && props.selectedPicks.length === 0 ? (
              <div className='mt-2 text-xs text-gray-400 sm:text-sm'>No assets yet.</div>
            ) : (
              <div className='mt-2 space-y-2'>
                {props.selectedPlayers.map((p) => {
                  const name = playerDisplayName(p);
                  const ktc = ktcValueForPlayer(p);
                  return (
                    <TradeAssetTag
                      key={p.player_id}
                      asset={{
                        key: p.player_id ?? name,
                        name,
                        position: p.position,
                        ktc,
                        rankLabel: playerRankLabel(p),
                      }}
                      valueTone={valueTone}
                      onRemove={() => p.player_id && props.onTogglePlayer(p.player_id)}
                      removeLabel={`Remove ${name} from ${props.title}`}
                    />
                  );
                })}
                {props.selectedPicks.map((p) => {
                  const key = pickKey(p);
                  const label = pickLabel(p, props.selectedRosterId ?? p.owner_roster_id);
                  const ktc = p.ktc_value ?? 0;
                  return (
                    <TradeAssetTag
                      key={key}
                      isPick
                      asset={{
                        key,
                        name: label,
                        ktc,
                        rankLabel: null,
                      }}
                      valueTone={valueTone}
                      onRemove={() => props.onTogglePick(key)}
                      removeLabel={`Remove ${label} from ${props.title}`}
                    />
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
                      const name = playerDisplayName(p);
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
            {props.ownedPickCount === 0 ? (
              <div className='mt-2 text-xs sm:text-sm text-gray-400'>
                No owned draft picks for this team yet. Refresh league data from Sleeper
                so traded picks sync, then reload the dashboard.
              </div>
            ) : props.picksToAdd.length === 0 ? (
              <div className='mt-2 text-xs sm:text-sm text-gray-400'>
                All of this team&apos;s owned picks are already in the trade.
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
                    const allowed = new Set(
                      props.picksToAdd.map((p) => pickKey(p))
                    );
                    if (!allowed.has(key)) return;
                    props.onTogglePick(key);
                    ev.currentTarget.value = '';
                  }}
                >
                  <option value=''>Select a pick to add</option>
                  {props.picksToAdd.map((p) => {
                    const key = pickKey(p);
                    const rid = props.selectedRosterId ?? p.owner_roster_id;
                    const label = pickLabel(p, rid);
                    const ktc = p.ktc_value ?? 0;
                    return (
                      <option key={key} value={key}>
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


