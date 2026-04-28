import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDB, IDBPDatabase, IDBPTransaction } from 'idb';
import {
    mapBackendPlayerRow,
    playersFromDashboardBundle,
    storePlayer,
    storePlayers,
} from '../playerFunctions';
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
        status: 'Active',
        stats: { average_points: 23.4, total_points: 280.8, games_played: 12 },
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
        status: 'Active',
    },
];

describe('mapBackendPlayerRow', () => {
    it('maps backend players including stats', () => {
        const result = mapBackendPlayerRow(mockBackendPlayers[0]);
        expect(result).toMatchObject({
            player_id: '123',
            sleeper_player_id: '123',
            first_name: 'Patrick',
            last_name: 'Mahomes',
            position: 'QB',
            age: 28,
            height: '6\'3"',
            stats: { average_points: 23.4, total_points: 280.8, games_played: 12 },
        });
    });

    it('returns null for invalid player data', () => {
        expect(mapBackendPlayerRow({ playerName: 'No ID' })).toBeNull();
        expect(mapBackendPlayerRow({ sleeper_player_id: '1' })).toBeNull();
    });

    it('handles complex player names', () => {
        const result = mapBackendPlayerRow({
            sleeper_player_id: '777',
            playerName: "D'Andre Swift Jr.",
            position: 'RB',
            status: 'Active',
        });
        expect(result?.first_name).toBe("D'Andre");
        expect(result?.last_name).toBe('Swift Jr.');
    });
});

describe('playersFromDashboardBundle', () => {
    it('handles arrays', () => {
        const result = playersFromDashboardBundle(mockBackendPlayers);
        expect(Object.keys(result)).toEqual(['123', '456']);
    });

    it('handles id-keyed records', () => {
        const record = {
            '123': mockBackendPlayers[0],
            '456': mockBackendPlayers[1],
        };
        const result = playersFromDashboardBundle(record);
        expect(Object.keys(result).sort()).toEqual(['123', '456']);
    });

    it('returns empty object for null/undefined', () => {
        expect(playersFromDashboardBundle(null)).toEqual({});
        expect(playersFromDashboardBundle(undefined)).toEqual({});
    });

    it('skips invalid rows in arrays', () => {
        const result = playersFromDashboardBundle([
            mockBackendPlayers[0],
            { team: 'NYJ' },
            { sleeper_player_id: '999' },
        ]);
        expect(Object.keys(result)).toEqual(['123']);
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
        await new Promise((r) => setTimeout(r, 0));
    });

    it('stores active players with relevant positions', async () => {
        await storePlayer(tx, {
            player_id: '123',
            first_name: 'Test',
            last_name: 'Player',
            team: 'KC',
            position: 'QB',
            status: 'Active',
            fantasy_positions: ['QB'],
            height: "6'2\"",
        });
        await tx.done;
        const stored = await db.get('players', '123');
        expect(stored).toBeDefined();
        expect(stored?.height).toBe("6'2\"");
    });

    it('stores inactive players but skips retired', async () => {
        await storePlayer(tx, {
            player_id: '999',
            position: 'WR',
            status: 'Inactive',
            fantasy_positions: ['WR'],
        });
        await storePlayer(tx, {
            player_id: '998',
            position: 'WR',
            status: 'Retired',
            fantasy_positions: ['WR'],
        });
        await tx.done;
        expect(await db.get('players', '999')).toBeDefined();
        expect(await db.get('players', '998')).toBeUndefined();
    });

    it('skips non-rosterable positions like DEF', async () => {
        await storePlayer(tx, {
            player_id: '555',
            position: 'DEF',
            status: 'Active',
            fantasy_positions: ['DEF'],
        });
        await tx.done;
        expect(await db.get('players', '555')).toBeUndefined();
    });

    it('preserves any height string passed in', async () => {
        await storePlayer(tx, {
            player_id: '888',
            position: 'QB',
            status: 'Active',
            fantasy_positions: ['QB'],
            height: 'whatever',
        });
        await tx.done;
        const stored = await db.get('players', '888');
        expect(stored?.height).toBe('whatever');
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
        await new Promise((r) => setTimeout(r, 0));
    });

    it('stores skill positions and excludes DEF and retired', async () => {
        const players: Record<string, Player> = {
            '123': { player_id: '123', position: 'QB', status: 'Active', fantasy_positions: ['QB'] },
            '456': { player_id: '456', position: 'WR', status: 'Inactive', fantasy_positions: ['WR'] },
            '789': { player_id: '789', position: 'DEF', status: 'Active', fantasy_positions: ['DEF'] },
            '111': { player_id: '111', position: 'RB', status: 'Retired', fantasy_positions: ['RB'] },
        };
        await storePlayers(db, players);
        expect(await db.get('players', '123')).toBeDefined();
        expect(await db.get('players', '456')).toBeDefined();
        expect(await db.get('players', '789')).toBeUndefined();
        expect(await db.get('players', '111')).toBeUndefined();
    });

    it('updates metadata after storing players', async () => {
        await storePlayers(db, {});
        const metadata = await db.get('metadata', 'lastUpdate');
        expect(metadata).toBeDefined();
        expect(metadata?.lastUpdated).toBeTypeOf('number');
    });

    it('handles many players', async () => {
        const many: Record<string, Player> = {};
        for (let i = 1; i <= 1000; i++) {
            many[String(i)] = {
                player_id: String(i),
                position: 'QB',
                status: 'Active',
                fantasy_positions: ['QB'],
            };
        }
        await storePlayers(db, many);
        expect((await db.getAll('players')).length).toBe(1000);
    });

    it('throws when database is closed', async () => {
        db.close();
        await expect(
            storePlayers(db, {
                '123': { player_id: '123', position: 'QB', status: 'Active', fantasy_positions: ['QB'] },
            })
        ).rejects.toThrow();
    });
});
