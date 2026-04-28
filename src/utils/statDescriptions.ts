/** Human-readable descriptions for the team stat columns shown on the dashboard. */
export const STAT_DESCRIPTIONS: Record<string, string> = {
  PF: 'Points For: total fantasy points your team has scored this season.',
  PA: 'Points Against: total fantasy points scored against your team this season.',
  'PF/G': 'Points For Per Game: average fantasy points scored per week (PF / games played).',
  'PA/G': 'Points Against Per Game: average points allowed per week (PA / games played).',
  Diff: 'Point Differential: Points For minus Points Against. Positive = better than opponents on average.',
  MaxPF: 'Max Potential Points: total points if the optimal starting lineup had been set every week.',
  'Eff%': 'Manager Efficiency: actual points scored vs. maximum possible (PF / Max PF * 100). Higher = better lineup decisions.',
  Waiv: 'Waiver Priority: current waiver claim order. Lower number = higher priority.',
  FAAB: 'FAAB Spent: Free Agent Acquisition Budget dollars spent this season.',
};
