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

export type { BracketMatch, BracketSource, KnockoutBracket, KnockoutOptions } from './knockout.js';
export { buildKnockout, nextPowerOfTwo, seedOrder } from './knockout.js';

export type {
  BracketSlotMatch,
  BracketSlotSource,
  MatchSide,
  SlotAssignment,
} from './advancement.js';
export { resolveBracketSlots } from './advancement.js';

export type {
  AdvancingSelection,
  GroupPlacement,
  GroupPlacementRow,
} from './group-advance.js';
export { selectAdvancing } from './group-advance.js';

export type { MatchResultInput, ResultProblem } from './result.js';
export { validateMatchResult } from './result.js';

export type {
  ClubCollision,
  Group,
  GroupCandidate,
  GroupSplit,
  GroupSplitOptions,
} from './groups.js';
export { splitIntoGroups } from './groups.js';

export type { PendingMatch } from './withdrawals.js';
export { applyWithdrawals } from './withdrawals.js';
