// src/playerFunctions.ts
import { IDBPDatabase, IDBPTransaction } from 'idb';
import { Player, PlayerDBSchema } from './types';

// Constants
const BATCH_SIZE = 500;
const PLAYER_DATA_VERSION = '1.0'; // Version for cache invalidation

// Fetch players from API
export const fetchPlayers = async (): Promise<Record<string, Player>> => {
    try {
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!response.ok) {
            throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
        }

        const data: Record<string, Player> = await response.json();
        return data;
    } catch (err) {
        console.error('Error fetching players:', err);
        throw err;
    }
};

// Store a single player in IndexedDB
export function storePlayer(
    player: Player,
    playerId: string,
    tx: IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>,
    relevantPositions: Set<string>
): Promise<IDBValidKey | undefined> {
    // Set player_id to the passed playerId
    player.player_id = playerId;

    // Parse and validate height
    if (player.height) {
        const height = parseInt(player.height, 10);
        const isHeightValid = !isNaN(height) && height >= 51 && height <= 98;

        if (!isHeightValid) {
            player.height = undefined;
        }
    }

    // Store only active players with relevant positions
    if (player.status === 'Active' && relevantPositions.has(player.position)) {
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
        // Relevant positions for fantasy football
        const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K']); // removed 'DEF' for my league

        // Process players in batches to not block the main thread
        const playerIds = Object.keys(playersData);

        const tx = db.transaction('players', 'readwrite');

        for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
            const batch = playerIds.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(id => storePlayer(playersData[id], id, tx, relevantPositions))
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

// Fetch and store players (combined operation)
export const fetchAndStorePlayers = async (
    db: IDBPDatabase<PlayerDBSchema>
): Promise<Record<string, Player>> => {
    try {
        // Fetch players from API
        const playersData = await fetchPlayers();

        // Store players in IndexedDB
        await storePlayers(db, playersData);

        return playersData;
    } catch (err) {
        console.error('Error in fetchAndStorePlayers:', err);
        throw err;
    }
};