import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  RefreshCwIcon,
  SettingsIcon,
} from 'lucide-react';
import { useLeague } from '../useLeague';
import { resolveTradeAnalyzerSeason } from '../dashboardBundleCache';
import type {
  Player,
  TeamData,
  TradeAnalyzerHistoryEntry,
  TradeAnalyzerPick,
  TradeAnalyzerRequest,
} from '../types';
import { getClientId } from '../services/clientId';
import {
  analyzeTrade,
  canonicalPickId,
  fetchTradeAnalyzerProviders,
  pickAssetKey,
  submitTradeFeedback,
  type TradeAnalyzerError,
} from '../services/tradeAnalyzer';
import { FeedbackGate, type GateValues } from './tradeAnalyzer/FeedbackGate';
import {
  buildTradeAnalyzerHistoryEntry,
  ktcValueForPlayer,
  loadTradeAnalyzerHistory,
  loadTradeAnalyzerPrefs,
  saveTradeAnalyzerHistory,
  saveTradeAnalyzerPrefs,
} from '../services/tradeAnalyzerStorage';
import {
  AnalysisResultsPanel,
  RecentTradeAnalysesSection,
} from '../components/tradeAnalyzer/TradeAnalyzerResults';
import { PlayerDetailModal } from '../components/PlayerDetailModal';
import { buildModelSelectOptions } from '../components/tradeAnalyzer/tradeAssetUi';
import {
  reducer,
  createInitialState,
  MAX_CONTEXT_CHARS,
  type SelectedPlayer,
  type SelectedPick,
} from './tradeAnalyzer/state';
import {
  teamDisplayName,
  isProviderUiDisabled,
  providerUiAvailable,
  inferAiRoutingFromProviders,
  inferAiRoutingDevChoice,
  pickLabel,
  ownedPicksForRoster,
  picksAvailableToAdd,
  tradeAnalyzerSeasonWire,
} from './tradeAnalyzer/helpers';
import { SideCard } from './tradeAnalyzer/SideCard';
import { DashboardSectionMeta } from '../components/DashboardSectionMeta';

