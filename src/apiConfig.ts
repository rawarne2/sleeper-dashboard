/** Known example leagues shown on the entry screen as quick-load buttons. */
export const EXAMPLE_LEAGUES = [
  { id: '1333945997071515648', label: '2026', season: 2026 },
  { id: '1210364682523656192', label: '2025', season: 2025 },
  { id: '1050831680350568448', label: '2024', season: 2024 },
] as const;

export const API_CONFIG = {
  BASE_URL:
    (import.meta.env.DEV ? 'http://localhost:5001/api' : import.meta.env.VITE_API_URL) ?? '',

  EXAMPLE_LEAGUES,

  /** First example id: placeholder + default for any static helpers. */
  EXAMPLE_LEAGUE_ID: EXAMPLE_LEAGUES[0].id,

  ENDPOINTS: {
    DASHBOARD_LEAGUE: (leagueId: string) => `/dashboard/league/${leagueId}`,
    KTC_REFRESH: '/ktc/refresh',
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
