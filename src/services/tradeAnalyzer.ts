import { API_CONFIG, buildApiUrl } from '../apiConfig';
import type {
  ApiResponse,
  ProviderHealth,
  TradeAnalyzerPick,
  TradeAnalyzerRateLimitError,
  TradeAnalyzerRequest,
  TradeAnalyzerResponse,
} from '../types';

const CANONICAL_PICK_RE = /^(\d{4})-r(\d+)-(early|mid|late|pick\d+)$/;

/** Build a pick_id string that satisfies `services.trade_analyzer.picks.parse_pick_id`. */
export function canonicalPickId(p: TradeAnalyzerPick): string {
  const trimmed = p.pick_id?.trim();
  if (trimmed && CANONICAL_PICK_RE.test(trimmed)) return trimmed;

  const yearNum =
    typeof p.season === 'number' && Number.isFinite(p.season)
      ? p.season
      : parseInt(String(p.season), 10);
  const yearStr = Number.isFinite(yearNum)
    ? String(Math.trunc(yearNum)).padStart(4, '0')
    : '0000';
  const roundNum =
    typeof p.round === 'number' && Number.isFinite(p.round)
      ? Math.trunc(p.round)
      : parseInt(String(p.round), 10) || 1;

  let slot = (p.descriptor ?? 'mid').toString().trim().toLowerCase();
  if (slot !== 'early' && slot !== 'mid' && slot !== 'late') {
    slot = /^pick\d+$/i.test(slot) ? slot.toLowerCase() : 'mid';
  }
  return `${yearStr}-r${roundNum}-${slot}`;
}

function buildAnalyzeTradeBody(req: TradeAnalyzerRequest): string {
  const payload: Record<string, unknown> = {
    league_id: req.league_id,
    season: req.season,
    side_a: req.side_a,
    side_b: req.side_b,
  };
  if (req.ktc != null) payload.ktc = req.ktc;
  const ctx = typeof req.additional_context === 'string'
    ? req.additional_context.trim()
    : '';
  if (ctx) payload.additional_context = ctx;
  if (typeof req.provider === 'string' && req.provider.trim()) {
    payload.provider = req.provider.trim().toLowerCase();
  }
  if (typeof req.model === 'string' && req.model.trim()) {
    payload.model = req.model.trim();
  }
  return JSON.stringify(payload);
}

