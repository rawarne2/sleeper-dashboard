import {
    KTCData,
    KTCValues,
    Player,
    PlayerStats,
    ResearchLatest,
    ValuesBlock,
} from './types';

interface BackendPlayer {
    sleeper_player_id?: string;
    playerName?: string;
    team?: string;
    position?: string;
    age?: number;
    birth_date?: string;
    height?: string;
    weight?: string;
    college?: string;
    years_exp?: number;
    number?: number;
    depth_chart_position?: string | null;
    depth_chart_order?: number;
    fantasy_positions?: string[];
    birth_city?: string;
    birth_state?: string;
    high_school?: string;
    news_updated?: number;
    status?: string;
    injury_status?: string | null;
    injury_body_part?: string | null;
    injury_notes?: string | null;
    injury_start_date?: string | null;
    practice_participation?: string | null;
    practice_description?: string | null;
    weekly_injury_status?: string | null;
    ktc?: KTCData & { age?: number };
    stats?: PlayerStats;
    research_latest?: ResearchLatest | null;
}

export function mapBackendPlayerRow(player: BackendPlayer): Player | null {
    if (!player.sleeper_player_id || !player.playerName) {
        return null;
    }
    return {
        player_id: player.sleeper_player_id,
        sleeper_player_id: player.sleeper_player_id,
        playerName: player.playerName,
        first_name: player.playerName?.split(' ')[0] || '',
        last_name: player.playerName?.split(' ').slice(1).join(' ') || '',
        team: player.team || '',
        position: player.position || '',
        age: player.ktc?.age,
        birth_date: player.birth_date,
        height: player.height,
        weight: player.weight,
        years_exp: player.years_exp,
        college: player.college,
        fantasy_positions:
            player.fantasy_positions && player.fantasy_positions.length > 0
                ? player.fantasy_positions
                : player.position
                  ? [player.position]
                  : [],
        birth_city: player.birth_city,
        birth_state: player.birth_state,
        high_school: player.high_school,
        news_updated: player.news_updated,
        status: player.status || 'Active',
        injury_status: player.injury_status ?? null,
        injury_body_part: player.injury_body_part ?? null,
        injury_notes: player.injury_notes ?? null,
        injury_start_date: player.injury_start_date ?? null,
        practice_participation: player.practice_participation ?? null,
        practice_description: player.practice_description ?? null,
        weekly_injury_status: player.weekly_injury_status ?? null,
        number: player.number,
        depth_chart_position: player.depth_chart_position ?? null,
        depth_chart_order: player.depth_chart_order,
        ktc: player.ktc,
        values: (player as { values?: ValuesBlock }).values ?? null,
        stats: player.stats,
        research_latest: player.research_latest ?? null,
    };
}

/** TEP-hoisted KTC values for the dashboard row (value, rank, tiers). */
export function ktcDisplayValues(player: Player): KTCValues | null {
    return player.ktc?.superflexValues ?? player.ktc?.oneQBValues ?? null;
}

/**
 * Resolve a player's ownership by precedence: direct `owned`, then the league
 * ownership map, then the latest research snapshot. Single source of truth for
 * the roster table, All Players grid, and the player detail panel.
 */
export function resolveOwnership(
    player: Player,
    ownershipMap: Record<string, { owned: number; started?: number | null }>
): { owned: number; started: number | null } | null {
    if (player.owned != null) {
        return { owned: player.owned, started: player.started ?? null };
    }
    const id = player.player_id;
    if (id && ownershipMap[id]) {
        const o = ownershipMap[id];
        return { owned: o.owned, started: o.started ?? null };
    }
    const rl = player.research_latest;
    if (rl?.owned != null) {
        return { owned: rl.owned, started: rl.started ?? null };
    }
    return null;
}

/** Display name by precedence: `playerName`, then `first_name last_name`, else a fallback. */
export function playerDisplayName(player: Player): string {
    return (
        player.playerName?.trim() ||
        [player.first_name, player.last_name].filter(Boolean).join(' ').trim() ||
        'Unknown player'
    );
}

/**
 * Positional rank (e.g. "WR5"), else overall ("#42"), from the backend-resolved
 * KTC block. The backend already applies league format + TEP + redraft, so this
 * reads the hoisted top-level values rather than re-selecting nested blocks.
 */
