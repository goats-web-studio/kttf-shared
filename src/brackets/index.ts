export type {
  MatchOutcome,
  ParticipantId,
  PlayedMatch,
  ScheduledMatch,
  Standings,
  StandingsOptions,
  StandingRow,
  TieGroup,
} from './types.js';

export { countRoundRobinMatches, countRounds, scheduleRoundRobin } from './round-robin.js';
export { ABSENT_POINTS, calculateStandings, LOSS_POINTS, WIN_POINTS } from './standings.js';
