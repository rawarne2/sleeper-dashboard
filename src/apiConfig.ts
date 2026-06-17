/** Known example leagues shown on the entry screen as quick-load buttons. */
export const EXAMPLE_LEAGUES = [
  { id: '1333945997071515648', name: 'Salt Factory',        season: 2026, format: 'superflex', league_type: 'dynasty', tep: 'tep' },
  { id: '1210364682523656192', name: 'Salt Factory',        season: 2025, format: 'superflex', league_type: 'dynasty', tep: 'tep' },
  { id: '1050831680350568448', name: 'Salt Factory',        season: 2024, format: 'superflex', league_type: 'dynasty', tep: 'tep' },
  { id: '1190924497696305152', name: 'Beautiful Disaster',  season: 2025, format: 'superflex', league_type: 'dynasty', tep: 'none' },
  { id: '1239770580941541376', name: 'Dynasty Degens 28-3', season: 2025, format: 'superflex', league_type: 'dynasty', tep: 'tepp' },
  { id: '1180339739647119360', name: 'Last Minute Ballers', season: 2025, format: 'superflex', league_type: 'dynasty', tep: 'teppp' },
  { id: '1250988209538596864', name: 'The League Drei',     season: 2025, format: '1qb',       league_type: 'keeper',  tep: 'none' },
  { id: '1254286077921873920', name: 'Deep Dish',           season: 2025, format: 'superflex', league_type: 'redraft', tep: 'none' },
] as const;

export const API_CONFIG = {
  BASE_URL:
    (import.meta.env.DEV ? 'http://localhost:5001/api' : import.meta.env.VITE_API_URL) ?? '',

  EXAMPLE_LEAGUES,

  /** First example id: placeholder + default for any static helpers. */
  EXAMPLE_LEAGUE_ID: EXAMPLE_LEAGUES[0].id,

  ENDPOINTS: {
    DASHBOARD_LEAGUE: (leagueId: string) => `/dashboard/league/${leagueId}`,
    PLAYERS_ALL: '/players/all',
    KTC_REFRESH: '/ktc/refresh',
    KTC_REFRESH_STATUS: (jobId: string) => `/ktc/refresh/status/${jobId}`,
    TRADE_ANALYZER_PROVIDERS: '/trade-analyzer/providers',
    TRADE_ANALYZER_ANALYZE: '/trade-analyzer/analyze',
    TRADE_ANALYZER_FEEDBACK: '/trade-analyzer/feedback',
  },
};

export const buildApiUrl = (
  endpoint: string,
  params?: Record<string, string>
): string => {
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
