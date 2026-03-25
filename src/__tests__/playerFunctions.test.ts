import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { openDB, IDBPDatabase, IDBPTransaction } from 'idb';
import { API_URLS } from '../apiConfig';
import { fetchPlayers, storePlayers, storePlayer, fetchAndStorePlayers } from '../playerFunctions';
import { PlayerDBSchema, Player } from '../types';
import 'fake-indexeddb/auto';

const mockBackendPlayers = [
    {
        sleeper_player_id: '123',
        playerName: 'Patrick Mahomes',
        team: 'KC',
        position: 'QB',
        ktc: { age: 28 },
        height: '6\'3"',
        weight: '230',
        years_exp: 7,
        college: 'Texas Tech',
        injury_status: null,
        number: 15,
        depth_chart_position: 1,
        status: 'Active'
    },
    {
        sleeper_player_id: '456',
        playerName: 'Travis Kelce',
        team: 'KC',
        position: 'TE',
        ktc: { age: 34 },
        height: '6\'5"',
        weight: '260',
        years_exp: 12,
        college: 'Cincinnati',
        injury_status: null,
        number: 87,
        depth_chart_position: 1,
        status: 'Active'
    }
];

const mockPlayers: Record<string, Player> = {
    '123': {
        player_id: '123',
        sleeper_player_id: '123',
        playerName: 'Patrick Mahomes',
        first_name: 'Patrick',
        last_name: 'Mahomes',
        team: 'KC',
        position: 'QB',
        age: 28,
        height: '6\'3"',
        weight: '230',
        years_exp: 7,
        college: 'Texas Tech',
        fantasy_positions: ['QB'],
        status: 'Active',
        injury_status: null,
        number: 15,
        depth_chart_position: 1,
        ktc: { age: 28 }
    },
    '456': {
        player_id: '456',
        sleeper_player_id: '456',
        playerName: 'Travis Kelce',
        first_name: 'Travis',
        last_name: 'Kelce',
        team: 'KC',
        position: 'TE',
        age: 34,
        height: '6\'5"',
        weight: '260',
        years_exp: 12,
        college: 'Cincinnati',
        fantasy_positions: ['TE'],
        status: 'Active',
        injury_status: null,
        number: 87,
        depth_chart_position: 1,
        ktc: { age: 34 }
    }
};

