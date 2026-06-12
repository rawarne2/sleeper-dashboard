import { openDB } from 'idb';
import type {
  Player,
  TeamData,
  TradeAnalyzerHistoryEntry,
  TradeAnalyzerHistoryRow,
  TradeAnalyzerPick,
  TradeAnalyzerPrefsRow,
  TradeAnalyzerRequest,
  TradeAnalyzerResponse,
} from '../types';
import {
  ktcDisplayValues,
  ktcRankLabel,
  playerDisplayName as sharedPlayerDisplayName,
} from '../playerFunctions';

const DB_NAME = 'sleeper-players-db';
const DB_VERSION = 4;

export const TRADE_ANALYZER_HISTORY_KEY = 'trade_analyzer_history';
export const TRADE_ANALYZER_LAST_RESULT_KEY = 'trade_analyzer_last_result';
export const TRADE_ANALYZER_PREFS_KEY = 'trade_analyzer_prefs';
export const MAX_TRADE_ANALYZER_HISTORY = 3;

async function openPrefsDb() {
  return openDB(DB_NAME, DB_VERSION);
}

// The backend already resolves KTC values per league format + TEP + redraft and
// hoists them to the top-level block, so these read `ktcDisplayValues` rather than
// reaching into a hardcoded `superflexValues.tep` (which broke 1QB / non-TEP leagues).
export function ktcValueForPlayer(p: Player): number {
  const v = ktcDisplayValues(p)?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function playerDisplayName(p: Player): string {
  return sharedPlayerDisplayName(p);
}

export function playerRankLabel(p: Player): string | null {
  return ktcRankLabel(p);
}

export function buildTradeAnalyzerHistoryEntry(args: {
  leagueId: string;
  createdAt: number;
  request: TradeAnalyzerRequest;
  response: TradeAnalyzerResponse;
  additionalContext: string;
  sideATeam: TeamData | null;
  sideBTeam: TeamData | null;
  sideAPlayers: Player[];
  sideBPlayers: Player[];
  sideAPicks: TradeAnalyzerPick[];
  sideBPicks: TradeAnalyzerPick[];
  pickLabel: (p: TradeAnalyzerPick) => string;
}): TradeAnalyzerHistoryEntry {
  const side = (
    rosterId: number,
    team: TeamData | null,
    pls: Player[],
    picks: TradeAnalyzerPick[]
  ): TradeAnalyzerHistoryEntry['side_a'] => {
    const players = pls.map((p) => ({
      player_id: p.player_id ?? '',
      name: playerDisplayName(p),
      position: p.position,
      ktc_value: ktcValueForPlayer(p),
      rank_label: playerRankLabel(p),
    }));
    const pickRows = picks.map((p) => ({
      pick_id: p.pick_id,
      label: args.pickLabel(p),
      ktc_value: p.ktc_value ?? 0,
    }));
    const ktc_subtotal =
      players.reduce((s, x) => s + x.ktc_value, 0) +
      pickRows.reduce((s, x) => s + x.ktc_value, 0);
    return {
      roster_id: rosterId,
      team_name: team ? team.user.metadata?.team_name || team.user.team_name || team.user.display_name : `Roster ${rosterId}`,
      team_subtitle: team ? team.user.username || team.user.display_name : '',
      players,
      picks: pickRows,
      ktc_subtotal,
    };
  };

  return {
    id: `${args.createdAt}-${args.request.side_a.roster_id}-${args.request.side_b.roster_id}`,
    createdAt: args.createdAt,
    league_id: args.leagueId,
    additional_context: args.additionalContext.trim() || undefined,
    request: args.request,
    response: args.response,
    side_a: side(
      args.request.side_a.roster_id,
      args.sideATeam,
      args.sideAPlayers,
      args.sideAPicks
    ),
    side_b: side(
      args.request.side_b.roster_id,
      args.sideBTeam,
      args.sideBPlayers,
      args.sideBPicks
    ),
  };
}

export async function loadTradeAnalyzerPrefs(): Promise<{
  provider: string;
  model: string;
} | null> {
  try {
    const db = await openPrefsDb();
    const row = (await db.get('app_prefs', TRADE_ANALYZER_PREFS_KEY)) as
      | TradeAnalyzerPrefsRow
      | undefined;
    if (!row) return null;
    return {
      provider:
        typeof row.provider === 'string' && row.provider.trim()
          ? row.provider.trim().toLowerCase()
          : '',
      model: typeof row.model === 'string' ? row.model : '',
    };
  } catch {
    return null;
  }
}

export async function saveTradeAnalyzerPrefs(
  provider: string,
  model: string | null
): Promise<void> {
  try {
    const db = await openPrefsDb();
    await db.put('app_prefs', {
      key: TRADE_ANALYZER_PREFS_KEY,
      provider: provider.trim().toLowerCase() || null,
      model: model?.trim() || null,
    } satisfies TradeAnalyzerPrefsRow);
  } catch {
    // ignore
  }
}

export async function loadTradeAnalyzerHistory(): Promise<TradeAnalyzerHistoryEntry[]> {
  try {
    const db = await openPrefsDb();
    const row = (await db.get('app_prefs', TRADE_ANALYZER_HISTORY_KEY)) as
      | TradeAnalyzerHistoryRow
      | undefined;
    if (row?.entries?.length) {
      return row.entries.slice(0, MAX_TRADE_ANALYZER_HISTORY);
    }
    const legacy = (await db.get('app_prefs', TRADE_ANALYZER_LAST_RESULT_KEY)) as
      | {
          createdAt: number;
          request: TradeAnalyzerRequest;
          response: TradeAnalyzerResponse;
        }
      | undefined;
    if (!legacy?.response) return [];
    const migrated: TradeAnalyzerHistoryEntry = {
      id: `legacy-${legacy.createdAt}`,
      createdAt: legacy.createdAt,
      league_id: legacy.request.league_id,
      additional_context:
        typeof legacy.request.additional_context === 'string'
          ? legacy.request.additional_context
          : undefined,
      request: legacy.request,
      response: legacy.response,
      side_a: {
        roster_id: legacy.request.side_a.roster_id,
        team_name: `Roster ${legacy.request.side_a.roster_id}`,
        team_subtitle: '',
        players: legacy.request.side_a.player_ids.map((id) => ({
          player_id: id,
          name: id,
          ktc_value: 0,
          rank_label: null,
        })),
        picks: legacy.request.side_a.pick_ids.map((pid) => ({
          pick_id: pid,
          label: pid,
          ktc_value: 0,
        })),
        ktc_subtotal: 0,
      },
      side_b: {
        roster_id: legacy.request.side_b.roster_id,
        team_name: `Roster ${legacy.request.side_b.roster_id}`,
        team_subtitle: '',
        players: legacy.request.side_b.player_ids.map((id) => ({
          player_id: id,
          name: id,
          ktc_value: 0,
          rank_label: null,
        })),
        picks: legacy.request.side_b.pick_ids.map((pid) => ({
          pick_id: pid,
          label: pid,
          ktc_value: 0,
        })),
        ktc_subtotal: 0,
      },
    };
    await db.put('app_prefs', {
      key: TRADE_ANALYZER_HISTORY_KEY,
      entries: [migrated],
    } satisfies TradeAnalyzerHistoryRow);
    await db.delete('app_prefs', TRADE_ANALYZER_LAST_RESULT_KEY);
    return [migrated];
  } catch {
    return [];
  }
}

export async function saveTradeAnalyzerHistory(
  entry: TradeAnalyzerHistoryEntry
): Promise<TradeAnalyzerHistoryEntry[]> {
  const existing = await loadTradeAnalyzerHistory();
  const next = [entry, ...existing.filter((e) => e.id !== entry.id)].slice(
    0,
    MAX_TRADE_ANALYZER_HISTORY
  );
  try {
    const db = await openPrefsDb();
    await db.put('app_prefs', {
      key: TRADE_ANALYZER_HISTORY_KEY,
      entries: next,
    } satisfies TradeAnalyzerHistoryRow);
    await db.delete('app_prefs', TRADE_ANALYZER_LAST_RESULT_KEY);
  } catch {
    // ignore
  }
  return next;
}
