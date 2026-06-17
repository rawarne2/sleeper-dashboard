import { useLeague } from '../useLeague';
import { formatApiInstant, formatKtcLastUpdatedDate } from '../utils/formatting';
import {
  formatLeagueFormatLabel,
  formatLeagueTypeLabel,
  formatTepLevelLabel,
} from '../utils/leagueConfig';
import { getLeagueStatusInfo } from '../utils/teamStats';

const metaPillBase =
  'lbl inline-flex max-w-full items-baseline gap-1 rounded-full border border-line-soft px-2 py-0.5 text-[11px] leading-tight sm:px-2.5 sm:py-1';

function HeaderPill({
  label,
  value,
  className = 'bg-surface-card',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className={`${metaPillBase} ${className}`} title={`${label}: ${value}`}>
      <span className='lbl shrink-0 text-ink-dim'>{label}:</span>
      <span className='truncate text-ink-mid'>{value}</span>
    </span>
  );
}

export interface DashboardSectionMetaProps {
  /** When false, omit format / dynasty / TEP pills (e.g. All Players toggles). */
  showScoring?: boolean;
  /** Show team count from the loaded league. */
  showTeams?: boolean;
  className?: string;
}

export function DashboardSectionMeta({
  showScoring = true,
  showTeams = false,
  className = '',
}: DashboardSectionMetaProps) {
  const { league, researchMeta, ktcLastUpdated, ktcConfig, loading, bundleSeason } = useLeague();

  const leagueStatus = league ? getLeagueStatusInfo(league.status) : null;
  const researchWeek = researchMeta?.week ?? null;
  const ktcUpdatedLabel = formatKtcLastUpdatedDate(ktcLastUpdated);
  const researchUpdated = researchMeta?.last_updated
    ? formatApiInstant(researchMeta.last_updated)
    : null;
  const seasonLabel = league?.season ?? bundleSeason ?? null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 ${className}`}
      aria-label='League and rankings metadata'
    >
      {leagueStatus && (
        <span className={`${metaPillBase} ${leagueStatus.className}`}>{leagueStatus.label}</span>
      )}
      {seasonLabel && <HeaderPill label='League season' value={seasonLabel} />}
      {showScoring && (
        <>
          <HeaderPill label='Format' value={formatLeagueFormatLabel(ktcConfig.league_format)} />
          <HeaderPill label='Type' value={formatLeagueTypeLabel(league, ktcConfig)} />
          <HeaderPill label='TE premium' value={formatTepLevelLabel(ktcConfig.tep_level)} />
        </>
      )}
      {!loading && researchWeek != null && (
        <span
          className={`${metaPillBase} bg-surface-card text-ink-mid`}
          title={`Sleeper research week ${researchWeek}`}
        >
          <span className='lbl text-ink-dim'>Sleeper week</span> <span>{researchWeek}</span>
        </span>
      )}
      {showTeams && league?.total_rosters != null && (
        <HeaderPill label='Teams' value={String(league.total_rosters)} />
      )}
      {!loading && (
        <>
          {ktcUpdatedLabel && <HeaderPill label='KTC last updated' value={ktcUpdatedLabel} />}
          {researchUpdated && <HeaderPill label='Sleeper updated' value={researchUpdated} />}
        </>
      )}
    </div>
  );
}
