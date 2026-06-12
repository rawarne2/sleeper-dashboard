import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { KtcConfig, Player } from '../types';
import { API_CONFIG, buildApiUrl } from '../apiConfig';
import { useLeague } from '../useLeague';
import { mapBackendPlayerRow, ktcDisplayValues } from '../playerFunctions';
import { ktcConfigParams } from '../utils/leagueConfig';
import { POSITION_ORDER, positionColorVar } from '../utils/valueDisplay';
import { type SortDirection } from '../components/playerTable/ColumnHeader';
import { PlayerStatHeader, type StatSortKey } from '../components/playerTable/PlayerStatHeader';
import { PlayerStatRow } from '../components/playerTable/PlayerStatRow';
import { statColumnCount } from '../components/playerTable/layout';

interface Row {
  player: Player;
  consensus: number | null;
  redraft: number | null;
  vol: number | null;
  liq: number | null;
  own: number | null;
  overallRank: number | null;
  overallTier: number | null;
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
  const { ktcConfig, playerOwnership, bundleSeason } = useLeague();

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
  const [sortKey, setSortKey] = useState<StatSortKey>('consensus');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PLAYERS_ALL, {
      ...ktcConfigParams(config),
      ...(bundleSeason ? { season: bundleSeason } : {}),
    });
    (async () => {
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
        const mapped = list
          .map((p) => mapBackendPlayerRow(p as Parameters<typeof mapBackendPlayerRow>[0]))
          .filter((p): p is Player => p != null);
        setPlayers(mapped);
        setLoading(false);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError(
          (e as Error).message ||
            'Unable to load players. Ensure the backend server is running.'
        );
        setPlayers([]);
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [config, bundleSeason]);

  const rows = useMemo<Row[]>(() => {
    return players.map((player) => {
      const v = player.values;
      const fc = v?.sources?.fantasycalc;
      const ktcv = ktcDisplayValues(player);
      const ownEntry = player.player_id ? playerOwnership[player.player_id] : undefined;
      return {
        player,
        consensus: v?.blended ?? null,
        redraft: fc?.redraft_value ?? null,
        vol: fc?.volatility ?? null,
        liq: fc?.trade_frequency ?? null,
        own: ownEntry?.owned ?? player.research_latest?.owned ?? null,
        overallRank: ktcv?.rank ?? null,
        overallTier: ktcv?.overallTier ?? null,
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
        case 'redraft':
          return r.redraft;
        case 'vol':
          return r.vol;
        case 'liq':
          return r.liq;
        case 'rank':
          return r.overallRank;
        case 'tier':
          return r.overallTier;
        case 'own':
          return r.own;
        default:
          return r.consensus;
      }
    };
    // Missing values always sort last, regardless of direction.
    return [...out].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [rows, deferredQuery, position, sortKey, sortDir]);

  const onSort = useCallback((key: StatSortKey, defaultDir: 'asc' | 'desc') => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(defaultDir);
      return key;
    });
  }, []);

  const dirFor = (key: StatSortKey): SortDirection => (sortKey === key ? sortDir : null);

  return (
    <div className='mx-auto w-full max-w-6xl px-2 sm:px-4'>
      <div className='hd mb-3 text-center text-lg font-semibold text-primary-main sm:text-2xl'>
        All Players
      </div>

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
          <PostureToggle
            options={[
              { label: 'TEP', value: 'tep' },
              { label: 'No TEP', value: '' },
            ]}
            value={config.tep_level === '' ? '' : 'tep'}
            onChange={(v) => setConfig((c) => ({ ...c, tep_level: v as KtcConfig['tep_level'] }))}
          />
        </div>

        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search players or team…'
          className='w-full rounded-md border border-line bg-surface-overlay px-3 py-2 text-sm text-ink-hi placeholder:text-ink-dim focus:border-cons/50 focus:outline-none'
        />

        <div className='flex flex-wrap justify-center gap-1.5'>
          {(['ALL', ...POSITION_ORDER] as const).map((pos) => {
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
        <div className='overflow-x-auto rounded-md border border-line-soft bg-surface-raised'>
          <table className='min-w-full border-collapse'>
            <PlayerStatHeader
              variant='all-players'
              showRedraft={config.is_redraft}
              sort={{ dirFor, onSort }}
            />
            <tbody>
              {visible.map((r, i) => (
                <PlayerStatRow
                  key={r.player.player_id ?? i}
                  player={r.player}
                  variant='all-players'
                  index={i}
                  showRedraft={config.is_redraft}
                  ownershipMap={playerOwnership}
                />
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
