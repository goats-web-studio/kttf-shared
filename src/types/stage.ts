import { z } from 'zod';

/**
 * Этапы, группы и встречи в ответах API — ТС 4.1.
 *
 * Один и тот же набор читают публичная страница результатов (ТЗ 9.4), второй
 * экран (ТС 7.7) и консоль судьи, поэтому он описан один раз здесь.
 */

export const stageTypeSchema = z.enum(['GROUPS', 'KNOCKOUT', 'ROUND_ROBIN', 'CONSOLATION']);
export type StageType = z.infer<typeof stageTypeSchema>;

export const matchStatusSchema = z.enum(['PENDING', 'QUEUED', 'PLAYING', 'FINISHED', 'CANCELLED']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const resultTypeSchema = z.enum(['NORMAL', 'WALKOVER', 'RETIRED']);
export type ResultType = z.infer<typeof resultTypeSchema>;

/**
 * Откуда берётся участник, если он ещё не известен.
 *
 * В олимпийской сетке полуфинал — это «победитель такой-то встречи». Сетка
 * разворачивается целиком при жеребьёвке, поэтому такие встречи существуют
 * до того, как определились их участники (ADR-019).
 */
export const bracketSourceSchema = z.object({
  kind: z.enum(['WINNER', 'LOSER']),
  matchId: z.uuid(),
});
export type BracketSourceView = z.infer<typeof bracketSourceSchema>;

export const matchViewSchema = z.object({
  id: z.uuid(),
  stageId: z.uuid(),
  groupId: z.uuid().nullable(),
  /** `null` — участник ещё не определён, смотрите `sourceA`. */
  playerAId: z.uuid().nullable(),
  playerBId: z.uuid().nullable(),
  sourceA: bracketSourceSchema.nullable(),
  sourceB: bracketSourceSchema.nullable(),
  status: matchStatusSchema,
  tableNumber: z.number().int().nullable(),
  setsA: z.number().int().nullable(),
  setsB: z.number().int().nullable(),
  resultType: resultTypeSchema.nullable(),
  /** Тур круговой схемы либо круг сетки. */
  bracketRound: z.number().int().nullable(),
  bracketSlot: z.number().int().nullable(),
});
export type MatchView = z.infer<typeof matchViewSchema>;

export const groupViewSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  order: z.number().int(),
  /** Состав группы, в порядке посева. */
  participants: z.array(z.uuid()),
});
export type GroupView = z.infer<typeof groupViewSchema>;

export const stageViewSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  type: stageTypeSchema,
  name: z.string(),
  groups: z.array(groupViewSchema),
  matches: z.array(matchViewSchema),
});
export type StageView = z.infer<typeof stageViewSchema>;

/** Игроки одного клуба, которых не удалось развести по группам — ADR-011. */
export const clubCollisionSchema = z.object({
  club: z.uuid(),
  group: z.string(),
  participants: z.array(z.uuid()),
});
export type ClubCollisionView = z.infer<typeof clubCollisionSchema>;

/**
 * Результат жеребьёвки.
 *
 * `clubCollisions` возвращается всегда, даже пустым: организатор обязан
 * увидеть несведённые совпадения здесь, а не обнаружить их в зале (ADR-011).
 */
export const drawResultSchema = z.object({
  tournamentId: z.uuid(),
  stages: z.array(stageViewSchema),
  clubCollisions: z.array(clubCollisionSchema),
});
export type DrawResult = z.infer<typeof drawResultSchema>;
