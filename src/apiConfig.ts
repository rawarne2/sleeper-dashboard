// API Configuration - Central location for all API URLs and endpoints
export const API_CONFIG = {
  BASE_URL: import.meta.env.DEV ? 'http://localhost:5000/api' : import.meta.env.VITE_API_URL,

  // League configuration
  LEAGUES: [
    { id: '1210364682523656192', label: '2025 Season', season: 2025 },
    { id: '1050831680350568448', label: '2024 Season', season: 2024 }
  ],

  // App constants
  PLAYER_CACHE_HOURS: 24,
  BATCH_SIZE: 500,
  PLAYER_DATA_VERSION: '1.0',

  // API endpoints
  ENDPOINTS: {
    // KTC endpoints
    KTC_HEALTH: '/ktc/health',
    KTC_RANKINGS: '/ktc/rankings',
    KTC_REFRESH: '/ktc/refresh',
    KTC_REFRESH_ALL: '/ktc/refresh/all',
    KTC_CLEANUP: '/ktc/cleanup',

    // Sleeper endpoints  
    SLEEPER_REFRESH: '/sleeper/refresh',
    SLEEPER_LEAGUE: (leagueId: string) => `/sleeper/league/${leagueId}`,
    SLEEPER_LEAGUE_ROSTERS: (leagueId: string) => `/sleeper/league/${leagueId}/rosters`,
    SLEEPER_LEAGUE_USERS: (leagueId: string) => `/sleeper/league/${leagueId}/users`,
    SLEEPER_LEAGUE_REFRESH: (leagueId: string) => `/sleeper/league/${leagueId}/refresh`,
    SLEEPER_RESEARCH: (season: number) => `/sleeper/players/research/${season}`,
    SLEEPER_RESEARCH_REFRESH: (season: number) => `/sleeper/players/research/${season}/refresh`
  }
};

// Helper function to build full URLs
export const buildApiUrl = (endpoint: string, params?: Record<string, string>) => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  return url;
};

// Pre-built URLs for common use cases (using default 2025 league)
const DEFAULT_LEAGUE_ID = API_CONFIG.LEAGUES[0].id;
const DEFAULT_SEASON = API_CONFIG.LEAGUES[0].season;
console.log('env>', import.meta.env)
export const API_URLS = {
  // KTC URLs
  KTC_HEALTH: buildApiUrl(API_CONFIG.ENDPOINTS.KTC_HEALTH),
  KTC_RANKINGS_SUPERFLEX: buildApiUrl(API_CONFIG.ENDPOINTS.KTC_RANKINGS, {
    league_format: 'superflex',
    is_redraft: 'false',
    tep_level: 'tep'
  }),
  KTC_RANKINGS_1QB: buildApiUrl(API_CONFIG.ENDPOINTS.KTC_RANKINGS, {
    league_format: '1qb',
    is_redraft: 'false'
  }),

  // Sleeper URLs (using default league/season)
  SLEEPER_LEAGUE: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_LEAGUE(DEFAULT_LEAGUE_ID)),
  SLEEPER_RESEARCH: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_RESEARCH(DEFAULT_SEASON)),
  SLEEPER_REFRESH: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_REFRESH)
};