/** Map backend `/analyze` JSON (LLM-shaped) onto UI `TradeAnalyzerResponse`. */
export function normalizeTradeAnalyzerResponse(raw: unknown): TradeAnalyzerResponse {
  const parseWinner = (): TradeAnalyzerResponse['winner'] => {
    const r = raw as Record<string, unknown>;
    const w = String(r.winner ?? '')
      .toLowerCase()
      .trim();
    if (w === 'side_a' || w === 'a') return 'a';
    if (w === 'side_b' || w === 'b') return 'b';
    return 'even';
  };

  const normSide = (block: unknown): TradeAnalyzerResponse['side_a'] => {
    const b = (block ?? {}) as Record<string, unknown>;
    const kd = (b.ktc_delta ?? {}) as Record<string, unknown>;
    const rawAssets = kd.per_asset;
    const per_asset = Array.isArray(rawAssets)
      ? (rawAssets as unknown[]).map((row, i) => {
          const r = (row ?? {}) as Record<string, unknown>;
          const label = String(r.label ?? r.name ?? `Asset ${i + 1}`);
          const value =
            typeof r.value === 'number' && Number.isFinite(r.value)
              ? r.value
              : Number(r.value) || 0;
          return { label, value };
        })
      : [];

    const sleeper = (b.sleeper_data ?? b.sleeper_breakdown ?? {}) as Record<
      string,
      unknown
    >;
    const traj = sleeper.stats_trajectory;
    let stats_trajectory: Array<{ x: string; y: number }>;
    if (Array.isArray(traj) && traj.length > 0) {
      const first = traj[0];
      if (
        first &&
        typeof first === 'object' &&
        'x' in (first as object) &&
        'y' in (first as object)
      ) {
        stats_trajectory = (traj as Array<{ x: unknown; y: unknown }>).map(
          (pt) => ({
            x: String(pt.x),
            y:
              typeof pt.y === 'number' && Number.isFinite(pt.y)
                ? pt.y
                : Number(pt.y) || 0,
          })
        );
      } else {
        stats_trajectory = (traj as unknown[]).map((t, idx) => ({
          x: typeof t === 'string' ? t.slice(0, 24) : `Note ${idx + 1}`,
          y: idx,
        }));
      }
    } else {
      stats_trajectory = [{ x: '—', y: 0 }];
    }

    const needsRaw =
      sleeper.needs_addressed ??
      sleeper.team_needs_addressed ??
      sleeper.needs ??
      [];
    const needs_addressed = Array.isArray(needsRaw)
      ? needsRaw.map((x) => String(x))
      : typeof needsRaw === 'string'
        ? [needsRaw]
        : [];

    return {
      pros: Array.isArray(b.pros) ? (b.pros as unknown[]).map(String) : [],
      cons: Array.isArray(b.cons) ? (b.cons as unknown[]).map(String) : [],
      ktc_delta: {
        values_in: Number(kd.values_in) || 0,
        values_out: Number(kd.values_out) || 0,
        net: Number(kd.net) || 0,
        per_asset,
      },
      sleeper_data: {
        stats_trajectory,
        positional_impact: String(sleeper.positional_impact ?? ''),
        needs_addressed,
      },
    };
  };

  const r = (raw ?? {}) as Record<string, unknown>;
  const score = Number(r.fairness_score);
  const fairness_score = Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 50;

  return {
    fairness_score,
    winner: parseWinner(),
    summary_bullets: Array.isArray(r.summary_bullets)
      ? (r.summary_bullets as unknown[]).map(String)
      : [],
    side_a: normSide(r.side_a),
    side_b: normSide(r.side_b),
  };
}

/** GET /trade-analyzer/providers wire shape (`routes/trade_analyzer/providers.py`). */
interface ProvidersRootResponse {
  default_provider?: string;
  allows_client_provider_model_choice?: boolean;
  providers?: Array<{
    name: string;
    default_model?: string;
    available: boolean;
    detail?: string;
  }>;
  rate_limit?: { per_hour?: number; key?: string };
  enabled?: boolean;
}

/** Normalized `/trade-analyzer/providers` payload for UI. */
export interface TradeAnalyzerProvidersBundle {
  providers: ProviderHealth[];
  defaultProvider: string;
  allowsClientProviderModelChoice: boolean;
  enabled: boolean;
  rateLimitPerHour: number;
}

export type TradeAnalyzerError =
  | { kind: 'network'; message: string }
  | { kind: 'rate_limit'; message: string; retryAfterSeconds: number }
  | { kind: 'http'; message: string; status: number };

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string' && err.trim()) return err;
  }
  return fallback;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}));
}

async function fetchProvidersRootThrowing(): Promise<ProvidersRootResponse> {
  const url = buildApiUrl(API_CONFIG.ENDPOINTS.TRADE_ANALYZER_PROVIDERS);
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw { kind: 'network', message: 'Unable to connect to backend server. Please ensure it is running.' } satisfies TradeAnalyzerError;
  }

  const body = await readJsonSafe(res);
  if (!res.ok) {
    throw {
      kind: 'http',
      status: res.status,
      message: extractErrorMessage(body, `Failed to load providers: ${res.status} ${res.statusText}`),
    } satisfies TradeAnalyzerError;
  }

  return body as ProvidersRootResponse;
}

function mapProviderRows(
  rows: NonNullable<ProvidersRootResponse['providers']> | undefined
): ProviderHealth[] {
  if (!rows) return [];
  return rows.map((p) => ({
    provider: p.name,
    healthy: Boolean(p.available),
    models: p.default_model ? [p.default_model] : [],
    message: typeof p.detail === 'string' ? p.detail : undefined,
  }));
}

