import { z } from 'zod';

import { playerViewSchema } from './player.js';
import { stageViewSchema } from './stage.js';
import { tieGroupSchema, tournamentStandingsSchema } from './standings.js';
import { registrationStatusSchema, tournamentViewSchema } from './tournament.js';

/**
 * Публичные результаты турнира — ТЗ 9.4, маршрут ТС 7.5.
 *
 * Ответ описывает турнир, а не подгоняет все схемы проведения под общий вид.
 * У круговой нет сетки, у олимпийки нет таблиц, а в «группах плюс сетка» часть
 * участников мест не разыгрывает вовсе. Поэтому пустая секция здесь — это
 * ответ, а не пропуск: клиент рисует то, что схема действительно дала.
 */

/**
 * Откуда взялось место — или почему его нет.
 *
 * Повторяет `PlacementReason` движка. Два значения дают пустое место и
 * означают разное: `GROUP_EXIT` — участник выбыл на групповом этапе и за места
 * не играл, `UNDECIDED` — место ещё не определено. Одна пустая клетка на оба
 * случая ничего человеку не объясняет.
 */
export const placementReasonSchema = z.enum([
  'TABLE',
  'BRACKET',
  'SHARED',
  'GROUP_EXIT',
  'UNDECIDED',
]);
export type PlacementReason = z.infer<typeof placementReasonSchema>;

export const resultParticipantSchema = z.object({
  player: playerViewSchema,
  /** Итоговое место. `null` — смотрите `reason`. */
  place: z.number().int().positive().nullable(),
  reason: placementReasonSchema,
  status: registrationStatusSchema,
  /** `false` — вне зачёта: играл, но результаты не рейтинговые (ТЗ 4.4). */
  isRated: z.boolean(),
  seed: z.number().int().nullable(),
});
export type ResultParticipantView = z.infer<typeof resultParticipantSchema>;

/**
 * Одно событие журнала рейтинга — ТЗ 7.3.
 *
 * Десятичные уходят строкой по той же причине, что и рейтинг игрока: в базе
 * это `Decimal(8,2)`, и двоичная плавающая точка хранит не все такие значения
 * точно (ADR-014).
 */
export const ratingEventViewSchema = z.object({
  matchId: z.uuid().nullable(),
  ratingBefore: z.string(),
  delta: z.string(),
  ratingAfter: z.string(),
});
export type RatingEventView = z.infer<typeof ratingEventViewSchema>;

/**
 * Изменение рейтинга участника за турнир.
 *
 * `totalDelta` считает сервер, а не клиент: сложение строк с двумя знаками
 * через число с плавающей точкой — ровно тот способ потерять копейку, ради
 * которого рейтинг и передаётся строкой.
 *
 * `ratingAtStart` — снимок на старте (ТС 5.4), `ratingAfter` — значение сразу
 * после этого турнира. Они не обязаны отличаться ровно на `totalDelta`: дельта
 * считается против снимка, а применяется к текущей проекции, и между снимком
 * и обсчётом мог лечь другой турнир (ADR-022).
 */
export const participantRatingSchema = z.object({
  playerId: z.uuid(),
  ratingAtStart: z.string().nullable(),
  /** `null` — рейтинг по турниру ещё не начислен. */
  ratingAfter: z.string().nullable(),
  totalDelta: z.string(),
  events: z.array(ratingEventViewSchema),
});
export type ParticipantRatingView = z.infer<typeof participantRatingSchema>;

export const tournamentResultsSchema = z.object({
  tournament: tournamentViewSchema,
  participants: z.array(resultParticipantSchema),
  /**
   * Делят диапазон мест: проигравшие в полуфиналах, когда матча за третье
   * место не было. Это не спор — между собой они не играли.
   */
  shared: z.array(tieGroupSchema),
  /** Равенства, которые обязан развести судья, — ADR-008. */
  unresolved: z.array(tieGroupSchema),
  standings: tournamentStandingsSchema,
  stages: z.array(stageViewSchema),
  ratings: z.array(participantRatingSchema),
});
export type TournamentResultsView = z.infer<typeof tournamentResultsSchema>;
