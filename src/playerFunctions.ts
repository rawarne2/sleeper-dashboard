import { IDBPDatabase, IDBPTransaction } from 'idb';
import { Player, KTCData, PlayerDBSchema, PlayerStats } from './types';

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
    ktc?: KTCData & { age?: number };
    stats?: PlayerStats;
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
        number: player.number,
        depth_chart_position: player.depth_chart_position,
        ktc: player.ktc,
        stats: player.stats,
    };
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
