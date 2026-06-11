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
import {
  FALLBACK_KTC_CONFIG,
  ktcConfigParams,
  resolveLeagueKtcConfig,
} from '../utils/leagueConfig';
import {
  formatValue,
  formatDecimal,
  POSITION_ORDER,
  positionColorVar,
  sourceMeta,
} from '../utils/valueDisplay';
import { getOwnershipTier } from '../utils/teamStats';
import { ColumnHeader, type SortDirection } from '../components/playerTable/ColumnHeader';
import { PositionBadge } from '../components/playerTable/PositionBadge';
import { NumCell, TrendCell } from '../components/playerTable/cells';

type SortKey = 'rank' | 'consensus' | 'ktc' | 'fc' | 'trend' | 'own' | 'ros';

const cellPad = 'px-1.5 py-1.5';
const GROUP_EDGE = 'border-l border-line';

interface Row {
  player: Player;
  consensus: number | null;
  ktc: number | null;
  fc: number | null;
  trend: number | null;
  own: number | null;
  ros: number | null;
  overallRank: number | null;
  posRank: string;
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
  const { league, playerOwnership, bundleSeason } = useLeague();

  // Default league type = the in-context league's detected config, else fallback.
  const [config, setConfig] = useState<KtcConfig>(() =>
    league ? resolveLeagueKtcConfig(league) : { ...FALLBACK_KTC_CONFIG }
  );

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [position, setPosition] = useState<'ALL' | string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('consensus');
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
        const body = (await res.json()) as { players?: unknown[] };
        const list = Array.isArray(body.players) ? body.players : [];
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
        ktc: v?.sources?.ktc?.value ?? null,
        fc: fc?.value ?? null,
        trend: fc?.trend_30day ?? null,
        own: ownEntry?.owned ?? player.research_latest?.owned ?? null,
        ros: v?.projection?.proj_ros ?? null,
        overallRank: ktcv?.rank ?? null,
        posRank:
          ktcv?.positionalRank != null ? `${player.position}${ktcv.positionalRank}` : '—',
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
    const get = (r: Row): number => {
      switch (sortKey) {
        case 'rank':
          return r.overallRank ?? Number.POSITIVE_INFINITY * -dir;
        case 'ktc':
          return r.ktc ?? -Infinity;
        case 'fc':
          return r.fc ?? -Infinity;
        case 'trend':
          return r.trend ?? -Infinity;
        case 'own':
          return r.own ?? -Infinity;
        case 'ros':
          return r.ros ?? -Infinity;
        default:
          return r.consensus ?? -Infinity;
      }
    };
    return [...out].sort((a, b) => (get(a) - get(b)) * dir);
  }, [rows, deferredQuery, position, sortKey, sortDir]);

  const onSort = useCallback(
    (key: SortKey, defaultDir: 'asc' | 'desc') => {
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          return prev;
        }
        setSortDir(defaultDir);
        return key;
      });
    },
    []
  );

  const dirFor = (key: SortKey): SortDirection => (sortKey === key ? sortDir : null);

  const SortTh = ({
    label,
    tip,
    k,
    defaultDir = 'desc',
    edge = false,
  }: {
    label: string;
    tip: string;
    k: SortKey;
    defaultDir?: 'asc' | 'desc';
    edge?: boolean;
  }) => (
    <th className={`${cellPad} ${edge ? GROUP_EDGE : ''}`} scope='col'>
      <ColumnHeader
        label={label}
        tooltip={tip}
        sortable
        sortDirection={dirFor(k)}
        onSort={() => onSort(k, defaultDir)}
      />
    </th>
  );

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
            onChange={(v) =>
              setConfig((c) => ({ ...c, tep_level: v as KtcConfig['tep_level'] }))
            }
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
                  active
                    ? 'border-transparent text-ink-hi'
                    : 'border-line text-ink-mid hover:text-ink'
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
            <thead className='sticky top-0 z-20 bg-surface-header'>
              <tr className='border-b border-line'>
                <th className={`${cellPad} text-right`} scope='col'>
                  <ColumnHeader label='#' tooltip='Row number in the current sort' align='right' />
                </th>
                <th
                  className={`${cellPad} sticky left-0 z-30 bg-surface-header text-left`}
                  scope='col'
                >
                  <ColumnHeader label='Player' tooltip='Player name' align='left' />
                </th>
                <th className={cellPad} scope='col'>
                  <ColumnHeader label='Pos' tooltip='Position' />
                </th>
                <th className={cellPad} scope='col'>
                  <ColumnHeader label='Team' tooltip='NFL team' />
                </th>
                <SortTh
                  label='Consensus'
                  tip='Consensus value — average of KTC and FantasyCalc'
                  k='consensus'
                  edge
                />
                <SortTh label='KTC' tip='KeepTradeCut value' k='ktc' />
                <SortTh label='FC' tip='FantasyCalc value' k='fc' />
                <SortTh label='30D' tip='30-day FantasyCalc trend' k='trend' />
                <SortTh label='Own' tip='Ownership % (from the loaded league, if any)' k='own' edge />
                <SortTh label='ROS' tip='Rest-of-season projected points' k='ros' />
                <SortTh label='Rank' tip='KTC positional rank · sort by overall rank' k='rank' defaultDir='asc' edge />
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr
                  key={r.player.player_id ?? i}
                  className='group border-b border-white/5 hover:bg-white/[0.04]'
                >
                  <td className={`${cellPad} text-right`}>
                    <NumCell tone='muted'>{i + 1}</NumCell>
                  </td>
                  <td
                    className={`${cellPad} sticky left-0 z-10 bg-[#0e2034] group-hover:bg-[#162640] border-r border-line`}
                  >
                    <span className='truncate text-sm font-medium text-ink-hi'>
                      {r.player.playerName}
                    </span>
                  </td>
                  <td className={`${cellPad} text-center`}>
                    <PositionBadge position={r.player.position} />
                  </td>
                  <td className={`${cellPad} text-center`}>
                    <NumCell tone='muted'>{r.player.team || '—'}</NumCell>
                  </td>
                  <td className={`${cellPad} text-center ${GROUP_EDGE}`}>
                    <span className='num text-sm font-semibold text-ink-hi'>
                      {formatValue(r.consensus)}
                    </span>
                  </td>
                  <td className={`${cellPad} text-center`}>
                    <span className={`num text-sm ${sourceMeta('ktc')?.textClass}`}>
                      {formatValue(r.ktc)}
                    </span>
                  </td>
                  <td className={`${cellPad} text-center`}>
                    <span className={`num text-sm ${sourceMeta('fantasycalc')?.textClass}`}>
                      {formatValue(r.fc)}
                    </span>
                  </td>
                  <td className={`${cellPad} text-center`}>
                    <TrendCell trend30={r.trend} />
                  </td>
                  <td className={`${cellPad} text-center ${GROUP_EDGE}`}>
                    {r.own != null ? (
                      <span className={`num text-sm font-medium ${getOwnershipTier(r.own)}`}>
                        {r.own}%
                      </span>
                    ) : (
                      <NumCell tone='muted'>—</NumCell>
                    )}
                  </td>
                  <td className={`${cellPad} text-center`}>
                    <NumCell>{formatDecimal(r.ros)}</NumCell>
                  </td>
                  <td className={`${cellPad} text-center ${GROUP_EDGE}`}>
                    <NumCell tone='strong'>{r.posRank}</NumCell>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={11} className='px-4 py-10 text-center text-sm text-ink-mid'>
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