describe('Player Functions', () => {
    let fetchSpy: MockInstance;

    beforeEach(() => {
        fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchPlayers', () => {
        it('should fetch players successfully', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ players: mockBackendPlayers })
            } as Response);

            const result = await fetchPlayers();

            expect(fetchSpy).toHaveBeenCalledWith(API_URLS.KTC_RANKINGS_SUPERFLEX);
            expect(result).toEqual(mockPlayers);
        });

        it('should handle players with missing optional fields', async () => {
            const backendPlayersWithMissingFields = [
                {
                    sleeper_player_id: '999',
                    playerName: 'Rookie Player',
                    team: 'NYJ',
                    position: 'WR',
                    ktc: { age: 22 },
                    status: 'Active'
                }
            ];

            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ players: backendPlayersWithMissingFields })
            } as Response);

            const result = await fetchPlayers();
            const player = result['999'];

            expect(player).toEqual({
                player_id: '999',
                sleeper_player_id: '999',
                playerName: 'Rookie Player',
                first_name: 'Rookie',
                last_name: 'Player',
                team: 'NYJ',
                position: 'WR',
                age: 22,
                height: undefined,
                weight: undefined,
                years_exp: undefined,
                college: undefined,
                fantasy_positions: ['WR'],
                status: 'Active',
                injury_status: null,
                number: undefined,
                depth_chart_position: undefined,
                ktc: { age: 22 }
            });
        });

        it('should handle complex player names correctly', async () => {
            const complexNamePlayers = [
                {
                    sleeper_player_id: '777',
                    playerName: 'D\'Andre Swift Jr.',
                    team: 'CHI',
                    position: 'RB',
                    ktc: { age: 25 },
                    status: 'Active'
                },
                {
                    sleeper_player_id: '888',
                    playerName: 'Saquon',
                    team: 'PHI',
                    position: 'RB',
                    ktc: { age: 27 },
                    status: 'Active'
                }
            ];

            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ players: complexNamePlayers })
            } as Response);

            const result = await fetchPlayers();

            expect(result['777'].first_name).toBe('D\'Andre');
            expect(result['777'].last_name).toBe('Swift Jr.');

            expect(result['888'].first_name).toBe('Saquon');
            expect(result['888'].last_name).toBe('');
        });

        it('should handle invalid or missing player data gracefully', async () => {
            const invalidPlayers = [
                {
                    sleeper_player_id: '123',
                    playerName: 'Valid Player',
                    team: 'KC',
                    position: 'QB',
                    ktc: { age: 28 },
                    status: 'Active'
                },
                { playerName: 'Invalid Player', team: 'NYJ', position: 'WR', status: 'Active' },
                { sleeper_player_id: '456', team: 'BUF', position: 'RB', status: 'Active' }
            ];

            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ players: invalidPlayers })
            } as Response);

            const result = await fetchPlayers();

            expect(Object.keys(result)).toEqual(['123']);
            expect(result['123'].first_name).toBe('Valid');
            expect(result['123'].last_name).toBe('Player');
            expect(result['123'].playerName).toBe('Valid Player');
        });

        it('should throw an error when fetch fails', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            await expect(fetchPlayers()).rejects.toThrow('Failed to fetch players: 500 Internal Server Error');
        });

        it('should throw an error when response format is invalid', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: 'wrong format' })
            } as Response);

            await expect(fetchPlayers()).rejects.toThrow('Invalid player data format from backend');
        });

        it('should throw an error when network fails', async () => {
            fetchSpy.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchPlayers()).rejects.toThrow();
        });
    });

    describe('storePlayer', () => {
        let db: IDBPDatabase<PlayerDBSchema>;
        let tx: IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

        beforeEach(async () => {

            const dbName = `test-db-storePlayer-${Date.now()}-${Math.random()}`;
            db = await openDB<PlayerDBSchema>(dbName, 1, {
                upgrade(db) {
                    db.createObjectStore('players', { keyPath: 'player_id' });
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    db.createObjectStore('ownership', { keyPath: 'player_id' });
                },
            });
            tx = db.transaction('players', 'readwrite');
        });

        afterEach(async () => {
            db.close();
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        it('should set player_id and store active players with relevant positions', async () => {
            const player: Player = {
                player_id: '123',
                first_name: 'Test',
                last_name: 'Player',
                team: 'KC',
                position: 'QB',
                status: 'Active',
                fantasy_positions: ['QB'],
                height: '6\'2"'
            };

            await storePlayer(tx, player);
            await tx.done;

            const storedPlayer = await db.get('players', '123');
            expect(storedPlayer).toBeDefined();
            expect(storedPlayer?.player_id).toBe('123');
            expect(storedPlayer?.height).toBe('6\'2"');
        });

        it('should store Inactive players (IR / rostered) but skip retired', async () => {
            const ir: Player = {
                player_id: '999',
                first_name: 'Inactive',
                last_name: 'Player',
                team: 'FA',
                position: 'WR',
                status: 'Inactive',
                fantasy_positions: ['WR']
            };
            const retired: Player = {
                player_id: '998',
                first_name: 'Old',
                last_name: 'Timer',
                team: 'FA',
                position: 'WR',
                status: 'Retired',
                fantasy_positions: ['WR']
            };

            await storePlayer(tx, ir);
            await storePlayer(tx, retired);
            await tx.done;

            expect(await db.get('players', '999')).toBeDefined();
            expect(await db.get('players', '998')).toBeUndefined();
        });

        it('should not store players with irrelevant positions', async () => {
            const player: Player = {
                player_id: '555',
                first_name: 'Defense',
                last_name: 'Player',
                team: 'KC',
                position: 'DEF',
                status: 'Active',
                fantasy_positions: ['DEF']
            };

            await storePlayer(tx, player);
            await tx.done;

            const storedPlayer = await db.get('players', '555');
            expect(storedPlayer).toBeUndefined();
        });

        it('should handle valid height values', async () => {
            const player: Player = {
                player_id: '777',
                first_name: 'Tall',
                last_name: 'Player',
                team: 'KC',
                position: 'QB',
                status: 'Active',
                fantasy_positions: ['QB'],
                height: '6\'4"'
            };

            await storePlayer(tx, player);
            await tx.done;

            const storedPlayer = await db.get('players', '777');
            expect(storedPlayer?.height).toBe('6\'4"');
        });

        it('should set invalid height values to undefined', async () => {
            const player: Player = {
                player_id: '888',
                first_name: 'Invalid',
                last_name: 'Height',
                team: 'KC',
                position: 'QB',
                status: 'Active',
                fantasy_positions: ['QB'],
                height: 'invalid'
            };

            await storePlayer(tx, player);
            await tx.done;

            const storedPlayer = await db.get('players', '888');
            expect(storedPlayer?.height).toBeUndefined();
        });
    });

    describe('storePlayers', () => {
        let db: IDBPDatabase<PlayerDBSchema>;

        beforeEach(async () => {

            const dbName = `test-db-storePlayers-${Date.now()}-${Math.random()}`;
            db = await openDB<PlayerDBSchema>(dbName, 1, {
                upgrade(db) {
                    db.createObjectStore('players', { keyPath: 'player_id' });
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    db.createObjectStore('ownership', { keyPath: 'player_id' });
                },
            });
        });

        afterEach(async () => {
            db.close();
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        it('should store skill positions and exclude DEF and retired', async () => {
            const players: Record<string, Player> = {
                '123': {
                    player_id: '123',
                    first_name: 'Active',
                    last_name: 'QB',
                    team: 'KC',
                    position: 'QB',
                    status: 'Active',
                    fantasy_positions: ['QB']
                },
                '456': {
                    player_id: '456',
                    first_name: 'Inactive',
                    last_name: 'Player',
                    team: 'FA',
                    position: 'WR',
                    status: 'Inactive',
                    fantasy_positions: ['WR']
                },
                '789': {
                    player_id: '789',
                    first_name: 'Defense',
                    last_name: 'Player',
                    team: 'KC',
                    position: 'DEF',
                    status: 'Active',
                    fantasy_positions: ['DEF']
                },
                '111': {
                    player_id: '111',
                    first_name: 'Done',
                    last_name: 'Player',
                    team: 'FA',
                    position: 'RB',
                    status: 'Retired',
                    fantasy_positions: ['RB']
                }
            };

            await storePlayers(db, players);

            const storedPlayer1 = await db.get('players', '123');
            const storedPlayer2 = await db.get('players', '456');
            const storedPlayer3 = await db.get('players', '789');
            const storedPlayer4 = await db.get('players', '111');

            expect(storedPlayer1).toBeDefined();
            expect(storedPlayer2).toBeDefined();
            expect(storedPlayer3).toBeUndefined(); // Defense
            expect(storedPlayer4).toBeUndefined(); // Retired
        });

        it('should update metadata after storing players', async () => {
            await storePlayers(db, {});

            const metadata = await db.get('metadata', 'lastUpdate');
            expect(metadata).toBeDefined();
            expect(metadata?.lastUpdated).toBeTypeOf('number');
            expect(metadata?.version).toBe('1.0');
        });

        it('should handle invalid height values', async () => {
            const players: Record<string, Player> = {
                '123': {
                    player_id: '123',
                    first_name: 'Test',
                    last_name: 'Player',
                    team: 'KC',
                    position: 'QB',
                    status: 'Active',
                    fantasy_positions: ['QB'],
                    height: 'invalid'
                }
            };

            await storePlayers(db, players);

            const storedPlayer = await db.get('players', '123');
            expect(storedPlayer?.height).toBeUndefined();
        });

        it('should process players in batches', async () => {
            const manyPlayers: Record<string, Player> = {};
            for (let i = 1; i <= 1000; i++) {
                manyPlayers[i.toString()] = {
                    player_id: i.toString(),
                    first_name: 'Player',
                    last_name: i.toString(),
                    team: 'KC',
                    position: 'QB',
                    status: 'Active',
                    fantasy_positions: ['QB']
                };
            }

            await storePlayers(db, manyPlayers);

            const allStoredPlayers = await db.getAll('players');
            expect(allStoredPlayers.length).toBe(1000);
        });

        it('should handle empty players object', async () => {
            await storePlayers(db, {});

            const allStoredPlayers = await db.getAll('players');
            expect(allStoredPlayers.length).toBe(0);

            const metadata = await db.get('metadata', 'lastUpdate');
            expect(metadata).toBeDefined();
        });

        it('should throw error when database operation fails', async () => {
            db.close();

            const players: Record<string, Player> = {
                '123': {
                    player_id: '123',
                    first_name: 'Test',
                    last_name: 'Player',
                    team: 'KC',
                    position: 'QB',
                    status: 'Active',
                    fantasy_positions: ['QB']
                }
            };

            await expect(storePlayers(db, players)).rejects.toThrow();
        });
    });

    describe('storePlayer - additional edge cases', () => {
        let db: IDBPDatabase<PlayerDBSchema>;
        let tx: IDBPTransaction<PlayerDBSchema, ['players'], 'readwrite'>;

        beforeEach(async () => {

            const dbName = `test-db-storePlayerEdge-${Date.now()}-${Math.random()}`;
            db = await openDB<PlayerDBSchema>(dbName, 1, {
                upgrade(db) {
                    db.createObjectStore('players', { keyPath: 'player_id' });
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    db.createObjectStore('ownership', { keyPath: 'player_id' });
                },
            });
            tx = db.transaction('players', 'readwrite');
        });

        afterEach(async () => {
            db.close();
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        it('should handle player with no height property', async () => {
            const player: Player = {
                player_id: '111',
                first_name: 'No',
                last_name: 'Height',
                team: 'KC',
                position: 'QB',
                status: 'Active',
                fantasy_positions: ['QB']
            };

            await storePlayer(tx, player);
            await tx.done;

            const storedPlayer = await db.get('players', '111');
            expect(storedPlayer?.height).toBeUndefined();
        });

        it('should handle boundary height values', async () => {
            const validPlayer: Player = {
                player_id: '222',
                first_name: 'Valid',
                last_name: 'Height',
                team: 'KC',
                position: 'QB',
                status: 'Active',
                fantasy_positions: ['QB'],
                height: '5\'0"'
            };

            await storePlayer(tx, validPlayer);
            await tx.done;

            const storedPlayer = await db.get('players', '222');
            expect(storedPlayer?.height).toBe('5\'0"');
        });
    });

    describe('fetchAndStorePlayers', () => {
        let db: IDBPDatabase<PlayerDBSchema>;

        beforeEach(async () => {

            const dbName = `test-db-fetchAndStore-${Date.now()}-${Math.random()}`;
            db = await openDB<PlayerDBSchema>(dbName, 1, {
                upgrade(db) {
                    db.createObjectStore('players', { keyPath: 'player_id' });
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    db.createObjectStore('ownership', { keyPath: 'player_id' });
                },
            });
        });

        afterEach(async () => {
            db.close();
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        it('should successfully fetch and store players', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ players: mockBackendPlayers })
            } as Response);

            const result = await fetchAndStorePlayers(db);

            expect(result).toEqual(mockPlayers);

            const storedPlayer1 = await db.get('players', '123');
            const storedPlayer2 = await db.get('players', '456');
            expect(storedPlayer1).toBeDefined();
            expect(storedPlayer2).toBeDefined();

            const metadata = await db.get('metadata', 'lastUpdate');
            expect(metadata).toBeDefined();
        });

        it('should throw error when fetchPlayers fails', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            await expect(fetchAndStorePlayers(db)).rejects.toThrow('Failed to fetch players: 500 Internal Server Error');

            const allStoredPlayers = await db.getAll('players');
            expect(allStoredPlayers.length).toBe(0);
        });

        it('should throw error when storePlayers fails', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ players: mockBackendPlayers })
            } as Response);

            db.close();

            await expect(fetchAndStorePlayers(db)).rejects.toThrow();
        });

        it('should handle network errors during fetch', async () => {
            fetchSpy.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchAndStorePlayers(db)).rejects.toThrow('Network error');
        });
    });
});
