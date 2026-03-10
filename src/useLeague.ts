import { useContext } from 'react';
import { LeagueContextType } from './types';
import { LeagueContext } from './leagueContextValue';

export const useLeague = (): LeagueContextType => {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
};
