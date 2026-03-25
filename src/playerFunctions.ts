import { IDBPDatabase, IDBPTransaction } from 'idb';
import { Player, KTCData, PlayerDBSchema } from './types';
import { API_URLS } from './apiConfig';

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
    ktc?: KTCData & { heightFeet?: number; heightInches?: number; age?: number };
}

const BATCH_SIZE = 500;
const PLAYER_DATA_VERSION = '1.0';
const RELEVANT_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);
/** Exclude only clearly non-rosterable players. */
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
        heightFeet: player.ktc?.heightFeet,
        heightInches: player.ktc?.heightInches,
        weight: player.weight,
        years_exp: player.years_exp,
        college: player.college,
        fantasy_positions: [player.position || ''],
        status: player.status || 'Active',
        injury_status: player.injury_status ?? null,
        number: player.number,
        depth_chart_position: player.depth_chart_position,
        ktc: player.ktc,
    };
}

export function mapBackendPlayersArrayToRecord(
    playersArray: BackendPlayer[]
): Record<string, Player> {
    const playersRecord: Record<string, Player> = {};
    playersArray.forEach((player: BackendPlayer) => {
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

/** Normalizes `data.players` from the dashboard bundle (array or id→row record). */
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

export const fetchPlayers = async (): Promise<Record<string, Player>> => {
    try {
        const response = await fetch(API_URLS.KTC_RANKINGS_SUPERFLEX);
        if (!response.ok) {
            throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
        }

        const apiResponse = await response.json();
        if (!apiResponse?.players || !Array.isArray(apiResponse.players)) {
            throw new Error('Invalid player data format from backend');
        }

        return mapBackendPlayersArrayToRecord(apiResponse.players);
    } catch (err) {
        console.error('Error fetching players:', err);
        throw err;
    }
};

function isValidHeight(height: string): boolean {
    const heightRegex = /^\d+'\d+"$/;
    return heightRegex.test(height);
}

export async function storePlayer(
    tx: IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>,
    player: Player
): Promise<IDBValidKey | undefined> {
    if (!player.player_id) {
        return Promise.resolve(undefined);
    }

    if (player.height && !isValidHeight(player.height)) {
        player.height = undefined;
    }

    const st = (player.status || '').trim().toLowerCase();
    if (st && EXCLUDED_PLAYER_STATUS.has(st)) {
        return Promise.resolve(undefined);
    }
    if (player.position && RELEVANT_POSITIONS.has(player.position)) {
        return tx.store.put(player);
    }

    return Promise.resolve(undefined);
}

export const storePlayers = async (
    db: IDBPDatabase<PlayerDBSchema>,
    playersData: Record<string, Player>
): Promise<void> => {
    try {
        const playerIds = Object.keys(playersData);

        const tx = db.transaction('players', 'readwrite');

        for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
            const batch = playerIds.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(id => {
                    const player = { ...playersData[id] };
                    player.player_id = id;
                    return storePlayer(tx, player);
                })
            );
        }

        await tx.done;

        await db.put('metadata', {
            lastUpdated: Date.now(),
            key: 'lastUpdate',
            version: PLAYER_DATA_VERSION
        });
    } catch (err) {
        console.error('Error storing players:', err);
        throw err;
    }
};

// Deprecated
export const fetchAndStorePlayers = async (
    db: IDBPDatabase<PlayerDBSchema>
): Promise<Record<string, Player>> => {
    try {
        const playersData = await fetchPlayers();
        await storePlayers(db, playersData);

        return playersData;
    } catch (err) {
        console.error('Error in fetchAndStorePlayers:', err);
        throw err;
    }
};
