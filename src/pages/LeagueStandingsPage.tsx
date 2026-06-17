import { useMemo, useState } from 'react';
import { useLeague } from '../useLeague';
import { resolveLeagueKtcConfig } from '../utils/leagueConfig';
import { buildStandingsStatColors } from '../utils/teamStats';
import { TeamPanel } from '../components/TeamPanel';
import { DashboardSectionMeta } from '../components/DashboardSectionMeta';

export default function LeagueStandingsPage() {
  const {
    teamsData,
    playerOwnership,
    league,
    researchMeta,
    bundleSeason,
    championUserId,
  } = useLeague();

  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const handleTeamClick = (rosterId: number) => {
    setExpandedTeam((cur) => (cur === rosterId ? null : rosterId));
    setExpandedPlayer(null);
  };
  const handlePlayerClick = (playerId: string) =>
    setExpandedPlayer((cur) => (cur === playerId ? null : playerId));

  const researchWeek = researchMeta?.week ?? null;
  const showRedraft = resolveLeagueKtcConfig(league).is_redraft;
  const statColors = useMemo(
    () => buildStandingsStatColors(teamsData),
    [teamsData]
  );

  return (
    <div className='bg-surface-raised justify-center rounded-lg'>
      <div className='league-standings-heading text-lg sm:text-2xl font-semibold text-primary-main text-center mt-4 mb-2 sm:mt-6 sm:mb-2.5'>
        League Standings
      </div>
      <DashboardSectionMeta
        showScoring
        showTeams
        className='w-full px-3 sm:px-5 md:px-6 mb-3 sm:mb-4'
      />
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
          statColors={statColors.get(team.roster.roster_id)}
        />
      ))}
    </div>
  );
}
