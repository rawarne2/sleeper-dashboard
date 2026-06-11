import React, { memo } from 'react';
import {
  UserIcon,
  AcademicCapIcon,
  CalendarIcon,
  CakeIcon,
} from '@heroicons/react/24/outline';
import type { Player } from '../types';
import { formatBirthDate, formatHeight, getOwnershipTier } from '../utils/teamStats';
import { formatPoints } from '../utils/formatting';
import {
  formatKtcInjury,
  ktcDisplayValues,
  showByeForSeason,
  valueSources,
  blendedValue,
  resolveInjury,
} from '../playerFunctions';

const TrendingChip = () => (
  <span className='ml-1 inline-flex items-center rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300'>
    Trending
  </span>
);

const detailGroupShell = (compact: boolean) =>
  compact
    ? 'rounded border border-white/8 bg-white/2 px-1.5 py-1.5'
    : 'rounded border border-white/8 bg-white/2 p-2 sm:p-3';

const DetailGroup = ({
  title,
  children,
  compact = false,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) => (
  <div className={detailGroupShell(compact)}>
    <div className='mb-1.5 text-[11px] uppercase tracking-wide text-gray-400'>{title}</div>
    <div className='flex flex-col gap-1 text-sm'>{children}</div>
  </div>
);

const DetailItem = ({
  Icon,
  label,
  value,
  tone = 'default',
}: {
  Icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'warn' | 'danger';
}) => {
  const toneClass =
    tone === 'danger'
      ? 'text-red-400'
      : tone === 'warn'
        ? 'text-yellow-300'
        : 'text-gray-100';
  return (
    <div className='flex items-center gap-2'>
      {Icon && (
        <Icon
          className={`h-4 w-4 ${
            tone === 'danger'
              ? 'text-red-500'
              : tone === 'warn'
                ? 'text-yellow-500'
                : 'text-primary-main'
          }`}
        />
      )}
      <span className='text-xs text-gray-400'>{label}:</span>
      <span className={`text-sm ${toneClass}`}>{value}</span>
    </div>
  );
};

/** Label-over-value cell for the static profile grid (roster expand). */
const StaticField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className='flex min-w-0 flex-col gap-0.5'>
    <span className='lbl text-[11px] text-ink-mid'>{label}</span>
    <span className='truncate text-sm text-ink-hi' title={typeof value === 'string' ? value : undefined}>
      {value == null || value === '' ? '—' : value}
    </span>
  </div>
);

function resolveOwnership(
  player: Player,
  ownershipMap?: Record<string, { owned: number; started?: number }>
) {
  if (player.owned != null) {
    return { owned: player.owned, started: player.started ?? null };
  }
  const id = player.player_id;
  if (id && ownershipMap?.[id]) {
    const o = ownershipMap[id];
    return { owned: o.owned, started: o.started ?? null };
  }
  const rl = player.research_latest;
  if (rl?.owned != null) {
    return { owned: rl.owned, started: rl.started ?? null };
  }
  return null;
}

export interface PlayerDetailContentProps {
  player: Player;
  bundleSeason: string | null;
  leagueSeason: string | null;
  researchWeek?: number | null;
  ownershipMap?: Record<string, { owned: number; started?: number }>;
  /** Show name + position chip (modal); roster expand row omits this. */
  showHeader?: boolean;
  /** Denser layout for roster table expand rows. */
  compact?: boolean;
}

