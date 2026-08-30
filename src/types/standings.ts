import { z } from 'zod';

/**
 * Групповая таблица в ответах API — ТЗ 6.6.
 *
 * Схемы описывают ровно то, что возвращает `calculateStandings` из общего
 * кода. Совпадение стережёт тест: движок считает, схема отдаёт, и разойтись
 * они не должны — иначе консоль в офлайне покажет одно, а сервер другое.
 */

export const standingRowSchema = z.object({
  participant: z.string(),
  played: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
  setsWon: z.number().int().nonnegative(),
  setsLost: z.number().int().nonnegative(),
  setDiff: z.number().int(),
  ballsWon: z.number().int().nonnegative(),
  ballsLost: z.number().int().nonnegative(),
  ballDiff: z.number().int(),
  /** `null`, пока равенство не разрешено судьёй — ADR-008. */
  place: z.number().int().positive().nullable(),
});
export type StandingRowView = z.infer<typeof standingRowSchema>;

/** Участники, которых не удалось разделить правилами 1–5 ТЗ 6.6. */
export const tieGroupSchema = z.object({
  participants: z.array(z.string()),
  /** Места, которые они делят: например `[2, 3, 4]`. */
  places: z.array(z.number().int().positive()),
});
export type TieGroupView = z.infer<typeof tieGroupSchema>;

export const groupStandingsSchema = z.object({
  stageId: z.uuid(),
  /** `null` для круговой схемы без групп. */
  groupId: z.uuid().nullable(),
  label: z.string(),
  rows: z.array(standingRowSchema),
  /**
   * Пока список не пуст, места определены не полностью и турнир не может
   * перейти в «Завершён». Решение принимает судья — ADR-008.
   */
  unresolved: z.array(tieGroupSchema),
});
export type GroupStandingsView = z.infer<typeof groupStandingsSchema>;

export const tournamentStandingsSchema = z.object({
  tournamentId: z.uuid(),
  groups: z.array(groupStandingsSchema),
});
export type TournamentStandingsView = z.infer<typeof tournamentStandingsSchema>;
