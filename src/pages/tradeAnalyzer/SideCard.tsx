import { useMemo } from 'react';
import type { Player, TeamData, TradeAnalyzerPick } from '../../types';
import { pickAssetKey } from '../../services/tradeAnalyzer';
import {
  ktcValueForPlayer,
  playerDisplayName,
  playerRankLabel,
} from '../../services/tradeAnalyzerStorage';
import {
  toneForSide,
  tradeValueToneClass,
  TradeAssetTag,
} from '../../components/tradeAnalyzer/tradeAssetUi';
import {
  avatarUrl,
  groupPlayersByPosition,
  pickLabel,
  teamDisplayName,
  teamSubtitle,
} from './helpers';

export function SideCard(props: {
  title: string;
  side: 'a' | 'b';
  disabled: boolean;
  teams: TeamData[];
  selectedRosterId: number | null;
  otherRosterId: number | null;
  selectedPlayerIds: Set<string>;
  selectedPlayers: Player[];
  picksToAdd: TradeAnalyzerPick[];
  ownedPickCount: number;
  selectedPickKeys: Set<string>;
  selectedPicks: TradeAnalyzerPick[];
  subtotal: number;
  otherSubtotal: number;
  isTanking: boolean;
  onActive: () => void;
  onRosterChange: (rosterId: number | null) => void;
  onTogglePlayer: (playerId: string) => void;
  onTogglePick: (pickKey: string) => void;
  onTankingChange: (value: boolean) => void;
  onClear: () => void;
  onOpenPlayerDetail: (player: Player) => void;
}) {
  const selectedTeam =
    props.selectedRosterId != null
      ? props.teams.find((t) => t.roster.roster_id === props.selectedRosterId) ?? null
      : null;

  const groupedPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return groupPlayersByPosition(selectedTeam.players);
  }, [selectedTeam]);

  const valueTone = toneForSide(props.subtotal, props.otherSubtotal);

  return (
    <div
      className='rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4'
      onMouseDown={props.onActive}
      onFocusCapture={props.onActive}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='text-sm sm:text-base font-semibold text-gray-100'>{props.title}</div>
        <button
          type='button'
          className='btn-ghost text-xs sm:text-sm text-gray-400 hover:text-white'
          onClick={props.onClear}
          disabled={
            props.disabled ||
            props.selectedRosterId == null ||
            (props.selectedPlayers.length === 0 && props.selectedPicks.length === 0)
          }
        >
          Clear
        </button>
      </div>

      <div className='mt-2'>
        <label className='block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400'>
          Team
        </label>
        <select
          disabled={props.disabled}
          className='mt-1 w-full rounded-lg border border-white/10 bg-[#0b1624] px-3 py-2 text-xs sm:text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
          value={props.selectedRosterId ?? ''}
          onChange={(ev) => {
            const v = ev.target.value;
            props.onRosterChange(v ? Number(v) : null);
          }}
        >
          <option value=''>Select a team</option>
          {props.teams.map((t) => {
            const rid = t.roster.roster_id;
            const disabledOpt = props.otherRosterId != null && props.otherRosterId === rid;
            return (
              <option key={rid} value={rid} disabled={disabledOpt}>
                {teamDisplayName(t)} ({teamSubtitle(t)})
              </option>
            );
          })}
        </select>
      </div>

      {selectedTeam ? (
        <>
          <div className='mt-3 rounded-lg border border-white/10 bg-white/5 p-2'>
            <div className='flex items-center gap-2'>
              <div className='h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/5'>
                {selectedTeam.user.avatar ? (
                  <img
                    alt={selectedTeam.user.display_name}
                    src={avatarUrl(selectedTeam.user.avatar) ?? undefined}
                    className='h-full w-full object-cover'
                  />
                ) : (
                  <div className='flex h-full w-full items-center justify-center text-[10px] text-gray-400'>
                    N/A
                  </div>
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='truncate text-xs sm:text-sm font-semibold text-gray-100'>
                  {teamDisplayName(selectedTeam)}
                </div>
                <div className='truncate text-[10px] sm:text-xs text-gray-400'>
                  {teamSubtitle(selectedTeam)}
                </div>
              </div>
              <div
                className='posture-toggle-group'
                role='radiogroup'
                aria-label={`${props.title} posture`}
              >
                {(['contending', 'tanking'] as const).map((value) => {
                  const active = props.isTanking === (value === 'tanking');
                  return (
                    <button
                      key={value}
                      type='button'
                      role='radio'
                      aria-checked={active}
                      disabled={props.disabled}
                      onClick={() => props.onTankingChange(value === 'tanking')}
                      className={
                        active ? 'posture-toggle posture-toggle--active' : 'posture-toggle'
                      }
                    >
                      {value === 'tanking' ? 'Tanking' : 'Contending'}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className='mt-2'>
              <label
                htmlFor={`trade-side-${props.side}-asset-select`}
                className='sr-only'
              >
                Add player or pick to {props.title}
              </label>
              <select
                id={`trade-side-${props.side}-asset-select`}
                aria-label={`Add player or pick to ${props.title}`}
                disabled={props.disabled}
                className='w-full rounded-lg border border-white/10 bg-[#0b1624] px-3 py-2 text-xs sm:text-sm text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main disabled:opacity-60'
                value=''
                onChange={(ev) => {
                  const v = ev.target.value;
                  if (!v) return;
                  if (v.startsWith('pick:')) {
                    const key = v.slice(5);
                    const allowed = new Set(props.picksToAdd.map((p) => pickAssetKey(p)));
                    if (allowed.has(key)) props.onTogglePick(key);
                  } else if (v.startsWith('player:')) {
                    const id = v.slice(7);
                    if (id && !props.selectedPlayerIds.has(id)) {
                      props.onTogglePlayer(id);
                    }
                  }
                  ev.currentTarget.value = '';
                }}
              >
                <option value=''>Add player or draft pick…</option>
                {groupedPlayers.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.players.map((p) => {
                      const id = p.player_id;
                      if (!id) return null;
                      const name = playerDisplayName(p);
                      const ktc = ktcValueForPlayer(p);
                      const already = props.selectedPlayerIds.has(id);
                      const label = ktc > 0 ? `${name} (${ktc})` : name;
                      return (
                        <option
                          key={id}
                          value={`player:${id}`}
                          disabled={already}
                        >
                          {label}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
                {props.ownedPickCount > 0 && props.picksToAdd.length > 0 ? (
                  <optgroup label='Draft picks'>
                    {props.picksToAdd.map((p) => {
                      const assetKey = pickAssetKey(p);
                      const label = pickLabel(p);
                      const ktc = p.ktc_value ?? 0;
                      return (
                        <option key={assetKey} value={`pick:${assetKey}`}>
                          {ktc ? `${label} (${ktc})` : label}
                        </option>
                      );
                    })}
                  </optgroup>
                ) : null}
              </select>
              {props.ownedPickCount === 0 ? (
                <p className='mt-1.5 text-xs text-gray-400 sm:text-sm'>
                  No owned draft picks for this team yet. Refresh league data from Sleeper
                  so traded picks sync, then reload the dashboard.
                </p>
              ) : null}
            </div>
          </div>

          <div className='mt-3'>
            <div className='flex items-center justify-between gap-2'>
              <div className='text-base font-semibold text-gray-100 sm:text-lg'>
                Trading away
              </div>
              <div
                className={`text-lg font-bold tabular-nums sm:text-xl ${tradeValueToneClass(valueTone)}`}
              >
                {props.subtotal.toLocaleString()}
              </div>
            </div>
            {props.selectedPlayers.length === 0 && props.selectedPicks.length === 0 ? (
              <div className='mt-2 text-xs text-gray-400 sm:text-sm'>No assets yet.</div>
            ) : (
              <div className='mt-2 space-y-1.5'>
                {props.selectedPlayers.map((p) => {
                  const name = playerDisplayName(p);
                  const ktc = ktcValueForPlayer(p);
                  return (
                    <TradeAssetTag
                      key={p.player_id}
                      showPosition={false}
                      asset={{
                        key: p.player_id ?? name,
                        name,
                        position: p.position,
                        ktc,
                        rankLabel: playerRankLabel(p),
                      }}
                      valueTone={valueTone}
                      onRemove={() => p.player_id && props.onTogglePlayer(p.player_id)}
                      removeLabel={`Remove ${name} from ${props.title}`}
                      onOpenDetail={() => props.onOpenPlayerDetail(p)}
                      detailLabel={`View details for ${name}`}
                    />
                  );
                })}
                {props.selectedPicks.map((p) => {
                  const assetKey = pickAssetKey(p);
                  const label = pickLabel(p);
                  const ktc = p.ktc_value ?? 0;
                  return (
                    <TradeAssetTag
                      key={assetKey}
                      isPick
                      asset={{
                        key: assetKey,
                        name: label,
                        ktc,
                        rankLabel: null,
                      }}
                      valueTone={valueTone}
                      onRemove={() => props.onTogglePick(assetKey)}
                      removeLabel={`Remove ${label} from ${props.title}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
