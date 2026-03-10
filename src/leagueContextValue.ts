import { createContext } from 'react';
import { LeagueContextType } from './types';

export const LeagueContext = createContext<LeagueContextType | null>(null);
