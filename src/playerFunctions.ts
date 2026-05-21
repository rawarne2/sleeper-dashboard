import { IDBPDatabase, IDBPTransaction } from 'idb';
import {
    KTCData,
    KTCValues,
    Player,
    PlayerDBSchema,
    PlayerStats,
    ResearchLatest,
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
    depth_chart_position?: number;
    status?: string;
    injury_status?: string | null;
    injury_body_part?: string | null;
    injury_notes?: string | null;
    injury_start_date?: string | null;
    practice_participation?: string | null;
    practice_description?: string | null;
    ktc?: KTCData & { age?: number };
    stats?: PlayerStats;
    research_latest?: ResearchLatest | null;
}

const RELEVANT_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);
const EXCLUDED_PLAYER_STATUS = new Set(['retired']);

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
        fantasy_positions: [player.position || ''],
        status: player.status || 'Active',
        injury_status: player.injury_status ?? null,
        injury_body_part: player.injury_body_part ?? null,
        injury_notes: player.injury_notes ?? null,
        injury_start_date: player.injury_start_date ?? null,
        practice_participation: player.practice_participation ?? null,
        practice_description: player.practice_description ?? null,
        number: player.number,
        depth_chart_position: player.depth_chart_position,
        ktc: player.ktc,
        stats: player.stats,
        research_latest: player.research_latest ?? null,
    };
}

/** TEP-hoisted KTC values for the dashboard row (value, rank, tiers). */
export function ktcDisplayValues(player: Player): KTCValues | null {
    return player.ktc?.superflexValues ?? player.ktc?.oneQBValues ?? null;
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

export async function storePlayer(
    tx: IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>,
    player: Player
): Promise<IDBValidKey | undefined> {
    if (!player.player_id) {
        return undefined;
    }
    const st = (player.status || '').trim().toLowerCase();
    if (st && EXCLUDED_PLAYER_STATUS.has(st)) {
        return undefined;
    }
    if (player.position && RELEVANT_POSITIONS.has(player.position)) {
        return tx.store.put(player);
    }
    return undefined;
}

export const storePlayers = async (
    db: IDBPDatabase<PlayerDBSchema>,
    playersData: Record<string, Player>
): Promise<void> => {
    try {
        const playerIds = Object.keys(playersData);

        const tx = db.transaction('players', 'readwrite');
        await Promise.all(
            playerIds.map((id) => {
                const player = { ...playersData[id] };
                player.player_id = id;
                return storePlayer(tx, player);
            })
        );
        await tx.done;

        await db.put('metadata', {
            lastUpdated: Date.now(),
            key: 'lastUpdate',
        });
    } catch (err) {
        console.error('Error storing players:', err);
        throw err;
    }
};
