// src/playerFunctions.ts
import { IDBPDatabase, IDBPTransaction } from 'idb';
import { Player, PlayerDBSchema } from './types';
import { API_URLS } from './apiConfig';

// Type for backend KTC player response (matching new backend structure)
interface BackendPlayer {
    // Core identifiers
    sleeper_player_id?: string;
    playerName?: string;

    // Team and position info
    team?: string;
    position?: string;

    // Physical attributes (from Sleeper)
    age?: number;
    birth_date?: string;
    height?: string; // Legacy field
    heightFeet?: number;
    heightInches?: number;
    weight?: string;
    college?: string;
    years_exp?: number;
    number?: number;
    depth_chart_position?: number;

    // Status information
    status?: string;
    injury_status?: string | null;

    // KTC ranking data (structured)
    ktc?: {
        oneQBValues?: {
            value?: number;
            rank?: number;
            positionalRank?: number;
            overallTier?: number;
            positionalTier?: number;
        } | null;
        superflexValues?: {
            value?: number;
            rank?: number;
            positionalRank?: number;
            overallTier?: number;
            positionalTier?: number;
        } | null;
    };
}

// Constants
const BATCH_SIZE = 500;
const PLAYER_DATA_VERSION = '1.0'; // Version for cache invalidation
const RELEVANT_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']); // removed 'DEF' for my league

// Fetch players from backend API (KTC rankings with merged Sleeper data)
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

        const playersArray = apiResponse.players;

        // Convert array to record format and map field names
        const playersRecord: Record<string, Player> = {};
        playersArray.forEach((player: BackendPlayer) => {
            try {
                if (player.sleeper_player_id && player.playerName) {
                    playersRecord[player.sleeper_player_id] = {
                        player_id: player.sleeper_player_id,
                        sleeper_player_id: player.sleeper_player_id,
                        playerName: player.playerName,
                        first_name: player.playerName?.split(' ')[0] || '',
                        last_name: player.playerName?.split(' ').slice(1).join(' ') || '',
                        team: player.team || '',
                        position: player.position || '',
                        age: player.age,
                        birth_date: player.birth_date,
                        height: player.height,
                        heightFeet: player.heightFeet,
                        heightInches: player.heightInches,
                        weight: player.weight,
                        years_exp: player.years_exp,
                        college: player.college,
                        fantasy_positions: [player.position || ''], // Simple conversion for now
                        status: player.status || 'Active',
                        injury_status: player.injury_status || null,
                        number: player.number,
                        depth_chart_position: player.depth_chart_position,
                        ktc: player.ktc
                    };
                }
            } catch (e) {
                console.error(`Error processing player with sleeper_player_id: ${player.sleeper_player_id}`, e);
            }
        });

        return playersRecord;
    } catch (err) {
        console.error('Error fetching players:', err);
        throw err;
    }
};

// Helper function to validate height
function isValidHeight(height: string): boolean {
    // Check if height matches pattern like "6'2"" or "5'11""
    const heightRegex = /^\d+'\d+"$/;
    return heightRegex.test(height);
}

// Store a single player in IndexedDB
export async function storePlayer(
    tx: IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>,
    player: Player
): Promise<IDBValidKey | undefined> {
    // Ensure player has player_id set
    if (!player.player_id) {
        return Promise.resolve(undefined);
    }

    // Parse and validate height
    if (player.height && !isValidHeight(player.height)) {
        player.height = undefined;
    }

    // Store only active players with relevant positions
    if (player.status === 'Active' && player.position && RELEVANT_POSITIONS.has(player.position)) {
        return tx.store.put(player);
    }

    return Promise.resolve(undefined);
}

// Store players in IndexedDB
export const storePlayers = async (
    db: IDBPDatabase<PlayerDBSchema>,
    playersData: Record<string, Player>
): Promise<void> => {
    try {
        // Process players in batches to not block the main thread
        const playerIds = Object.keys(playersData);

        const tx = db.transaction('players', 'readwrite');

        for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
            const batch = playerIds.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(id => {
                    const player = { ...playersData[id] };
                    player.player_id = id; // Ensure player_id is set
                    return storePlayer(tx, player);
                })
            );
        }

        await tx.done;

        // Update metadata with version
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

// Fetch and store players (simplified since backend handles persistence)
export const fetchAndStorePlayers = async (
    db: IDBPDatabase<PlayerDBSchema>
): Promise<Record<string, Player>> => {
    try {
        // Fetch players from backend API (already includes KTC + Sleeper merged data)
        const playersData = await fetchPlayers();

        // Only store minimal data in IndexedDB for caching since backend handles persistence
        await storePlayers(db, playersData);

        return playersData;
    } catch (err) {
        console.error('Error in fetchAndStorePlayers:', err);
        throw err;
    }
};
