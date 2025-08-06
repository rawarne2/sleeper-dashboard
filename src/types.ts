// Types for Sleeper Dashboard

// ============================================================================
// API Response Types (matching backend structure)
// ============================================================================
export interface ApiResponse<T = unknown> {
    status?: 'success' | 'error' | 'healthy' | 'unhealthy';
    message?: string;
    error?: string;
    details?: string;
    timestamp?: string;
    data?: T;
    source?: 'database' | 'sleeper_api';
    database_saved?: boolean;
}

// ============================================================================
// KTC Value Types (matching backend KTC data structure)
// ============================================================================
export interface KTCValues {
    value?: number;
    rank?: number;
    positionalRank?: number;
    overallTier?: number;
    positionalTier?: number;
    tep?: {
        value?: number;
        rank?: number;
        positionalRank?: number;
        overallTier?: number;
        positionalTier?: number;
    };
    tepp?: {
        value?: number;
        rank?: number;
        positionalRank?: number;
        overallTier?: number;
        positionalTier?: number;
    };
    teppp?: {
        value?: number;
        rank?: number;
        positionalRank?: number;
        overallTier?: number;
        positionalTier?: number;
    };
}

export interface KTCData {
    oneQBValues?: KTCValues | null;
    superflexValues?: KTCValues | null;
}

// ============================================================================
// Player Types (updated to match backend merged data structure)
// ============================================================================
export interface Player {
    // Core identifiers (from both Sleeper and KTC)
    player_id?: string;
    sleeper_player_id?: string;
    playerName?: string;
    first_name?: string;
    last_name?: string;

    // Team and position info
    team?: string;
    position?: string;
    fantasy_positions?: string[];

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

    // KTC ranking data
    ktc?: KTCData;

    // Future: Backend integrated ownership data (not yet implemented)
    owned?: number;
    started?: number;
}

// ============================================================================
// League Data Types (matching backend Sleeper API structure)
// ============================================================================
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

export interface Roster {
    roster_id: number;
    owner_id: string;
    league_id?: string;
    starters: string[];
    players: string[];
    reserve?: string[];
    settings: RosterSettings;
}

export interface User {
    user_id: string;
    username?: string;
    display_name: string;
    avatar?: string;
    team_name?: string;
    metadata?: {
        team_name?: string;
    };
    is_owner?: boolean;
}

export interface League {
    league_id: string;
    name: string;
    season: string;
    total_rosters: number;
    status: string;
}

// Backend league data response structure
export interface LeagueDataResponse {
    status: 'success';
    league: League;
    rosters: Roster[];
    users: User[];
}

// ============================================================================
// Research Data Types (for player analytics)
// ============================================================================
export interface ResearchData {
    id: number;
    season: string;
    week: number;
    league_type: number;
    player_id: string;
    research_data: Record<string, unknown>; // Generic research metrics
    last_updated: string;
}

// ============================================================================
// Rankings Response Types (from KTC endpoints)
// ============================================================================
export interface RankingsResponse {
    timestamp: string;
    is_redraft: boolean;
    league_format: 'superflex' | '1qb';
    tep_level: '' | 'tep' | 'tepp' | 'teppp';
    count: number;
    players: Player[];
}

// ============================================================================
// Refresh Response Types
// ============================================================================
export interface RefreshResults {
    total_sleeper_players?: number;
    existing_records_before?: number;
    ktc_players_updated?: number;
    new_records_created?: number;
    match_failures?: number;
    total_processed?: number;
}

export interface SleeperRefreshResponse {
    message: string;
    timestamp: string;
    sleeper_data_results: RefreshResults;
    database_success: boolean;
    merge_effective: boolean;
}

export interface KTCRefreshResponse {
    message: string;
    timestamp: string;
    database_success: boolean;
    file_saved: boolean;
    s3_uploaded: boolean;
    players: Player[];
    operations_summary: {
        players_count: number;
        database_saved_count: number;
        file_saved: boolean;
        s3_uploaded: boolean;
    };
}

// ============================================================================
// Combined League Data (for frontend use)
// ============================================================================
export interface LeagueData {
    rosters: Roster[];
    users: User[];
    players: Record<string, Player>;
    playerOwnership?: PlayerOwnershipData;
}

// Team data structure (computed from league data)
export interface TeamData {
    roster: Roster;
    user: User;
    players: Player[];
    starters: Player[];
    bench: Player[];
}

// ============================================================================
// Player Ownership Types (legacy structure for research data)
// ============================================================================
export interface PlayerOwnershipStats {
    owned: number;
    started: number;
}

export interface PlayerOwnershipData {
    [playerId: string]: PlayerOwnershipStats;
}

// ============================================================================
// IndexedDB Schema
// ============================================================================
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
        value: PlayerOwnershipStats & { player_id: string; key: string };
    };
}

// ============================================================================
// League Context Types
// ============================================================================
export interface LeagueContextType {
    // Raw data states (single source of truth)
    rosters: Roster[];
    users: User[];
    players: Record<string, Player>;
    playerOwnership: PlayerOwnershipData;

    // Computed state
    teamsData: TeamData[];

    // UI state
    loading: boolean;
    error: string | null;
    selectedLeagueId: string;
    setSelectedLeagueId: (id: string) => void;

    // Actions
    refreshData: () => Promise<void>;
}
