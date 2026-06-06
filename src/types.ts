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
// Trade Analyzer Types
// ============================================================================
export interface ProviderHealth {
    provider: string;
    healthy: boolean;
    models?: string[];
    message?: string;
}

export type TradeSide = 'a' | 'b';

/** Row from dashboard bundle `picks_by_roster` (matches backend OwnedPick + ktc_value). */
export interface DashboardPickRow {
    pick_id: string;
    season: string | number;
    round: number;
    original_roster_id: number;
    slot_bucket: string;
    ktc_value?: number | null;
    values?: ValuesBlock | null;
}

export interface TradeAnalyzerPick {
    pick_id?: string;
    owner_roster_id: number;
    /** Sleeper roster that originally held this pick slot (before trades). */
    original_roster_id?: number;
    season: number;
    round: number;
    descriptor?: 'early' | 'mid' | 'late' | string;
    ktc_value?: number;
}

/** POST /api/trade-analyzer/analyze body (see `routes/trade_analyzer/request_schema.py`). */
export interface TradeAnalyzerKtcConfig {
    league_format: '1qb' | 'superflex';
    is_redraft: boolean;
    tep_level: '' | 'tep' | 'tepp' | 'teppp' | null;
}

export interface TradeAnalyzerRequest {
    league_id: string;
    /** Four-digit year string (backend validates with `season.isdigit()` and length 4). */
    season: string;
    side_a: {
        roster_id: number;
        player_ids: string[];
        pick_ids: string[];
        /** Dynasty-only posture override; default false = contending. Ignored in redraft. */
        is_tanking?: boolean;
    };
    side_b: {
        roster_id: number;
        player_ids: string[];
        pick_ids: string[];
        /** Dynasty-only posture override; default false = contending. Ignored in redraft. */
        is_tanking?: boolean;
    };
    ktc?: TradeAnalyzerKtcConfig | null;
    additional_context?: string | null;
    provider?: string | null;
    model?: string | null;
}

export interface TradeAnalyzerResponse {
    winner: TradeSide | 'even';
    summary_bullets: string[];
    side_a: {
        trade_grade: string;
        pros: string[];
        cons: string[];
        ktc_delta: {
            values_in: number;
            values_out: number;
            net: number;
            per_asset: Array<{
                label: string;
                value: number;
            }>;
        };
        sleeper_data: {
            stats_trajectory: Array<{ x: string; y: number }>;
            positional_impact: string;
            needs_addressed: string[];
        };
    };
    side_b: TradeAnalyzerResponse['side_a'];
}

export interface TradeAnalyzerRateLimitError {
    error: string;
    retry_after_seconds: number;
}

export interface TradeAnalyzerPrefsRow {
    key: 'trade_analyzer_prefs';
    provider: string | null;
    model: string | null;
}

export interface TradeAnalyzerLastResultRow {
    key: 'trade_analyzer_last_result';
    createdAt: number;
    request: TradeAnalyzerRequest;
    response: TradeAnalyzerResponse;
}

/** Serializable player row stored with a trade analysis history entry. */
export interface TradeAnalyzerPlayerSnapshot {
    player_id: string;
    name: string;
    position?: string;
    ktc_value: number;
    rank_label: string | null;
}

export interface TradeAnalyzerPickSnapshot {
    pick_id?: string;
    label: string;
    ktc_value: number;
}

export interface TradeAnalyzerSideSnapshot {
    roster_id: number;
    team_name: string;
    team_subtitle: string;
    players: TradeAnalyzerPlayerSnapshot[];
    picks: TradeAnalyzerPickSnapshot[];
    ktc_subtotal: number;
}

export interface TradeAnalyzerHistoryEntry {
    id: string;
    createdAt: number;
    league_id: string;
    additional_context?: string;
    request: TradeAnalyzerRequest;
    response: TradeAnalyzerResponse;
    side_a: TradeAnalyzerSideSnapshot;
    side_b: TradeAnalyzerSideSnapshot;
}

export interface TradeAnalyzerHistoryRow {
    key: 'trade_analyzer_history';
    entries: TradeAnalyzerHistoryEntry[];
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

/** Player-level KTC flags surfaced by the dashboard bundle on each `player.ktc` object. */
export interface KTCFlags {
    age?: number;
    pickRound?: number | null;
    pickNum?: number | null;
    isTrending?: boolean | null;
    draftYear?: number | null;
    byeWeek?: number | null;
    /** Parsed KTC injury blob (shape varies; renderers should treat as opaque). */
    injury?: Record<string, unknown> | null;
    /** True when the row reflects redraft KTC values rather than dynasty. */
    is_redraft?: boolean;
}

export interface KTCData extends KTCFlags {
    oneQBValues?: KTCValues | null;
    superflexValues?: KTCValues | null;
}

export interface SourceValue {
  value?: number | null;
  rank?: number | null;
  redraft_value?: number | null;
  trade_frequency?: number | null;
  volatility?: number | null;
  trend_30day?: number | null;
}

export interface ValuesBlock {
  blended?: number | null;
  sources?: Partial<Record<'ktc' | 'fantasycalc', SourceValue>>;
  projection?: { proj_ros?: number | null; proj_week?: number | null };
}

// ============================================================================
// Player Types
// ============================================================================
export interface PlayerStats {
    average_points?: number;
    total_points?: number;
    games_played?: number;
}

/** Compact ownership snapshot for the latest research week (server-attached). */
export interface ResearchLatest {
    week: number;
    owned?: number | null;
    started?: number | null;
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
    /** Optional Sleeper injury detail surfaced on the dashboard expand row. */
    injury_body_part?: string | null;
    injury_notes?: string | null;
    injury_start_date?: string | null;
    practice_participation?: string | null;
    practice_description?: string | null;
    ktc?: KTCData;
    values?: ValuesBlock | null;
    /** Aggregated season stats from SleeperWeeklyData (avg/total/games). */
    stats?: PlayerStats;
    /** Latest research-week ownership snapshot from `_attach_research_latest`. */
    research_latest?: ResearchLatest | null;
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
    /** Sleeper taxi-squad player ids (dynasty leagues only; empty / missing otherwise). */
    taxi?: string[];
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
    /** Owned draft picks per roster_id (from `compute_owned_picks`). */
    picks_by_roster?: Record<string, DashboardPickRow[]>;
    /** Server-resolved season (query param or DB lookup) for gating season-specific UI. */
    bundleSeason?: string | null;
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
    /** Sleeper taxi-squad players (dynasty stash; empty when league has none). */
    taxi: Player[];
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

export type AppPrefRow =
    | AppPrefLeagueId
    | TradeAnalyzerPrefsRow
    | TradeAnalyzerLastResultRow
    | TradeAnalyzerHistoryRow;

export interface PlayerDBSchema extends DBSchema {
    app_prefs: {
        key: string;
        value: AppPrefRow;
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
    /** Draft picks for the loaded league (from dashboard bundle `picks_by_roster`). */
    tradePicksByRoster: Map<number, TradeAnalyzerPick[]>;
    league: League | null;
    researchMeta: ResearchMeta | null;
    /** Server-resolved season for the loaded bundle; gates season-specific UI like bye week. */
    bundleSeason: string | null;
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
