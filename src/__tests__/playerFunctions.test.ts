// src/__tests__/playerFunctions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { openDB, IDBPDatabase, IDBPTransaction } from 'idb';
import { fetchPlayers, storePlayers, storePlayer, fetchAndStorePlayers } from '../playerFunctions';
import { PlayerDBSchema, Player } from '../types';
import 'fake-indexeddb/auto';

// Mock data
const mockPlayers: Record<string, Player> = {
    '123': {
        player_id: '123',
        first_name: 'Patrick',
        last_name: 'Mahomes',
        team: 'KC',
        position: 'QB',
        status: 'Active',
        fantasy_positions: ['QB']
    },
    '456': {
        player_id: '456',
        first_name: 'Travis',
        last_name: 'Kelce',
        team: 'KC',
        position: 'TE',
        status: 'Active',
        fantasy_positions: ['TE']
    },
    '789': {
        player_id: '789',
        first_name: 'Inactive',
        last_name: 'Player',
        team: 'FA',
        position: 'WR',
        status: 'Inactive',
        fantasy_positions: ['WR']
    }
};

describe('Player Functions', () => {
    let fetchSpy: MockInstance;

    // Setup fetch mock
    beforeEach(() => {
        fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchPlayers', () => {
        it('should fetch players successfully', async () => {
            // Mock successful API response
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => mockPlayers
            } as Response);

            const result = await fetchPlayers();

            expect(fetchSpy).toHaveBeenCalledWith('https://api.sleeper.app/v1/players/nfl');
            expect(result).toEqual(mockPlayers);
        });

        it('should throw an error when fetch fails', async () => {
            // Mock failed API response
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            await expect(fetchPlayers()).rejects.toThrow('Failed to fetch players: 500 Internal Server Error');
        });

        it('should throw an error when network fails', async () => {
            // Mock network error
            fetchSpy.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchPlayers()).rejects.toThrow();
        });
    });

    describe('storePlayer', () => {
        it('should set player_id and store active players with relevant positions', async () => {
            // Mock transaction
            const mockPut = vi.fn().mockResolvedValue('mock-key');
            const mockTx = {
                store: {
                    put: mockPut
                }
            } as unknown as IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

            const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
            const player = { ...mockPlayers['123'], player_id: 'old-id' };

            await storePlayer(player, '123', mockTx, relevantPositions);

            // Check that player_id was set
            expect(player.player_id).toBe('123');

            // Check that put was called with the player
            expect(mockPut).toHaveBeenCalledWith(player);
        });

        it('should not store inactive players', async () => {
            // Mock transaction
            const mockPut = vi.fn().mockResolvedValue('mock-key');
            const mockTx = {
                store: {
                    put: mockPut
                }
            } as unknown as IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

            const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
            const player = { ...mockPlayers['789'] }; // Inactive player

            await storePlayer(player, '789', mockTx, relevantPositions);

            // Check that put was not called
            expect(mockPut).not.toHaveBeenCalled();
        });

        it('should not store players with irrelevant positions', async () => {
            // Mock transaction
            const mockPut = vi.fn().mockResolvedValue('mock-key');
            const mockTx = {
                store: {
                    put: mockPut
                }
            } as unknown as IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

            const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
            const player = {
                ...mockPlayers['123'],
                position: 'P' // Punter, not in relevant positions
            };

            await storePlayer(player, '123', mockTx, relevantPositions);

            // Check that put was not called
            expect(mockPut).not.toHaveBeenCalled();
        });

        it('should handle valid height values', async () => {
            // Mock transaction
            const mockPut = vi.fn().mockResolvedValue('mock-key');
            const mockTx = {
                store: {
                    put: mockPut
                }
            } as unknown as IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

            const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
            const player = {
                ...mockPlayers['123'],
                height: '72' // Valid height
            };

            await storePlayer(player, '123', mockTx, relevantPositions);

            // Check that height was preserved
            expect(player.height).toBe('72');
            expect(mockPut).toHaveBeenCalled();
        });

        it('should set invalid height values to undefined', async () => {
            // Mock transaction
            const mockPut = vi.fn().mockResolvedValue('mock-key');
            const mockTx = {
                store: {
                    put: mockPut
                }
            } as unknown as IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

            const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

            // Test with height too low
            const playerLowHeight = {
                ...mockPlayers['123'],
                height: '40' // Too low
            };
            await storePlayer(playerLowHeight, '123', mockTx, relevantPositions);
            expect(playerLowHeight.height).toBeUndefined();

            // Test with height too high
            const playerHighHeight = {
                ...mockPlayers['123'],
                height: '99' // Too high
            };
            await storePlayer(playerHighHeight, '123', mockTx, relevantPositions);
            expect(playerHighHeight.height).toBeUndefined();

            // Test with non-numeric height
            const playerNonNumericHeight = {
                ...mockPlayers['123'],
                height: 'abc' // Not a number
            };
            await storePlayer(playerNonNumericHeight, '123', mockTx, relevantPositions);
            expect(playerNonNumericHeight.height).toBeUndefined();
        });
    });

    describe('storePlayers', () => {
        let db: IDBPDatabase<PlayerDBSchema>;

        beforeEach(async () => {
            // Create a fresh IndexedDB for each test
            db = await openDB<PlayerDBSchema>('test-db', 1, {
                upgrade(db) {
                    db.createObjectStore('players', { keyPath: 'player_id' });
                    db.createObjectStore('metadata', { keyPath: 'key' });
                },
            });
        });

        afterEach(async () => {
            // Close and delete the database after each test
            db.close();
            await deleteDB('test-db');
        });

        it('should store only active players with relevant positions', async () => {
            await storePlayers(db, mockPlayers);

            // Check that only active players were stored
            const player1 = await db.get('players', '123');
            const player2 = await db.get('players', '456');
            const player3 = await db.get('players', '789');

            expect(player1).toBeDefined();
            expect(player2).toBeDefined();
            expect(player3).toBeUndefined(); // Inactive player should not be stored

            expect(player1?.first_name).toBe('Patrick');
            expect(player2?.first_name).toBe('Travis');
        });

        it('should update metadata after storing players', async () => {
            const PLAYER_DATA_VERSION = '1.0'; // Match the constant from the component

            await storePlayers(db, mockPlayers);

            const metadata = await db.get('metadata', 'lastUpdate');

            expect(metadata).toBeDefined();
            expect(metadata?.version).toBe(PLAYER_DATA_VERSION);
            expect(typeof metadata?.lastUpdated).toBe('number');
        });

        it('should handle invalid height values', async () => {
            const playersWithInvalidHeight = {
                ...mockPlayers,
                '123': {
                    ...mockPlayers['123'],
                    height: '999' // Invalid height
                }
            };

            await storePlayers(db, playersWithInvalidHeight);

            const player = await db.get('players', '123');
            expect(player?.height).toBeUndefined();
        });

        it('should process players in batches', async () => {
            // Create a large number of mock players
            const largeMockPlayers: Record<string, Player> = {};
            for (let i = 0; i < 1000; i++) {
                largeMockPlayers[`player${i}`] = {
                    player_id: `player${i}`,
                    first_name: `First${i}`,
                    last_name: `Last${i}`,
                    team: 'TEAM',
                    position: 'QB',
                    status: 'Active',
                    fantasy_positions: ['QB']
                };
            }

            // Store the players
            await storePlayers(db, largeMockPlayers);

            // Verify players were stored by counting them
            const allStoredPlayers = await db.getAll('players');
            expect(allStoredPlayers.length).toBe(1000); // All 1000 players should be stored
        });

        it('should handle empty players object', async () => {
            await storePlayers(db, {});

            const allStoredPlayers = await db.getAll('players');
            expect(allStoredPlayers.length).toBe(0);

            // Metadata should still be updated
            const metadata = await db.get('metadata', 'lastUpdate');
            expect(metadata).toBeDefined();
        });

        it('should throw error when database operation fails', async () => {
            // Close the database to cause an error
            db.close();

            await expect(storePlayers(db, mockPlayers)).rejects.toThrow();
        });
    });

    describe('storePlayer - additional edge cases', () => {
        it('should handle player with no height property', async () => {
            const mockPut = vi.fn().mockResolvedValue('mock-key');
            const mockTx = {
                store: {
                    put: mockPut
                }
            } as unknown as IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

            const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
            const player = {
                ...mockPlayers['123']
                // No height property
            };
            delete player.height;

            await storePlayer(player, '123', mockTx, relevantPositions);

            expect(player.height).toBeUndefined();
            expect(mockPut).toHaveBeenCalled();
        });

        it('should handle boundary height values', async () => {
            const mockPut = vi.fn().mockResolvedValue('mock-key');
            const mockTx = {
                store: {
                    put: mockPut
                }
            } as unknown as IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

            const relevantPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

            // Test minimum valid height
            const playerMinHeight = {
                ...mockPlayers['123'],
                height: '51' // Minimum valid
            };
            await storePlayer(playerMinHeight, '123', mockTx, relevantPositions);
            expect(playerMinHeight.height).toBe('51');

            // Test maximum valid height
            const playerMaxHeight = {
                ...mockPlayers['123'],
                height: '98' // Maximum valid
            };
            await storePlayer(playerMaxHeight, '123', mockTx, relevantPositions);
            expect(playerMaxHeight.height).toBe('98');
        });
    });

    describe('fetchAndStorePlayers', () => {
        let db: IDBPDatabase<PlayerDBSchema>;

        beforeEach(async () => {
            // Create a fresh IndexedDB for each test
            db = await openDB<PlayerDBSchema>('test-db', 1, {
                upgrade(db) {
                    db.createObjectStore('players', { keyPath: 'player_id' });
                    db.createObjectStore('metadata', { keyPath: 'key' });
                },
            });
        });

        afterEach(async () => {
            // Close and delete the database after each test
            db.close();
            await deleteDB('test-db');
        });

        it('should successfully fetch and store players', async () => {
            // Mock successful API response
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => mockPlayers
            } as Response);

            const result = await fetchAndStorePlayers(db);

            // Should return the fetched data
            expect(result).toEqual(mockPlayers);

            // Should have stored players in database
            const storedPlayer1 = await db.get('players', '123');
            const storedPlayer2 = await db.get('players', '456');
            expect(storedPlayer1).toBeDefined();
            expect(storedPlayer2).toBeDefined();

            // Should have updated metadata
            const metadata = await db.get('metadata', 'lastUpdate');
            expect(metadata).toBeDefined();
        });

        it('should throw error when fetchPlayers fails', async () => {
            // Mock failed API response
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            await expect(fetchAndStorePlayers(db)).rejects.toThrow('Failed to fetch players: 500 Internal Server Error');

            // Should not have stored any players
            const allStoredPlayers = await db.getAll('players');
            expect(allStoredPlayers.length).toBe(0);
        });

        it('should throw error when storePlayers fails', async () => {
            // Mock successful fetch
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => mockPlayers
            } as Response);

            // Close database to cause storage error
            db.close();

            await expect(fetchAndStorePlayers(db)).rejects.toThrow();
        });

        it('should handle network errors during fetch', async () => {
            // Mock network error
            fetchSpy.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchAndStorePlayers(db)).rejects.toThrow('Network error');
        });
    });
});

// Helper function to delete IndexedDB database
async function deleteDB(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}