export function ktcRankLabel(player: Player): string | null {
    const v = ktcDisplayValues(player);
    const pos = (player.position || '').trim().toUpperCase();
    if (pos && typeof v?.positionalRank === 'number' && Number.isFinite(v.positionalRank)) {
        return `${pos}${v.positionalRank}`;
    }
    if (typeof v?.rank === 'number' && Number.isFinite(v.rank)) {
        return `#${v.rank}`;
    }
    return null;
}

const SOURCE_LABELS: Record<string, string> = {
  ktc: 'KTC',
  fantasycalc: 'FC',
};

export function blendedValue(player: Player): number | null {
  return player.values?.blended ?? null;
}

export interface SourceChipData { key: string; label: string; value: number | null; }

export function valueSources(player: Player): SourceChipData[] {
  const sources = player.values?.sources ?? {};
  return Object.entries(sources).map(([key, v]) => ({
    key,
    label: SOURCE_LABELS[key] ?? key,
    value: v?.value ?? null,
  }));
}

const KTC_INJURY_DETAIL_KEYS = [
    'injuryName',
    'injuryArea',
    'injuryReturn',
    'injuryNotes',
    'summary',
] as const;

const KTC_INJURY_CODE_LABELS: Record<number, string> = {
    1: 'Healthy',
    2: 'Questionable',
    7: 'Holdout',
};

function parseKtcInjuryObject(injury: unknown): Record<string, unknown> | null {
    if (injury == null) return null;
    if (typeof injury === 'string') {
        const trimmed = injury.trim();
        if (!trimmed) return null;
        try {
            const parsed: unknown = JSON.parse(trimmed);
            return typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : null;
        } catch {
            return { injuryName: trimmed };
        }
    }
    if (typeof injury === 'object' && !Array.isArray(injury)) {
        return injury as Record<string, unknown>;
    }
    return null;
}

function isMeaningfulKtcInjury(obj: Record<string, unknown>): boolean {
    if (KTC_INJURY_DETAIL_KEYS.some((key) => {
        const value = obj[key];
        return value != null && String(value).trim() !== '';
    })) {
        return true;
    }
    const code = obj.injuryCode ?? obj.code ?? obj.status;
    if (typeof code === 'number') return code !== 1;
    if (typeof code === 'string') {
        const trimmed = code.trim();
        if (!trimmed) return false;
        const asNum = Number(trimmed);
        if (!Number.isNaN(asNum)) return asNum !== 1;
        return trimmed !== '1';
    }
    return false;
}

function formatKtcInjuryFromObject(obj: Record<string, unknown>): string | null {
    if (!isMeaningfulKtcInjury(obj)) return null;

    const name = obj.injuryName ?? obj.injury_name;
    if (typeof name === 'string' && name.trim()) {
        const parts = [name.trim()];
        const area = obj.injuryArea ?? obj.injury_area;
        if (typeof area === 'string' && area.trim()) parts.push(area.trim());
        const injuryReturn = obj.injuryReturn ?? obj.injury_return;
        if (typeof injuryReturn === 'string' && injuryReturn.trim()) {
            parts.push(`Return ${injuryReturn.trim()}`);
        }
        const notes = obj.injuryNotes ?? obj.injury_notes ?? obj.summary;
        if (typeof notes === 'string' && notes.trim()) parts.push(notes.trim());
        return parts.join(' · ');
    }

    const code = obj.injuryCode ?? obj.code ?? obj.status;
    if (typeof code === 'string' && code.trim()) {
        const summary = obj.summary;
        if (typeof summary === 'string' && summary.trim()) {
            return `${code.trim()} — ${summary.trim()}`;
        }
        return code.trim();
    }

    const numericCode =
        typeof code === 'number' ? code : Number(String(code ?? '').trim());
    if (!Number.isNaN(numericCode)) {
        const label = KTC_INJURY_CODE_LABELS[numericCode];
        if (label && numericCode !== 1) return label;
    }

    return null;
}

/** Human-readable KTC injury line for the expand panel (omits healthy-only blobs). */
export function formatKtcInjury(injury: unknown): string | null {
    const obj = parseKtcInjuryObject(injury);
    if (!obj) return injury == null ? null : String(injury);
    return formatKtcInjuryFromObject(obj);
}

