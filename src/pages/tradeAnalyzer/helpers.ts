import type { Player, ProviderHealth, TeamData, TradeAnalyzerPick } from '../../types';
import { pickAssetKey } from '../../services/tradeAnalyzer';
import { ktcValueForPlayer } from '../../services/tradeAnalyzerStorage';

export function teamDisplayName(team: TeamData): string {
  return team.user.metadata?.team_name || team.user.team_name || team.user.display_name;
}

export function teamSubtitle(team: TeamData): string {
  return team.user.username || team.user.display_name;
}

export function avatarUrl(avatar?: string) {
  return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : null;
}

export type PlayerGroup = { label: string; players: Player[] };

export function groupPlayersByPosition(players: Player[]): PlayerGroup[] {
  const order = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const byPos = new Map<string, Player[]>();
  for (const p of players) {
    const pos = (p.position || 'Other').trim() || 'Other';
    const arr = byPos.get(pos) ?? [];
    arr.push(p);
    byPos.set(pos, arr);
  }
  const sortKtc = (a: Player, b: Player) => ktcValueForPlayer(b) - ktcValueForPlayer(a);
  const groups: PlayerGroup[] = [];
  for (const pos of order) {
    const arr = byPos.get(pos);
    if (!arr || arr.length === 0) continue;
    groups.push({ label: pos, players: [...arr].sort(sortKtc) });
    byPos.delete(pos);
  }
  for (const [pos, arr] of byPos.entries()) {
    groups.push({ label: pos, players: [...arr].sort(sortKtc) });
  }
  return groups;
}

/** Production lock: show all providers but only Gemini is selectable. */
export function isProviderUiDisabled(provider: string, allowsClientChoice: boolean): boolean {
  return !allowsClientChoice && provider.trim().toLowerCase() !== 'gemini';
}

export function providerUiAvailable(p: ProviderHealth, allowsClientChoice: boolean): boolean {
  return p.healthy && !isProviderUiDisabled(p.provider, allowsClientChoice);
}

export function inferAiRoutingFromProviders(
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
      ? models[0]
      : 'Set on the server (this API did not list model names)';
  return { serviceLabel, modelLabel };
}

/** When the API allows client overrides, reflect the dev picker in the header summary. */
export function inferAiRoutingDevChoice(args: {
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

export function pickLabel(p: TradeAnalyzerPick): string {
  const d = (p.descriptor || '').trim();
  return `${p.season} Round ${p.round}${d ? ` (${d})` : ''}`;
}

/** Owned picks for a roster from the dashboard bundle (`picks_by_roster`). */
export function ownedPicksForRoster(
  rosterId: number | null,
  picksByRosterId: Map<number, TradeAnalyzerPick[]>
): TradeAnalyzerPick[] {
  if (rosterId == null) return [];
  return picksByRosterId.get(rosterId) ?? [];
}

/** Picks this roster owns that can still be added to the trade (server pick_id required). */
export function picksAvailableToAdd(
  rosterId: number | null,
  picksByRosterId: Map<number, TradeAnalyzerPick[]>,
  selectedPickKeys: Set<string>
): TradeAnalyzerPick[] {
  return ownedPicksForRoster(rosterId, picksByRosterId).filter((p) => {
    if (!p.pick_id?.trim()) return false;
    if (p.owner_roster_id !== rosterId) return false;
    return !selectedPickKeys.has(pickAssetKey(p));
  });
}

export function tradeAnalyzerSeasonWire(seasonNum: number): string {
  const year = Math.trunc(seasonNum);
  if (Number.isFinite(year) && year >= 1900 && year <= 3000 && `${year}`.length === 4) {
    return `${year}`;
  }
  return String(new Date().getFullYear());
}
