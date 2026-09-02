import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';
import { playerViewSchema } from './player.js';
import { resultTypeSchema } from './stage.js';

/**
 * История игрока — ТС 7.2, экран ТЗ 9.3.
 *
 * Три ответа на три вопроса, которые задаёт игрок о себе: как менялся мой
 * рейтинг, с кем я играл и как я играю против конкретного соперника.
 *
 * Все десятичные — строкой: в базе это `Decimal(8,2)`, и двоичная плавающая
 * точка хранит не все такие значения точно (ADR-014). Клиент их показывает,
 * а не складывает: суммы считает сервер.
 */

/**
 * Точка графика рейтинга — один турнир.
 *
 * Точка на турнир, а не на встречу: игрок смотрит на кривую своего года, и
 * сотня точек одного турнира в ней ничего не объясняет. Разбор по встречам
 * даёт история встреч.
 *
 * `tournamentId` пуст у ручной корректировки (ТЗ 12): она не привязана к
 * турниру, но из кривой её выкидывать нельзя — рейтинг после неё другой.
 */
export const ratingPointSchema = z.object({
  tournamentId: z.uuid().nullable(),
  tournamentName: z.string().nullable(),
  /** Старт турнира, а для корректировки — момент записи. */
  playedAt: z.iso.datetime(),
  ratingBefore: z.string(),
  ratingAfter: z.string(),
  /** Сумма изменений за турнир. */
  delta: z.string(),
  /** Сколько встреч дали изменение рейтинга. */
  matches: z.number().int().nonnegative(),
});
export type RatingPointView = z.infer<typeof ratingPointSchema>;

export const ratingHistorySchema = z.object({
  playerId: z.uuid(),
  /** Текущее значение — проекция журнала (ТС 1.4). */
  current: z.string(),
  /** По возрастанию времени: график рисуется слева направо. */
  points: z.array(ratingPointSchema),
});
export type RatingHistoryView = z.infer<typeof ratingHistorySchema>;

export const ratingHistoryQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type RatingHistoryQuery = z.infer<typeof ratingHistoryQuerySchema>;

/**
 * Сыгранная встреча глазами игрока — ТЗ 9.3.
 *
 * Счёт развёрнут на «свои» и «чужие» сеты, а не на A и B: игрок не обязан
 * помнить, с какой стороны сетки он стоял.
 */
export const playerMatchSchema = z.object({
  matchId: z.uuid(),
  tournamentId: z.uuid(),
  tournamentName: z.string(),
  stageName: z.string(),
  /** Момент закрытия встречи. `null` — счёт введён без отметки времени. */
  playedAt: z.iso.datetime().nullable(),
  /** `null` — соперник снялся до встречи и техническую победу засчитали. */
  opponent: playerViewSchema.nullable(),
  setsFor: z.number().int().nonnegative(),
  setsAgainst: z.number().int().nonnegative(),
  won: z.boolean(),
  resultType: resultTypeSchema,
  /** Изменение рейтинга по этой встрече. `null` — турнир ещё не обсчитан. */
  delta: z.string().nullable(),
});
export type PlayerMatchView = z.infer<typeof playerMatchSchema>;

export const playerMatchesQuerySchema = pageQuerySchema;
export type PlayerMatchesQuery = z.infer<typeof playerMatchesQuerySchema>;

/**
 * Личный счёт против соперника — ТЗ 9.3.
 *
 * Считает сервер, а не клиент: страница отдаёт встречи постранично, и
 * посчитанный по одной странице личный счёт был бы неверным.
 */
export const headToHeadSchema = z.object({
  playerId: z.uuid(),
  opponent: playerViewSchema,
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  setsWon: z.number().int().nonnegative(),
  setsLost: z.number().int().nonnegative(),
  /** Все очные встречи, от свежих к старым. */
  matches: z.array(playerMatchSchema),
});
export type HeadToHeadView = z.infer<typeof headToHeadSchema>;