export interface InjuryDisplay {
    /** Stored source that supplied the line (primary → tertiary precedence). */
    source: 'sleeper' | 'ktc' | 'weekly';
    text: string;
    severity: 'danger' | 'warn';
}

/** Sleeper-native injury line from status/body part/notes/practice. */
function sleeperInjuryLine(player: Player): string | null {
    const parts: string[] = [];
    if (player.injury_status) {
        parts.push(
            player.injury_body_part
                ? `${player.injury_status} — ${player.injury_body_part}`
                : player.injury_status
        );
    }
    if (player.practice_participation) {
        parts.push(
            player.practice_description
                ? `${player.practice_participation} — ${player.practice_description}`
                : player.practice_participation
        );
    }
    if (player.injury_notes) parts.push(player.injury_notes);
    return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Resolves one injury line by source precedence — primary Sleeper, then KTC's
 * injury blob, then weekly injury status. Display only; all sources stay stored.
 * Returns null when no source reports an active injury.
 */
export function resolveInjury(player: Player): InjuryDisplay | null {
    const sleeper = sleeperInjuryLine(player);
    if (sleeper) {
        return {
            source: 'sleeper',
            text: sleeper,
            severity: player.injury_status ? 'danger' : 'warn',
        };
    }
    const ktc = formatKtcInjury(player.ktc?.injury);
    if (ktc) return { source: 'ktc', text: ktc, severity: 'warn' };
    if (player.weekly_injury_status) {
        return { source: 'weekly', text: player.weekly_injury_status, severity: 'warn' };
    }
    return null;
}

export interface InjuryBadge {
    /** Short status code shown inline in the table row, e.g. "Q", "OUT", "IR". */
    code: string;
    /** Visual severity: danger = out for the game, warn = game-time decision. */
    tone: 'danger' | 'warn';
    /** Tooltip with the full status + source. */
    title: string;
}

const INJURY_CODES: ReadonlyArray<readonly [RegExp, string]> = [
    [/injured reserve|^ir\b/i, 'IR'],
    [/\bout\b|^o\b/i, 'OUT'],
    [/pup/i, 'PUP'],
    [/susp/i, 'SUS'],
    [/doubt|^d\b/i, 'D'],
    [/quest|^q\b/i, 'Q'],
];

const INJURY_DANGER = new Set(['OUT', 'IR', 'PUP', 'SUS']);

function injuryCode(status: string): string {
    for (const [re, code] of INJURY_CODES) if (re.test(status)) return code;
    return 'INJ';
}

/** Compact injury indicator for a table row — a short code + severity tone, or null when healthy. */
export function injuryBadge(player: Player): InjuryBadge | null {
    const injury = resolveInjury(player);
    if (!injury) return null;
    const status = (player.injury_status || player.weekly_injury_status || injury.text || '').trim();
    if (!status) return null;
    const code = injuryCode(status);
    return {
        code,
        tone: INJURY_DANGER.has(code) ? 'danger' : 'warn',
        title: `Injury · ${injury.source}: ${injury.text}`,
    };
}

/** Only show bye week when viewing the current bundle season. */
export function showByeForSeason(
    bundleSeason: string | null | undefined,
    leagueSeason: string | null | undefined
): boolean {
    if (!bundleSeason) return false;
    return bundleSeason === (leagueSeason ?? bundleSeason);
}

export function mapBackendPlayersArrayToRecord(
    playersArray: BackendPlayer[]
): Record<string, Player> {
    const playersRecord: Record<string, Player> = {};
    playersArray.forEach((player) => {
        try {
            const mapped = mapBackendPlayerRow(player);
            if (mapped?.player_id) {
                playersRecord[mapped.player_id] = mapped;
            }
        } catch (e) {
            console.error(
                `Error processing player with sleeper_player_id: ${player.sleeper_player_id}`,
                e
            );
        }
    });
    return playersRecord;
}

/** Normalizes `data.players` from the dashboard bundle (array or id-keyed record). */
export function playersFromDashboardBundle(raw: unknown): Record<string, Player> {
    if (raw == null) {
        return {};
    }
    if (Array.isArray(raw)) {
        return mapBackendPlayersArrayToRecord(raw as BackendPlayer[]);
    }
    if (typeof raw === 'object') {
        return mapBackendPlayersArrayToRecord(
            Object.values(raw as Record<string, BackendPlayer>)
        );
    }
    return {};
}

