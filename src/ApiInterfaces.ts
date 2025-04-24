// Sleeper API TypeScript Interfaces
// Last updated: April 24, 2025
//
// Note: The Sleeper API uses both api.sleeper.com and api.sleeper.app domains.
// The api.sleeper.app domain with /v1/ prefix is for newer endpoints.
// All endpoints are REST APIs requiring no authentication for public data.

// Common types used across multiple interfaces
export type NFLPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'SUPER_FLEX' | 'TEAM';
export type SeasonType = 'regular' | 'post' | 'off' | 'pre';
export type SortDirection = 'asc' | 'desc';

// Query Parameters Interfaces

/**
 * Query parameters for team stats endpoint
 */
export interface TeamStatsQueryParams {
    season_type: SeasonType;
    position: 'TEAM';
    order_by: string; // Stats field to order by, e.g. 'W-L PCT'
    sort_asc: boolean; // false for descending, true for ascending
}

/**
 * Query parameters for player research endpoint
 */
export interface PlayerResearchQueryParams {
    league_type: number; // e.g. 2
}

/**
 * Query parameters for projections endpoint
 */
export interface ProjectionsQueryParams {
    season_type: SeasonType;
    position: NFLPosition | NFLPosition[]; // Single position or array of positions
    order_by: string; // e.g. 'pts_ppr', 'ppr'
}

/**
 * Query parameters for trending players endpoint
 */
export interface TrendingPlayersQueryParams {
    limit: number; // Number of players to return
}

// Response Interfaces

/**
 * Team Stats Response
 * Endpoint: https://api.sleeper.com/stats/nfl/{year}
 */
export interface TeamStatsResponse {
    [teamId: string]: TeamStats;
}

export interface TeamStats {
    team_id: string;
    season: string;
    season_type: SeasonType;
    games_played: number;
    wins: number;
    losses: number;
    ties: number;
    win_pct: number;
    points_for: number;
    points_against: number;
    // Offensive stats
    total_yards: number;
    passing_yards: number;
    rushing_yards: number;
    plays_offense: number;
    yards_per_play_offense: number;
    turnovers: number;
    pass_attempts: number;
    pass_completions: number;
    pass_tds: number;
    pass_int: number;
    rush_attempts: number;
    rush_tds: number;
    // Defensive stats
    total_yards_allowed: number;
    passing_yards_allowed: number;
    rushing_yards_allowed: number;
    plays_defense: number;
    yards_per_play_defense: number;
    takeaways: number;
    sacks: number;
    // Special teams stats
    field_goals_made: number;
    field_goals_attempted: number;
    extra_points_made: number;
    extra_points_attempted: number;
    // Additional metrics may be present
    [key: string]: number | string;
}

/**
 * Player Research Response
 * Endpoint: https://api.sleeper.com/players/nfl/research/{season_type}/{year}/{week}
 */
export interface PlayerResearchResponse {
    owned: PlayerResearchStats[];
    started: PlayerResearchStats[];
}

export interface PlayerResearchStats {
    player_id: string;
    name: string;
    position: NFLPosition;
    team: string;
    owner_count: number;
    start_count: number;
    rank: number;
    points: number;
    projected_points: number;
}

/**
 * Projections Response
 * Endpoint: https://api.sleeper.com/projections/nfl/{year}/{week}
 */
export interface ProjectionsResponse {
    [playerId: string]: PlayerProjection;
}

export interface PlayerProjection {
    player_id: string;
    week: number;
    season: string;
    season_type: SeasonType;
    position: NFLPosition;
    team: string;
    opponent: string;
    game_date: string;
    // Fantasy point projections
    pts_std: number;
    pts_half_ppr: number;
    pts_ppr: number;
    // Passing stats
    pass_att: number;
    pass_cmp: number;
    pass_yd: number;
    pass_td: number;
    pass_int: number;
    // Rushing stats
    rush_att: number;
    rush_yd: number;
    rush_td: number;
    // Receiving stats
    rec: number;
    rec_yd: number;
    rec_td: number;
    // Kicking stats (if applicable)
    fgm: number;
    fga: number;
    xpm: number;
    xpa: number;
    // Defense stats (if applicable)
    def_sack: number;
    def_int: number;
    def_fum_rec: number;
    def_td: number;
    def_safety: number;
    def_pa: number;
    def_yds_allowed: number;
    // Other stats might be present
    [key: string]: number | string;
}

