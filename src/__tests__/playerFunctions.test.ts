import { describe, it, expect } from 'vitest';
import {
    formatKtcInjury,
    mapBackendPlayerRow,
    playersFromDashboardBundle,
} from '../playerFunctions';
import { Player } from '../types';

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

describe('formatKtcInjury', () => {
    it('returns null for healthy-only injuryCode 1 blobs', () => {
        expect(formatKtcInjury({ injuryCode: 1 })).toBeNull();
        expect(formatKtcInjury({ injuryCode: '1' })).toBeNull();
    });

    it('formats KTC injury detail fields', () => {
        expect(
            formatKtcInjury({
                injuryName: 'Questionable',
                injuryCode: 2,
                injuryArea: 'Knee - PCL',
                injuryReturn: 'Jun 1, 2026',
            })
        ).toBe('Questionable · Knee - PCL · Return Jun 1, 2026');
    });

    it('formats string injury codes with summary', () => {
        expect(formatKtcInjury({ injuryCode: 'Q', summary: 'ankle' })).toBe('Q — ankle');
    });

    it('parses JSON string injury blobs', () => {
        expect(formatKtcInjury('{"injuryCode":1}')).toBeNull();
        expect(
            formatKtcInjury(
                '{"injuryName":"Holdout","injuryCode":7,"injuryArea":"Knee - ACL + MCL"}'
            )
        ).toBe('Holdout · Knee - ACL + MCL');
    });
});

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

