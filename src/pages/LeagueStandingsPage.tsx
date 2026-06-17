import { useState } from 'react';
import { useLeague } from '../useLeague';
import { getLeagueStatusInfo } from '../utils/teamStats';
import { formatKtcLastUpdatedDate, formatApiInstant } from '../utils/formatting';
import { resolveLeagueKtcConfig } from '../utils/leagueConfig';
import { TeamPanel } from '../components/TeamPanel';

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

export default function LeagueStandingsPage() {
  const {
    teamsData,
    playerOwnership,
    league,
    researchMeta,
    bundleSeason,
    ktcLastUpdated,
    championUserId,
    loading,
  } = useLeague();

  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const handleTeamClick = (rosterId: number) => {
    setExpandedTeam((cur) => (cur === rosterId ? null : rosterId));
    setExpandedPlayer(null);
  };
  const handlePlayerClick = (playerId: string) =>
    setExpandedPlayer((cur) => (cur === playerId ? null : playerId));

  const leagueStatus = league ? getLeagueStatusInfo(league.status) : null;
  const researchWeek = researchMeta?.week ?? null;
  const ktcUpdatedLabel = formatKtcLastUpdatedDate(ktcLastUpdated);
  const researchUpdated = researchMeta?.last_updated
    ? formatApiInstant(researchMeta.last_updated)
    : null;
  const showRedraft = resolveLeagueKtcConfig(league).is_redraft;

  return (
    <div className='bg-surface-raised justify-center rounded-lg'>
      <div className='league-standings-heading text-lg sm:text-2xl font-semibold text-primary-main text-center mt-4 mb-2 sm:mt-6 sm:mb-2.5'>
        League Standings
      </div>
      <div
        className='w-full px-3 sm:px-5 md:px-6 mb-3 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 sm:mb-4'
        aria-label='League and rankings metadata'
      >
        {leagueStatus && (
          <span className={`${metaPillBase} ${leagueStatus.className}`}>{leagueStatus.label}</span>
        )}
        {league?.season && <HeaderPill label='League season' value={league.season} />}
        {!loading && researchWeek != null && (
          <span
            className={`${metaPillBase} bg-surface-card text-ink-mid`}
            title={`Sleeper research week ${researchWeek}`}
          >
            <span className='lbl text-ink-dim'>Sleeper week</span> <span>{researchWeek}</span>
          </span>
        )}
        {league?.total_rosters != null && (
          <HeaderPill label='Teams' value={String(league.total_rosters)} />
        )}
        {!loading && (
          <>
            {ktcUpdatedLabel && <HeaderPill label='KTC last updated' value={ktcUpdatedLabel} />}
            {researchUpdated && <HeaderPill label='Sleeper updated' value={researchUpdated} />}
          </>
        )}
      </div>
      {teamsData.map((team, idx) => (
        <TeamPanel
          key={team.roster.roster_id}
          teamData={team}
          index={idx}
          rosterDetailsPending={false}
          champId={championUserId}
          expandedTeam={expandedTeam}
          onTeamClick={handleTeamClick}
          expandedPlayer={expandedPlayer}
          onPlayerClick={handlePlayerClick}
          playerOwnership={playerOwnership}
          bundleSeason={bundleSeason}
          leagueSeason={league?.season ?? null}
          researchWeek={researchWeek}
          showRedraft={showRedraft}
        />
      ))}
    </div>
  );
}
