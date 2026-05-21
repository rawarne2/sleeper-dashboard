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
} from '../playerFunctions';

const TrendingChip = () => (
  <span className='ml-1 inline-flex items-center rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300'>
    Trending
  </span>
);

const DetailGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className='rounded border border-white/8 bg-white/2 p-2 sm:p-3'>
    <div className='mb-1.5 text-[10px] uppercase tracking-wide text-gray-400'>{title}</div>
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
}

export const PlayerDetailContent = memo(({
  player,
  bundleSeason,
  leagueSeason,
  researchWeek,
  ownershipMap,
  showHeader = false,
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
          {player.depth_chart_position != null && (
            <DetailItem label='Depth' value={player.depth_chart_position} />
          )}
          {player.fantasy_positions && player.fantasy_positions.length > 0 && (
            <DetailItem label='Positions' value={player.fantasy_positions.join(', ')} />
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
          {ktc?.draftYear != null && <DetailItem label='Draft' value={ktc.draftYear} />}
          {pickLabel && <DetailItem label='Draft slot' value={pickLabel} />}
          {ktc?.isTrending && <DetailItem label='Status' value={<TrendingChip />} />}
          {showBye && <DetailItem label='Bye wk' value={ktc?.byeWeek ?? '—'} />}
          {ktcInjury && (
            <DetailItem label='KTC injury' value={ktcInjury} tone='warn' />
          )}
          {ktc?.is_redraft != null && (
            <DetailItem
              label='KTC mode'
              value={ktc.is_redraft ? 'Redraft' : 'Dynasty'}
            />
          )}
          {!ktcValues?.value &&
            ktcValues?.positionalRank == null &&
            ktcValues?.rank == null && (
              <span className='text-xs text-gray-400'>No KTC data</span>
            )}
        </DetailGroup>

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
          {!player.status &&
            !player.injury_status &&
            !player.practice_participation && (
              <span className='text-xs text-gray-400'>Healthy / Active</span>
            )}
        </DetailGroup>
      </div>
    </div>
  );
});

PlayerDetailContent.displayName = 'PlayerDetailContent';