/**
 * Schedule Response
 * Endpoint: https://api.sleeper.com/schedule/nfl/{season_type}/{year}
 */
export interface ScheduleResponse {
    [weekNumber: string]: WeeklySchedule;
}

export interface WeeklySchedule {
    [gameId: string]: GameSchedule;
}

export interface GameSchedule {
    game_id: string;
    season: string;
    season_type: SeasonType;
    week: number;
    start_date: string; // ISO date string
    away_team: string;
    home_team: string;
    away_score?: number; // Undefined for future games
    home_score?: number; // Undefined for future games
    status: 'scheduled' | 'inprogress' | 'final';
    weather?: GameWeather;
    stadium?: Stadium;
    broadcast_info?: BroadcastInfo;
}

export interface GameWeather {
    temperature: number;
    description: string;
    wind_speed: number;
    wind_direction: string;
}

export interface Stadium {
    name: string;
    city: string;
    state: string;
    type: 'dome' | 'outdoor' | 'retractable';
}

export interface BroadcastInfo {
    network: string;
    satellite: string;
}

/**
 * Trending Players Response
 * Endpoint: https://api.sleeper.com/players/nfl/trending/{add|drop}
 */
export interface TrendingPlayersResponse {
    trending_players: TrendingPlayer[];
    timestamp: number; // Unix timestamp
}

export interface TrendingPlayer {
    player_id: string;
    name: string;
    position: NFLPosition;
    team: string;
    count: number; // Number of adds/drops
    change: number; // Change in trend from previous period
    // Player metadata
    years_exp: number;
    injury_status?: 'IR' | 'Out' | 'Doubtful' | 'Questionable' | null;
    news?: PlayerNews[];
    stats?: {
        [weekNumber: string]: {
            pts_ppr: number;
            pts_half_ppr: number;
            pts_std: number;
            [stat: string]: number;
        }
    };
}

export interface PlayerNews {
    id: string;
    source: string;
    timestamp: number;
    title: string;
    description: string;
    player_id: string;
    player_name: string;
    team: string;
    position: NFLPosition;
    injury_status?: 'IR' | 'Out' | 'Doubtful' | 'Questionable' | null;
}

/**
 * League Rosters Response
 * Endpoint: https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters
 */
export interface LeagueRostersResponse extends Array<RosterItem> { }

export interface RosterItem {
    roster_id: number;
    owner_id: string;
    league_id: string;
    starters: string[]; // Array of player IDs in starting lineup
    reserve: string[]; // Array of player IDs on reserve
    taxi?: string[]; // Array of player IDs on taxi squad
    players: string[]; // Array of all player IDs on roster
    player_map?: {
        [player_id: string]: {
            activation_epoch?: number;
            status?: string;
            metadata?: {
                [key: string]: string;
            }
        }
    };
    co_owners?: string[]; // Array of co-owner user_ids
    metadata: {
        streak?: string;
        record?: string;
        // Other metadata fields
        [key: string]: string | undefined;
    };
    settings: {
        wins: number;
        waiver_position: number;
        waiver_budget_used: number;
        total_moves: number;
        ties: number;
        losses: number;
        fpts_decimal: number;
        fpts_against_decimal: number;
        fpts_against: number;
        fpts: number;
        division?: number;
        // Other settings may exist
        [key: string]: number | undefined;
    };
}

/**
 * League Users Response
 * Endpoint: https://api.sleeper.app/v1/league/${LEAGUE_ID}/users
 */
export interface LeagueUsersResponse extends Array<LeagueUser> { }

export interface LeagueUser {
    user_id: string;
    username: string;
    display_name: string;
    avatar: string; // Avatar ID for use with avatar endpoints
    metadata: {
        team_name?: string;
        team_name_updated?: number;
        mention_pn?: string;
        mascot_message?: string;
        avatar_background_color?: string;
        // Other metadata fields
        [key: string]: string | number | undefined;
    };
    is_owner?: boolean;
    is_bot?: boolean;
    league_id: string;
    status?: string;
}

