// API Configuration - Central location for all API URLs and endpoints
export const API_CONFIG = {
  BASE_URL: 'http://localhost:5000/api',

  // App constants
  LEAGUE_ID: '1210364682523656192', // 2025 season
  CURRENT_SEASON: 2025,
  PLAYER_CACHE_HOURS: 24,
  BATCH_SIZE: 500,
  PLAYER_DATA_VERSION: '1.0',

  // API endpoints
  ENDPOINTS: {
    // KTC endpoints
    KTC_HEALTH: '/ktc/health',
    KTC_RANKINGS: '/ktc/rankings',
    KTC_REFRESH: '/ktc/refresh',
    KTC_CLEANUP: '/ktc/cleanup',

    // Sleeper endpoints  
    SLEEPER_REFRESH: '/sleeper/refresh',
    SLEEPER_LEAGUE: (leagueId: string) => `/sleeper/league/${leagueId}`,
    SLEEPER_LEAGUE_ROSTERS: (leagueId: string) => `/sleeper/league/${leagueId}/rosters`,
    SLEEPER_LEAGUE_USERS: (leagueId: string) => `/sleeper/league/${leagueId}/users`,
    SLEEPER_LEAGUE_REFRESH: (leagueId: string) => `/sleeper/league/${leagueId}/refresh`,
    PLAYER_RESEARCH: (season: number) => `/sleeper/players/research/${season}`,
    PLAYER_RESEARCH_REFRESH: (season: number) => `/sleeper/players/research/${season}/refresh`,
    SLEEPER_REFRESH_ALL: '/sleeper/refresh/all'
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

// Pre-built URLs for common use cases
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

  // Sleeper URLs
  SLEEPER_LEAGUE: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_LEAGUE(API_CONFIG.LEAGUE_ID)),
  PLAYER_RESEARCH: buildApiUrl(API_CONFIG.ENDPOINTS.PLAYER_RESEARCH(API_CONFIG.CURRENT_SEASON)),
  SLEEPER_REFRESH: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_REFRESH)
};
