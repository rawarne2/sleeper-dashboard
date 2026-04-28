// ============================================================================
// API Response Types
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
// KTC Value Types
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
// Player Types
// ============================================================================
export interface PlayerStats {
    average_points?: number;
    total_points?: number;
    games_played?: number;
}

export interface Player {
    player_id?: string;
    sleeper_player_id?: string;
    playerName?: string;
    first_name?: string;
    last_name?: string;
    team?: string;
    position?: string;
    fantasy_positions?: string[];
    age?: number;
    /** ISO date (YYYY-MM-DD) from Sleeper. */
    birth_date?: string;
    /** Sleeper height string, e.g. `6'5"`. */
    height?: string;
    weight?: string;
    college?: string;
    years_exp?: number;
    number?: number;
    depth_chart_position?: number;
    status?: string;
    injury_status?: string | null;
    ktc?: KTCData;
    /** Aggregated season stats from SleeperWeeklyData (avg/total/games). */
    stats?: PlayerStats;
    owned?: number;
    started?: number;
}

// ============================================================================
// League Data Types
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
    rank?: number;
}

export interface Roster {
    roster_id: number;
    owner_id: string;
    league_id?: string;
    starters: string[];
    players: string[];
    reserve?: string[];
    /** Sleeper roster.metadata (optional; may be absent on older API payloads). */
    roster_metadata?: Record<string, unknown>;
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

export interface LeagueDataResponse {
    status: 'success';
    league: League;
    rosters: Roster[];
    users: User[];
}

/** `data` payload from GET /dashboard/league/:leagueId (bundled dashboard API). */
export interface DashboardLeagueBundle {
    league?: League | null;
    rosters: Roster[];
    users: User[];
    /** KTC-style array or id → row (see `playersFromDashboardBundle`). */
    players: unknown;
    ownership: PlayerOwnershipData;
    researchMeta?: ResearchMeta | null;
    /** ISO timestamp when roster-scoped KTC rows were last written (server UTC). */
    ktcLastUpdated?: string | null;
}

/** IndexedDB row for `bundle_cache` (offline / stale-while-revalidate). */
export interface BundleCacheRow {
    key: string;
    savedAt: number;
    data: DashboardLeagueBundle;
}

// ============================================================================
// Research Data Types
// ============================================================================
export interface ResearchData {
    id: number;
    season: string;
    week: number;
    league_type: number;
    player_id: string;
    research_data: Record<string, unknown>;
    last_updated: string;
}

export interface ResearchMeta {
    season: string;
    week: number;
    league_type: number;
    last_updated: string;
}

// ============================================================================
// Rankings Response Types
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
// Combined League Data
// ============================================================================
export interface LeagueData {
    rosters: Roster[];
    users: User[];
    players: Record<string, Player>;
    playerOwnership?: PlayerOwnershipData;
}

export interface TeamData {
    roster: Roster;
    user: User;
    players: Player[];
    starters: Player[];
    bench: Player[];
    reserve: Player[];
}

// ============================================================================
// Player Ownership Types
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

export interface AppPrefLeagueId {
    key: 'league_id';
    leagueId: string;
}

export interface PlayerDBSchema extends DBSchema {
    players: {
        key: string;
        value: Player;
    };
    metadata: {
        key: string;
        value: { lastUpdated: number; key: string };
    };
    ownership: {
        key: string;
        value: PlayerOwnershipStats & { player_id: string; key: string };
    };
    app_prefs: {
        key: string;
        value: AppPrefLeagueId;
    };
    bundle_cache: {
        key: string;
        value: BundleCacheRow;
    };
}

// ============================================================================
// League Context Types
// ============================================================================
export interface LeagueContextType {
    rosters: Roster[];
    users: User[];
    players: Record<string, Player>;
    playerOwnership: PlayerOwnershipData;
    league: League | null;
    researchMeta: ResearchMeta | null;
    /** ISO string from bundle `ktcLastUpdated`; null if unknown or no KTC rows. */
    ktcLastUpdated: string | null;
    championUserId: string | null;
    teamsData: TeamData[];
    loading: boolean;
    /** True while a KTC refresh is in progress (dashboard stays visible). */
    refreshing: boolean;
    error: string | null;
    /** True after IndexedDB league preference has been read. */
    leagueIdReady: boolean;
    selectedLeagueId: string;
    setSelectedLeagueId: (id: string) => void;
    /** Remove stored league id and return to the entry screen. */
    clearStoredLeague: () => void;
    /** POST a fresh KTC scrape, then reload the dashboard bundle. */
    refreshData: () => void;
}