export const TradeAnalyzerPage: React.FC = () => {
  const {
    leagueIdReady,
    loading,
    teamsData,
    players,
    playerOwnership,
    league,
    ktcConfig,
    tradePicksByRoster,
    selectedLeagueId,
    bundleSeason,
    researchMeta,
  } = useLeague();
  const leagueSeason = league?.season != null ? String(league.season) : null;
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const tradeAnalysisSeason = useMemo(() => {
    // Prefer the server-resolved bundle season; fall back before the bundle loads.
    const fromBundle = parseInt(bundleSeason ?? '', 10);
    if (Number.isFinite(fromBundle) && fromBundle > 0) return fromBundle;
    return resolveTradeAnalyzerSeason(league, selectedLeagueId);
  }, [bundleSeason, league, selectedLeagueId]);
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
  const [prodModel, setProdModel] = useState('');
  const taPrefsHydrated = taBundle?.allowsClientProviderModelChoice
    ? taPrefsHydratedInternal
    : false;

  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const builderRef = useRef<HTMLDivElement | null>(null);
  const [history, setHistory] = useState<TradeAnalyzerHistoryEntry[]>([]);
  const [pinnedAnalysisId, setPinnedAnalysisId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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

  const prodGeminiModels = useMemo(() => {
    if (allowsClientProviderChoice) return [];
    const gemini = state.providers.find((p) => p.provider.toLowerCase() === 'gemini');
    return (gemini?.models ?? []).filter((m): m is string => typeof m === 'string' && !!m.trim());
  }, [state.providers, allowsClientProviderChoice]);

  const showProdModelSelector = !allowsClientProviderChoice && prodGeminiModels.length > 1;

  const prodModelSelectOptions = useMemo(
    () => buildModelSelectOptions(prodGeminiModels, prodGeminiModels[0] ?? ''),
    [prodGeminiModels]
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
    const base = inferAiRoutingFromProviders(
      state.providers,
      taBundle?.defaultProvider,
      allowsClientProviderChoice
    );
    if (prodModel.trim()) {
      return { ...base, modelLabel: prodModel.trim() };
    }
    return base;
  }, [
    state.providers,
    taBundle,
    devProvider,
    devModelSelectValue,
    allowsClientProviderChoice,
    prodModel,
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
    () => sideAOwnedPicks.filter((p) => sideASelectedPickKeys.has(pickAssetKey(p))),
    [sideAOwnedPicks, sideASelectedPickKeys]
  );

  const sideBSelectedPicks = useMemo(
    () => sideBOwnedPicks.filter((p) => sideBSelectedPickKeys.has(pickAssetKey(p))),
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
    !isRateLimited &&
    state.pendingFeedbackAnalysisId == null;

  const displayPinnedId = hasTradeBuilderAssets ? pinnedAnalysisId : null;

  const pinnedEntry = useMemo(
    () => history.find((e) => e.id === displayPinnedId) ?? null,
    [history, displayPinnedId]
  );

  const showPinnedResults =
    pinnedEntry != null && state.results.status !== 'loading';

  const pinnedNeedsFeedback =
    state.pendingFeedbackAnalysisId != null &&
    pinnedEntry?.response?.analysis_id === state.pendingFeedbackAnalysisId;

  const showRecentSection = history.length > 0 && (!showPinnedResults || !hasTradeBuilderAssets);

  const handleFeedbackSubmit = async (v: GateValues) => {
    const id = state.pendingFeedbackAnalysisId;
    if (!id) return;
    setFeedbackSubmitting(true); setFeedbackError(null);
    try {
      await submitTradeFeedback({ analysis_id: id, client_id: getClientId(),
        league_id: selectedLeagueId ?? '', agree_winner: v.agree_winner, grade: v.grade, note: v.note });
      setFeedbackDone(true);
    } catch {
      setFeedbackError('Could not save feedback. Try again, or Run another to skip.');
    } finally { setFeedbackSubmitting(false); }
  };
  const handleRunAnother = async () => {
    const id = state.pendingFeedbackAnalysisId;
    if (id && !feedbackDone) {
      try {
        await submitTradeFeedback({ analysis_id: id, client_id: getClientId(),
          league_id: selectedLeagueId ?? '', skipped: true });
      } catch { /* skip is best-effort */ }
    }
    setFeedbackError(null);
    setFeedbackDone(false);
    dispatch({ type: 'feedbackResolved' });
    setPinnedAnalysisId(null);
    setExpandedHistoryId(null);
    dispatch({ type: 'resetAll' });
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='mx-auto w-full max-w-6xl px-2 sm:px-4'>
      <div className='league-standings-heading mb-2 text-center text-lg font-semibold text-primary-main sm:text-2xl'>
        Trade Analyzer
      </div>
      <DashboardSectionMeta showScoring className='mb-4' />

      <div ref={builderRef} className='rounded-xl border border-white/10 bg-[#0d1e2e] p-3 sm:p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <p className='text-xs sm:text-sm text-gray-300'>
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
                  <span className='font-semibold text-gray-200'>Gemini</span>{' '}
                  only. Other providers shown below but unavailable.
                </>
              )}
            </p>
            {showProdModelSelector ? (
              <div className='mt-3'>
                <label className='block text-xs sm:text-sm'>
                  <span className='font-semibold text-gray-200'>Model</span>
                  <select
                    className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-2 py-2 text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main'
                    value={prodModel}
                    onChange={(ev) => setProdModel(ev.target.value)}
                  >
                    {prodModelSelectOptions.map((opt) => (
                      <option key={opt.value || '__default__'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
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

        <p className='mt-3 text-xs text-gray-400 sm:text-sm'>
          Values shown next to each player and pick are KTC values.
        </p>
        <div className='mt-2 grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SideCard
            title={
              sideATeam ? teamDisplayName(sideATeam) : 'Team 1'
            }
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
            isTanking={state.sideA.isTanking}
            onActive={() => dispatch({ type: 'setActiveSide', side: 'a' })}
            onRosterChange={(rid) => dispatch({ type: 'setRoster', side: 'a', rosterId: rid })}
            onTogglePlayer={(pid) => dispatch({ type: 'togglePlayer', side: 'a', playerId: pid })}
            onTogglePick={(key) => dispatch({ type: 'togglePick', side: 'a', pickKey: key })}
            onTankingChange={(value) => dispatch({ type: 'setTanking', side: 'a', value })}
            onClear={() => dispatch({ type: 'clearSideAssets', side: 'a' })}
            onOpenPlayerDetail={setDetailPlayer}
          />
          <SideCard
            title={
              sideBTeam ? teamDisplayName(sideBTeam) : 'Team 2'
            }
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
            isTanking={state.sideB.isTanking}
            onActive={() => dispatch({ type: 'setActiveSide', side: 'b' })}
            onRosterChange={(rid) => dispatch({ type: 'setRoster', side: 'b', rosterId: rid })}
            onTogglePlayer={(pid) => dispatch({ type: 'togglePlayer', side: 'b', playerId: pid })}
            onTogglePick={(key) => dispatch({ type: 'togglePick', side: 'b', pickKey: key })}
            onTankingChange={(value) => dispatch({ type: 'setTanking', side: 'b', value })}
            onClear={() => dispatch({ type: 'clearSideAssets', side: 'b' })}
            onOpenPlayerDetail={setDetailPlayer}
          />
        </div>

        <div className='mt-3 rounded-xl border border-white/10 bg-black/10 p-2 sm:p-3'>
          <div className='flex items-center justify-between gap-2'>
            <label className='text-xs sm:text-sm font-semibold text-gray-200' htmlFor='trade-analyzer-context'>
              Additional context
            </label>
            <div className='text-[10px] sm:text-xs tabular-nums text-gray-400'>
              {state.context.length}/{MAX_CONTEXT_CHARS}
            </div>
          </div>
          <textarea
            id='trade-analyzer-context'
            rows={3}
            value={state.context}
            disabled={!isReady}
            onChange={(ev) => dispatch({ type: 'setContext', value: ev.target.value })}
            placeholder='Optional: injuries, timeline, league context…'
            className='mt-1.5 w-full min-h-16 resize-y rounded-lg border border-white/10 bg-[#0b1624] px-2.5 py-2 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
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
                  is_tanking: state.sideA.isTanking,
                },
                side_b: {
                  roster_id: state.sideB.rosterId ?? 0,
                  player_ids: playerIdsFrom(sideBSelectedPlayers),
                  pick_ids: sideBSelectedPicks.map((p) => canonicalPickId(p)),
                  is_tanking: state.sideB.isTanking,
                },
                ktc: ktcConfig,
                additional_context: state.context.trim() || undefined,
              };

              if (allowsClientProviderChoice && taBundle) {
                const p =
                  devProvider.trim().toLowerCase() || taBundle.defaultProvider;
                if (p) req.provider = p;
                if (devModelSelectValue) req.model = devModelSelectValue;
              }
              if (!allowsClientProviderChoice && prodModel.trim()) {
                req.model = prodModel.trim();
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
                  setFeedbackDone(false);
                  dispatch({ type: 'analyzeReady', analysisId: res.analysis_id });
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
          ) : state.pendingFeedbackAnalysisId != null ? (
            <div className='text-xs text-amber-300/70'>Rate the result below, then Run another</div>
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
          footer={
            pinnedNeedsFeedback ? (
              <>
                <FeedbackGate
                  onSubmit={handleFeedbackSubmit}
                  onRunAnother={handleRunAnother}
                  submitting={feedbackSubmitting}
                  done={feedbackDone}
                />
                {feedbackError && (
                  <div className='mt-1 text-xs text-red-300'>{feedbackError}</div>
                )}
              </>
            ) : (
              <button
                type='button'
                onClick={handleRunAnother}
                className='inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white sm:text-sm'
              >
                Run another
              </button>
            )
          }
        />
      ) : null}

      {detailPlayer ? (
        <PlayerDetailModal
          player={detailPlayer}
          bundleSeason={bundleSeason}
          leagueSeason={leagueSeason}
          researchWeek={researchMeta?.week ?? null}
          ownershipMap={playerOwnership}
          onClose={() => setDetailPlayer(null)}
        />
      ) : null}

    </div>
  );
};