/** Full providers response including dev vs prod model-selection policy. */
export async function fetchTradeAnalyzerProviders(): Promise<TradeAnalyzerProvidersBundle> {
  const parsed = await fetchProvidersRootThrowing();
  const loose = parsed as ProvidersRootResponse &
    Partial<ApiResponse<ProviderHealth[]>> &
    Record<string, unknown>;

  const rateLimitPerHour = (): number => {
    const lim = loose.rate_limit as { per_hour?: unknown } | undefined;
    return typeof lim?.per_hour === 'number' ? lim.per_hour : 20;
  };

  const metaBundle = (providers: ProviderHealth[], defProv: string): TradeAnalyzerProvidersBundle => ({
    providers,
    defaultProvider: defProv,
    allowsClientProviderModelChoice: Boolean(loose.allows_client_provider_model_choice ?? true),
    enabled: Boolean(loose.enabled ?? true),
    rateLimitPerHour: rateLimitPerHour(),
  });

  const rows = loose.providers;

  if (!rows && loose.status === 'success' && Array.isArray(loose.data)) {
    const def =
      typeof loose.default_provider === 'string' && loose.default_provider.trim()
        ? loose.default_provider.trim()
        : 'ollama';
    return metaBundle(loose.data as ProviderHealth[], def);
  }

  const dataArr = loose.data;
  if (!rows && Array.isArray(dataArr)) {
    const def =
      typeof loose.default_provider === 'string' && loose.default_provider.trim()
        ? loose.default_provider.trim()
        : 'ollama';
    return metaBundle(dataArr as ProviderHealth[], def);
  }

  const rootArr = parsed as unknown;
  if (Array.isArray(rootArr)) {
    return metaBundle(rootArr as ProviderHealth[], 'ollama');
  }

  const defaultProvider =
    typeof loose.default_provider === 'string' && loose.default_provider.trim()
      ? loose.default_provider.trim()
      : 'ollama';

  return metaBundle(mapProviderRows(rows ?? []), defaultProvider);
}

export async function getProviderHealth(): Promise<ProviderHealth[]> {
  const bundle = await fetchTradeAnalyzerProviders();
  return bundle.providers;
}

export async function analyzeTrade(
  req: TradeAnalyzerRequest
): Promise<TradeAnalyzerResponse> {
  const url = buildApiUrl(API_CONFIG.ENDPOINTS.TRADE_ANALYZER_ANALYZE);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildAnalyzeTradeBody(req),
    });
  } catch {
    throw { kind: 'network', message: 'Unable to connect to backend server. Please ensure it is running.' } satisfies TradeAnalyzerError;
  }

  const body = await readJsonSafe(res);

  if (res.status === 429) {
    const rl = body as Partial<TradeAnalyzerRateLimitError>;
    const retryAfterSeconds =
      typeof rl.retry_after_seconds === 'number' && Number.isFinite(rl.retry_after_seconds)
        ? rl.retry_after_seconds
        : 60;
    throw {
      kind: 'rate_limit',
      retryAfterSeconds,
      message: extractErrorMessage(body, 'You have hit the analysis limit. Try again soon.'),
    } satisfies TradeAnalyzerError;
  }

  if (!res.ok) {
    throw {
      kind: 'http',
      status: res.status,
      message: extractErrorMessage(body, `Analyze failed: ${res.status} ${res.statusText}`),
    } satisfies TradeAnalyzerError;
  }

  const api = body as ApiResponse<TradeAnalyzerResponse>;
  if (api.status === 'success' && api.data) {
    return normalizeTradeAnalyzerResponse(api.data);
  }
  if ((body as { data?: unknown }).data) {
    return normalizeTradeAnalyzerResponse((body as { data: unknown }).data);
  }

  return normalizeTradeAnalyzerResponse(body);
}
