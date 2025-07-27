// Types for Sleeper Dashboard

// Player information from the Sleeper API
export interface Player {
    player_id: string;
    first_name: string;
    last_name: string;
    team: string;
    position: string;
    age?: number;
    height?: string;
    weight?: string;
    years_exp?: number;
    college?: string;
    fantasy_positions: string[];
    status: string;
    injury_status?: string | null;
    number?: number;
    depth_chart_position?: number;
}

// Roster settings from the Sleeper API
export interface RosterSettings {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    ppts?: number;
    ppts_decimal?: number;
    waiver_position?: number;
    waiver_budget_used?: number;
    total_moves?: number;
}

// Roster information from the Sleeper API
export interface Roster {
    roster_id: number;
    owner_id: string;
    league_id?: string;
    starters: string[];
    players: string[];
    reserve?: string[];
    settings: RosterSettings;
}

// User information from the Sleeper API
export interface User {
    user_id: string;
    username?: string;
    display_name: string;
    avatar?: string;
    metadata?: {
        team_name?: string;
    };
    is_owner?: boolean;
}

// Combined league data
export interface LeagueData {
    rosters: Roster[];
    users: User[];
    players: Record<string, Player>;
    playerOwnership?: PlayerOwnershipData;
}

// Team data structure
export interface TeamData {
    roster: Roster;
    user: User;
    players: Player[];
    starters: Player[];
    bench: Player[];
}

// Player ownership statistics
export interface PlayerOwnershipStats {
    owned: number;
    started: number;
}

// Player ownership data by player ID
export interface PlayerOwnershipData {
    [playerId: string]: PlayerOwnershipStats;
}

// IndexedDB schema for player data
import { DBSchema } from 'idb';

export interface PlayerDBSchema extends DBSchema {
    players: {
        key: string;
        value: Player;
    };
    metadata: {
        key: string;
        value: { lastUpdated: number; key: string; version: string };
    };
    ownership: {
        key: string;
        value: PlayerOwnershipStats & { player_id: string };
    };
} 