export const PlayerDetailContent = memo(({
  player,
  bundleSeason,
  leagueSeason,
  researchWeek,
  ownershipMap,
  showHeader = false,
  compact = false,
}: PlayerDetailContentProps) => {
  const ktc = player.ktc;
  const ktcValues = ktcDisplayValues(player);
  const ktcInjury = formatKtcInjury(ktc?.injury);
  const showBye = showByeForSeason(bundleSeason, leagueSeason) && ktc?.byeWeek != null;
  const stats = player.stats;
  const ownership = resolveOwnership(player, ownershipMap);
  const pickLabel =
    ktc?.pickRound != null && ktc?.pickNum != null
      ? `Rd ${ktc.pickRound} · Pick ${ktc.pickNum}`
      : ktc?.pickRound != null
        ? `Rd ${ktc.pickRound}`
        : ktc?.pickNum != null
          ? `Pick ${ktc.pickNum}`
          : null;

  const displayName =
    player.playerName?.trim() ||
    [player.first_name, player.last_name].filter(Boolean).join(' ') ||
    'Unknown player';

  const hasStatusContent =
    (player.status && player.status !== 'Active') ||
    !!player.injury_status ||
    !!player.injury_notes ||
    !!player.practice_participation ||
    !!ktcInjury;

  // Static-profile derivations (roster expand) — bio/draft only, no dynamic data.
  const injury = resolveInjury(player);
  const expValue =
    player.years_exp != null
      ? player.years_exp === 0
        ? 'Rookie'
        : `${player.years_exp} yr${player.years_exp !== 1 ? 's' : ''}`
      : '—';
  const draftedValue =
    ktc?.draftYear != null && pickLabel
      ? `${ktc.draftYear} · ${pickLabel}`
      : ktc?.draftYear != null
        ? String(ktc.draftYear)
        : pickLabel ?? '—';
  const depthLabel =
    player.depth_chart_order != null
      ? `${player.position ?? player.depth_chart_position ?? ''}${player.depth_chart_order}`
      : player.depth_chart_position ?? '—';
  const birthplace = [player.birth_city, player.birth_state].filter(Boolean).join(', ') || '—';
  const positionsValue =
    player.fantasy_positions && player.fantasy_positions.length > 0
      ? player.fantasy_positions.join(', ')
      : player.position ?? '—';

  return (
    <div className={showHeader ? 'space-y-3' : undefined}>
      {showHeader ? (
        <div className='flex flex-wrap items-center gap-2 pr-8'>
          <span className={`player-chip player-chip-${player.position || 'DEF'}`}>
            {player.position || 'N/A'}
          </span>
          <h3 className='text-base font-semibold text-gray-100 sm:text-lg'>{displayName}</h3>
        </div>
      ) : null}

      {compact ? (
        <div className='flex flex-col gap-2'>
          <div className='grid grid-cols-2 gap-x-3 gap-y-2 rounded border border-line bg-white/[0.02] px-2.5 py-2 sm:grid-cols-3 md:grid-cols-4'>
            <StaticField label='Age' value={player.age ?? '—'} />
            <StaticField label='Exp' value={expValue} />
            <StaticField label='Height' value={formatHeight(player)} />
            <StaticField label='Weight' value={player.weight ? `${player.weight} lbs` : '—'} />
            <StaticField label='College' value={player.college ?? '—'} />
            <StaticField label='Drafted' value={draftedValue} />
            <StaticField label='Depth' value={depthLabel} />
            <StaticField label='Bye' value={showBye ? (ktc?.byeWeek ?? '—') : '—'} />
            <StaticField
              label='Birth date'
              value={player.birth_date ? formatBirthDate(player.birth_date) : '—'}
            />
            <StaticField label='Birthplace' value={birthplace} />
            <StaticField label='Positions' value={positionsValue} />
            <StaticField label='Status' value={player.status || 'Active'} />
            <StaticField label='Rookie yr' value={player.rookie_year ?? '—'} />
            <StaticField label='High school' value={player.high_school ?? '—'} />
            <StaticField label='Jersey' value={player.number != null ? `#${player.number}` : '—'} />
            <StaticField label='Team' value={player.team || 'FA'} />
          </div>
          {injury && (
            <div
              className={`flex items-baseline gap-2 rounded border px-2.5 py-1.5 text-sm ${
                injury.severity === 'danger'
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              }`}
            >
              <span className='lbl shrink-0 text-[11px] text-ink-mid'>Injury · {injury.source}</span>
              <span className='min-w-0'>{injury.text}</span>
            </div>
          )}
        </div>
      ) : (
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3'>
        <DetailGroup title='Profile'>
          <DetailItem
            Icon={UserIcon}
            label='#'
            value={`${player.number ?? 'N/A'} · ${player.team || 'Free Agent'}`}
          />
          <DetailItem
            Icon={CalendarIcon}
            label='Exp'
            value={`${player.years_exp ?? 0} yr${(player.years_exp ?? 0) !== 1 ? 's' : ''}`}
          />
          <DetailItem Icon={CakeIcon} label='Age' value={player.age ?? 'N/A'} />
          {player.birth_date && (
            <DetailItem
              Icon={CakeIcon}
              label='DOB'
              value={formatBirthDate(player.birth_date)}
            />
          )}
          <DetailItem Icon={CakeIcon} label='Height' value={formatHeight(player)} />
          <DetailItem
            Icon={CakeIcon}
            label='Weight'
            value={`${player.weight ?? 'N/A'} lbs`}
          />
          <DetailItem
            Icon={AcademicCapIcon}
            label='College'
            value={player.college ?? 'N/A'}
          />
          {(player.depth_chart_order != null || player.depth_chart_position != null) && (
            <DetailItem label='Depth' value={depthLabel} />
          )}
          {player.fantasy_positions && player.fantasy_positions.length > 0 && (
            <DetailItem label='Positions' value={player.fantasy_positions.join(', ')} />
          )}
          {(player.birth_city || player.birth_state) && (
            <DetailItem label='Birthplace' value={birthplace} />
          )}
          {player.rookie_year != null && (
            <DetailItem label='Rookie yr' value={player.rookie_year} />
          )}
          {player.high_school && (
            <DetailItem Icon={AcademicCapIcon} label='High school' value={player.high_school} />
          )}
        </DetailGroup>

        <DetailGroup title='KTC'>
            {ktcValues?.value != null && (
              <DetailItem label='Value' value={ktcValues.value.toLocaleString()} />
            )}
            {(ktcValues?.positionalRank != null || ktcValues?.rank != null) && (
              <DetailItem
                label='Rank'
                value={
                  <>
                    {player.position} {ktcValues?.positionalRank ?? '—'}
                    <span className='text-gray-400'>
                      {' '}
                      · OVR {ktcValues?.rank ?? '—'}
                    </span>
                  </>
                }
              />
            )}
            {(ktcValues?.positionalTier != null || ktcValues?.overallTier != null) && (
              <DetailItem
                label='Tier'
                value={
                  <>
                    {player.position} T{ktcValues?.positionalTier ?? '—'}
                    <span className='text-gray-400'>
                      {' '}
                      · OVR T{ktcValues?.overallTier ?? '—'}
                    </span>
                  </>
                }
              />
            )}
            {(ktc?.draftYear != null || pickLabel) && (
              <DetailItem
                label='Draft'
                value={
                  ktc?.draftYear != null && pickLabel
                    ? `${ktc.draftYear} · ${pickLabel}`
                    : ktc?.draftYear ?? pickLabel
                }
              />
            )}
            {ktc?.isTrending && <DetailItem label='Status' value={<TrendingChip />} />}
            {showBye && <DetailItem label='Bye wk' value={ktc?.byeWeek ?? '—'} />}
            {ktcInjury && <DetailItem label='KTC injury' value={ktcInjury} tone='warn' />}
            {!ktcValues?.value &&
              ktcValues?.positionalRank == null &&
              ktcValues?.rank == null && (
                <span className='text-xs text-gray-400'>No KTC data</span>
              )}
        </DetailGroup>

        {player.values && (
          <DetailGroup title='Sources'>
            <DetailItem label='Consensus' value={blendedValue(player)?.toLocaleString() ?? '—'} />
            {valueSources(player).map((s) => (
              <DetailItem key={s.key} label={s.label} value={s.value?.toLocaleString() ?? '—'} />
            ))}
            {player.values.sources?.fantasycalc?.trade_frequency != null && (
              <DetailItem label='FC liquidity'
                value={`${(player.values.sources.fantasycalc.trade_frequency * 100).toFixed(2)}%`} />
            )}
            {player.values.projection?.proj_week != null && (
              <DetailItem label='Sleeper proj (wk)'
                value={player.values.projection.proj_week.toFixed(1)} />
            )}
          </DetailGroup>
        )}

        {(stats?.average_points != null ||
            stats?.total_points != null ||
            stats?.games_played != null) && (
            <DetailGroup title='Season stats'>
              <DetailItem label='Avg' value={formatPoints(stats?.average_points)} />
              <DetailItem label='Total' value={formatPoints(stats?.total_points)} />
              <DetailItem label='GP' value={stats?.games_played ?? '—'} />
            </DetailGroup>
          )}

        {(ownership?.owned != null || ownership?.started != null) && (
            <DetailGroup title='Ownership'>
              {researchWeek != null && (
                <DetailItem label='Week' value={`Wk ${researchWeek}`} />
              )}
              {ownership?.owned != null && (
                <DetailItem
                  label='Owned'
                  value={
                    <span
                      className={`font-medium tabular-nums ${getOwnershipTier(ownership.owned)}`}
                    >
                      {ownership.owned}%
                    </span>
                  }
                />
              )}
              {ownership?.started != null && (
                <DetailItem
                  label='Started'
                  value={
                    <span
                      className={`font-medium tabular-nums ${getOwnershipTier(ownership.started)}`}
                    >
                      {ownership.started}%
                    </span>
                  }
                />
              )}
            </DetailGroup>
          )}

        {hasStatusContent && (
          <DetailGroup title='Status'>
            {player.status && player.status !== 'Active' && (
              <DetailItem
                label='Roster'
                value={
                  <span className='inline-block rounded border border-yellow-500/30 bg-yellow-500/20 px-1.5 py-0.5 text-xs font-medium text-yellow-400'>
                    {player.status}
                  </span>
                }
                tone='warn'
              />
            )}
            {player.injury_status && (
              <DetailItem
                label='Injury'
                value={
                  player.injury_body_part
                    ? `${player.injury_status} — ${player.injury_body_part}`
                    : player.injury_status
                }
                tone='danger'
              />
            )}
            {player.injury_notes && (
              <DetailItem label='Injury notes' value={player.injury_notes} tone='warn' />
            )}
            {player.practice_participation && (
              <DetailItem
                label='Practice'
                value={
                  player.practice_description
                    ? `${player.practice_participation} — ${player.practice_description}`
                    : player.practice_participation
                }
                tone='warn'
              />
            )}
            {ktcInjury && <DetailItem label='KTC injury' value={ktcInjury} tone='warn' />}
          </DetailGroup>
        )}
      </div>
      )}
    </div>
  );
});

PlayerDetailContent.displayName = 'PlayerDetailContent';