/**
 * Players Dictionary Response
 * Endpoint: https://api.sleeper.app/v1/players/nfl
 */
export interface PlayersResponse {
    [player_id: string]: PlayerDetails;
}

export interface PlayerDetails {
    player_id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    team?: string | null; // NFL team abbreviation, null for free agents
    position: NFLPosition;
    age?: number;
    number?: number; // Jersey number
    height?: string;
    weight?: string;
    years_exp: number;
    status?: string | null; // Active, Inactive, Injured, etc.
    injury_status?: 'IR' | 'Out' | 'Doubtful' | 'Questionable' | null;
    injury_start_date?: string | null;
    injury_notes?: string | null;
    college?: string;
    hashtag?: string;
    depth_chart_order?: number;
    depth_chart_position?: string;
    search_rank?: number;
    high_school?: string;
    birth_city?: string;
    birth_state?: string;
    birth_country?: string;
    birth_date?: string;
    fantasy_positions?: NFLPosition[];
    sport: string; // "nfl" always
    active?: boolean;
    practice_squad?: boolean;
    fantasy_data_id?: number;
    espn_id?: number;
    yahoo_id?: number;
    rotowire_id?: number;
    swish_id?: number;
    stats_id?: string;
    gsis_id?: string;
    rotoworld_id?: number;
    sleeper_id?: number;
    search_full_name?: string;
    metadata?: {
        [key: string]: string;
    };
}

/**
 * Avatar URL Endpoints
 * Endpoints:
 * - https://sleepercdn.com/avatars/thumbs/${avatar_id}
 * - https://sleepercdn.com/avatars/${avatar_id}
 * 
 * These are not REST API endpoints but URL patterns for avatar images
 */
export interface AvatarURLs {
    thumbnail: string; // https://sleepercdn.com/avatars/thumbs/${avatar_id}
    fullSize: string;  // https://sleepercdn.com/avatars/${avatar_id}
}

/**
 * Helper function to generate avatar URLs from avatar ID
 */
export function generateAvatarURLs(avatarId: string): AvatarURLs {
    return {
        thumbnail: `https://sleepercdn.com/avatars/thumbs/${avatarId}`,
        fullSize: `https://sleepercdn.com/avatars/${avatarId}`
    };
}

/**
 * League Details Response
 * Endpoint: https://api.sleeper.app/v1/league/${LEAGUE_ID}
 */
/**
 * Type utilities for working with API data
 */
export type PlayerId = string;
export type UserId = string;
export type LeagueId = string;
export type TeamId = string;
export type WeekNumber = number;
export type SeasonYear = string; // YYYY format

export interface LeagueResponse {
    league_id: string;
    name: string;
    season: string;
    season_type: SeasonType;
    status: string;
    sport: string;
    total_rosters: number;
    previous_league_id?: string;
    draft_id?: string;
    avatar?: string;
    scoring_settings: {
        [key: string]: number;
        // Common scoring settings
        rec: number;
        rec_yd: number;
        rec_td: number;
        pass_yd: number;
        pass_td: number;
        pass_int: number;
        rush_yd: number;
        rush_td: number;
        fum: number;
        fum_lost: number;
        fg: number;
        xp: number;
        def_st_td: number;
        def_sack: number;
        def_int: number;
        def_fum_rec: number;
        def_td: number;
    };
    roster_positions: string[];
    settings: {
        waiver_type: number;
        waiver_day_of_week: number;
        waiver_clear_days: number;
        waiver_budget: number;
        type: number;
        trade_review_days: number;
        trade_deadline: number;
        start_week: number;
        playoff_week_start: number;
        playoff_teams: number;
        num_teams: number;
        leg: number;
        league_average_match: number;
        last_scored_leg: number;
        last_report: number;
        daily_waivers_last_ran: number;
        daily_waivers: number;
        commissioner_id: string;
        bench_lock: number;
        [key: string]: string | number;
    };
    metadata: {
        latest_league_winner_roster_id?: string;
        latest_league_winner_user_id?: string;
        presentation_type?: string;
        [key: string]: string | undefined;
    };
}