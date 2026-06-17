import {
  Fragment,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { KtcConfig, Player } from '../types';
import { API_CONFIG, buildApiUrl } from '../apiConfig';
import { useLeague } from '../useLeague';
import { mapBackendPlayerRow, ktcDisplayValues, resolveOwnership } from '../playerFunctions';
import { ktcConfigParams, availablePositions } from '../utils/leagueConfig';
import { playersAllCacheKey, readPlayersAllCache, writePlayersAllCache } from '../playersAllCache';
import { positionColorVar } from '../utils/valueDisplay';
import { type SortDirection } from '../components/playerTable/ColumnHeader';
import {
  PlayerStatHeader,
  DEFAULT_STAT_SORT_DIR,
  DEFAULT_STAT_SORT_KEY,
  type StatSortKey,
} from '../components/playerTable/PlayerStatHeader';
import { PlayerStatRow } from '../components/playerTable/PlayerStatRow';
import { statColumnCount, PLAYER_LIST_SCROLL } from '../components/playerTable/layout';
import { PlayerDetailContent } from '../components/PlayerDetailContent';
import { DashboardSectionMeta } from '../components/DashboardSectionMeta';

interface Row {
  player: Player;
  team: string;
  consensus: number | null;
  trend: number | null;
  ktc: number | null;
  fc: number | null;
  redraft: number | null;
  vol: number | null;
  liq: number | null;
  own: number | null;
  start: number | null;
  avg: number | null;
  tot: number | null;
  ros: number | null;
  projWeek: number | null;
  overallRank: number | null;
  overallTier: number | null;
  positionalRank: number | null;
  positionalTier: number | null;
}

const PostureToggle = ({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className='posture-toggle-group'>
    {options.map((o) => (
      <button
        key={o.value}
        type='button'
        className={`posture-toggle${value === o.value ? ' posture-toggle--active' : ''}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default function AllPlayersPage() {
  const { ktcConfig, playerOwnership, bundleSeason, league, selectedLeagueId, researchMeta } =
    useLeague();
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const togglePlayer = (id: string) => setExpandedPlayer((c) => (c === id ? null : id));

  // Seed from the league's resolved KTC identity; the toggles below allow local
  // overrides. Switching leagues re-syncs to the new league's identity.
  const [config, setConfig] = useState<KtcConfig>(ktcConfig);
  useEffect(() => {
    setConfig(ktcConfig);
  }, [ktcConfig]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [position, setPosition] = useState<'ALL' | string>('ALL');
  useEffect(() => {
    if (position !== 'ALL' && !availablePositions(league).includes(position)) setPosition('ALL');
  }, [league, position]);
  const [sortKey, setSortKey] = useState<StatSortKey>(DEFAULT_STAT_SORT_KEY);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(DEFAULT_STAT_SORT_DIR);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PLAYERS_ALL, {
      ...ktcConfigParams(config),
      ...(bundleSeason ? { season: bundleSeason } : {}),
      ...(selectedLeagueId ? { league_id: selectedLeagueId } : {}),
    });
    const cacheKey = playersAllCacheKey(selectedLeagueId || null, config, bundleSeason ?? null);
    (async () => {
      const cached = await readPlayersAllCache(cacheKey);
      if (cached?.players?.length) {
        setPlayers(
          cached.players
            .map((p) => mapBackendPlayerRow(p as Parameters<typeof mapBackendPlayerRow>[0]))
            .filter((p): p is Player => p != null)
        );
        setLoading(false); // paint immediately; still revalidate below
      }
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to load players: ${res.status}`);
        const body = (await res.json()) as {
          players?: unknown[];
          data?: { players?: unknown[] };
        };
        const list = Array.isArray(body.players)
          ? body.players
          : Array.isArray(body.data?.players)
            ? body.data.players
            : [];
        setPlayers(
          list
            .map((p) => mapBackendPlayerRow(p as Parameters<typeof mapBackendPlayerRow>[0]))
            .filter((p): p is Player => p != null)
        );
        setLoading(false);
        void writePlayersAllCache(cacheKey, list, Date.now());
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        if (!cached) {
          setError(
            (e as Error).message ||
              'Unable to load players. Ensure the backend server is running.'
          );
          setPlayers([]);
        }
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [config, bundleSeason, selectedLeagueId]);

  const rows = useMemo<Row[]>(() => {
    return players.map((player) => {
      const v = player.values;
      const fc = v?.sources?.fantasycalc;
      const ktcv = ktcDisplayValues(player);
      const ownEntry = resolveOwnership(player, playerOwnership);
      const proj = v?.projection;
      return {
        player,
        team: player.team ?? '',
        consensus: v?.blended ?? null,
        trend: fc?.trend_30day ?? null,
        ktc: v?.sources?.ktc?.value ?? null,
        fc: fc?.value ?? null,
        redraft: fc?.redraft_value ?? null,
        vol: fc?.volatility ?? null,
        liq: fc?.trade_frequency ?? null,
        own: ownEntry?.owned ?? null,
        start: ownEntry?.started ?? null,
        avg: player.stats?.average_points ?? null,
        tot: player.stats?.total_points ?? null,
        ros: proj?.proj_ros ?? null,
        projWeek: proj?.proj_week ?? null,
        overallRank: ktcv?.rank ?? null,
        overallTier: ktcv?.overallTier ?? null,
        positionalRank: ktcv?.positionalRank ?? null,
        positionalTier: ktcv?.positionalTier ?? null,
      };
    });
  }, [players, playerOwnership]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    let out = rows;
    if (position !== 'ALL') {
      out = out.filter((r) => (r.player.position ?? '').toUpperCase() === position);
    }
    if (q) {
      out = out.filter(
        (r) =>
          (r.player.playerName ?? '').toLowerCase().includes(q) ||
          (r.player.team ?? '').toLowerCase().includes(q)
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const get = (r: Row): number | null => {
      switch (sortKey) {
        case 'team':
          return null;
        case 'own':
          return r.own;
        case 'start':
          return r.start;
        case 'avg':
          return r.avg;
        case 'tot':
          return r.tot;
        case 'ros':
          return r.ros;
        case 'week':
          return r.projWeek;
        case 'trend':
          return r.trend;
        case 'ktc':
          return r.ktc;
        case 'fc':
          return r.fc;
        case 'redraft':
          return r.redraft;
        case 'vol':
          return r.vol;
        case 'liq':
          return r.liq;
        case 'rankPos':
          return r.positionalRank;
        case 'rank':
          return r.overallRank;
        case 'tierPos':
          return r.positionalTier;
        case 'tier':
          return r.overallTier;
        default:
          return r.consensus;
      }
    };
    // Missing values always sort last, regardless of direction.
    if (sortKey === 'team') {
      return [...out].sort((a, b) => {
        const at = a.team.trim().toUpperCase();
        const bt = b.team.trim().toUpperCase();
        if (!at && !bt) return 0;
        if (!at) return 1;
        if (!bt) return -1;
        return at.localeCompare(bt) * dir;
      });
    }
    return [...out].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [rows, deferredQuery, position, sortKey, sortDir]);

  const onSort = useCallback(
    (key: StatSortKey, defaultDir: 'asc' | 'desc') => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir(defaultDir);
        return;
      }
      const opposite = defaultDir === 'desc' ? 'asc' : 'desc';
      if (sortDir === defaultDir) {
        setSortDir(opposite);
      } else {
        setSortKey(DEFAULT_STAT_SORT_KEY);
        setSortDir(DEFAULT_STAT_SORT_DIR);
      }
    },
    [sortKey, sortDir]
  );

  const dirFor = (key: StatSortKey): SortDirection => (sortKey === key ? sortDir : null);

  return (
    <div className='mx-auto w-full max-w-6xl px-2 sm:px-4'>
      <div className='hd mb-3 text-center text-lg font-semibold text-primary-main sm:text-2xl'>
        All Players
      </div>

      <DashboardSectionMeta showScoring={false} className='mb-3' />

      {/* Controls */}
      <div className='mb-3 flex flex-col gap-2'>
        <div className='flex flex-wrap items-center justify-center gap-2'>
          <PostureToggle
            options={[
              { label: 'Superflex', value: 'superflex' },
              { label: '1QB', value: '1qb' },
            ]}
            value={config.league_format}
            onChange={(v) =>
              setConfig((c) => ({ ...c, league_format: v as KtcConfig['league_format'] }))
            }
          />
          <PostureToggle
            options={[
              { label: 'Dynasty', value: 'false' },
              { label: 'Redraft', value: 'true' },
            ]}
            value={String(config.is_redraft)}
            onChange={(v) => setConfig((c) => ({ ...c, is_redraft: v === 'true' }))}
          />
          <label className='inline-flex items-center gap-1.5 text-[11px] text-ink-mid'>
            <span className='lbl'>TE Premium</span>
            <select value={config.tep_level ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, tep_level: e.target.value as KtcConfig['tep_level'] }))}
              className='rounded-md border border-line bg-surface-overlay px-2 py-1 text-sm text-ink-hi focus:border-cons/50 focus:outline-none'>
              <option value=''>No TEP</option>
              <option value='tep'>TEP (+0.5)</option>
              <option value='tepp'>TEPP (+1.0)</option>
              <option value='teppp'>TEPPP (+1.5)</option>
            </select>
          </label>
        </div>

        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search players or team…'
          className='w-full rounded-md border border-line bg-surface-overlay px-3 py-2 text-sm text-ink-hi placeholder:text-ink-dim focus:border-cons/50 focus:outline-none'
        />

        <div className='flex flex-wrap justify-center gap-1.5'>
          {(['ALL', ...availablePositions(league)]).map((pos) => {
            const active = position === pos;
            return (
              <button
                key={pos}
                type='button'
                onClick={() => setPosition(pos)}
                className={`lbl rounded-full border px-3 py-1 text-[11px] transition-colors ${
                  active ? 'border-transparent text-ink-hi' : 'border-line text-ink-mid hover:text-ink'
                }`}
                style={
                  active
                    ? {
                        backgroundColor:
                          pos === 'ALL' ? 'rgba(255,255,255,0.12)' : positionColorVar(pos),
                      }
                    : undefined
                }
              >
                {pos}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className='rounded-md border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300'>
          {error}
        </div>
      ) : loading ? (
        <div className='px-4 py-10 text-center text-sm text-ink-mid'>Loading players…</div>
      ) : (
        <div className={PLAYER_LIST_SCROLL}>
          <table className='min-w-full border-collapse'>
            <PlayerStatHeader
              variant='all-players'
              showRedraft={config.is_redraft}
              sort={{ dirFor, onSort }}
              projectedWeek={researchMeta?.week ?? null}
            />
            <tbody>
              {visible.map((r, i) => (
                <Fragment key={r.player.player_id ?? i}>
                  <PlayerStatRow player={r.player} variant='all-players' index={i}
                    showRedraft={config.is_redraft} ownershipMap={playerOwnership}
                    expanded={expandedPlayer === r.player.player_id} onClick={togglePlayer} />
                  {expandedPlayer === r.player.player_id && (
                    <tr>
                      <td colSpan={statColumnCount('all-players', config.is_redraft)} className='p-0 align-top'>
                        <div className='player-detail-row w-full'>
                          <div className='sticky left-0 w-[min(100vw,72rem)] max-w-full'>
                            <PlayerDetailContent player={r.player} bundleSeason={bundleSeason}
                              leagueSeason={bundleSeason} researchWeek={r.player.research_latest?.week ?? null}
                              ownershipMap={playerOwnership} compact />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={statColumnCount('all-players', config.is_redraft)}
                    className='px-4 py-10 text-center text-sm text-ink-mid'
                  >
                    No players match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
