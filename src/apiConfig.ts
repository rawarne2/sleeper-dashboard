/** Known example leagues for the entry-screen quick pick (id + label for all users). */
export const EXAMPLE_LEAGUES = [
  { id: '1333945997071515648', label: '2026 Season', season: 2026 },
  { id: '1210364682523656192', label: '2025 Season', season: 2025 },
  { id: '1050831680350568448', label: '2024 Season', season: 2024 },
] as const;

export const API_CONFIG = {
  BASE_URL: import.meta.env.DEV ? 'http://localhost:5001/api' : import.meta.env.VITE_API_URL,

  EXAMPLE_LEAGUES,

  /** First example id: placeholder + default for static API_URLS helpers. */
  EXAMPLE_LEAGUE_ID: EXAMPLE_LEAGUES[0].id,

  BATCH_SIZE: 500,

  ENDPOINTS: {
    DASHBOARD_LEAGUE: (leagueId: string) => `/dashboard/league/${leagueId}`,
    KTC_HEALTH: '/ktc/health',
    KTC_RANKINGS: '/ktc/rankings',
    KTC_REFRESH: '/ktc/refresh',
    KTC_REFRESH_ALL: '/ktc/refresh/all',
    KTC_CLEANUP: '/ktc/cleanup',
    SLEEPER_REFRESH: '/sleeper/refresh',
    SLEEPER_LEAGUE: (leagueId: string) => `/sleeper/league/${leagueId}`,
    SLEEPER_LEAGUE_ROSTERS: (leagueId: string) => `/sleeper/league/${leagueId}/rosters`,
    SLEEPER_LEAGUE_USERS: (leagueId: string) => `/sleeper/league/${leagueId}/users`,
    SLEEPER_LEAGUE_REFRESH: (leagueId: string) => `/sleeper/league/${leagueId}/refresh`,
    SLEEPER_RESEARCH: (season: number) => `/sleeper/players/research/${season}`,
    SLEEPER_RESEARCH_REFRESH: (season: number) => `/sleeper/players/research/${season}/refresh`,
  }
};

export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  const base = API_CONFIG.BASE_URL.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let url = `${base}${path}`;
  if (params && Object.keys(params).length > 0) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, v);
    });
    const s = q.toString();
    if (s) url += `?${s}`;
  }
  return url;
};

const DEFAULT_LEAGUE_ID = API_CONFIG.EXAMPLE_LEAGUE_ID;
const DEFAULT_SEASON = new Date().getFullYear();

export const API_URLS = {
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

  SLEEPER_LEAGUE: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_LEAGUE(DEFAULT_LEAGUE_ID)),
  SLEEPER_RESEARCH: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_RESEARCH(DEFAULT_SEASON)),
  SLEEPER_REFRESH: buildApiUrl(API_CONFIG.ENDPOINTS.SLEEPER_REFRESH),
};
