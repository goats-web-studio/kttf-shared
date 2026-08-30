import { z } from 'zod';

import { resultTypeSchema, matchViewSchema, stageViewSchema } from './stage.js';
import { tournamentStandingsSchema } from './standings.js';

/**
 * Встречи в ответах API — ТС 7.6.
 *
 * Один и тот же набор читают консоль судьи, второй экран и публичные
 * результаты. Формы тел запросов повторяют быстрые кнопки ТЗ 6.3: счёт по
 * сетам — опция, а не обязанность.
 */

/** Встреча отдельным запросом: без турнира её негде показать. */
export const matchDetailSchema = matchViewSchema.extend({ tournamentId: z.uuid() });
export type MatchDetailView = z.infer<typeof matchDetailSchema>;

/** Счёт по сетам: `[[11, 9], [9, 11], [11, 7]]`. */
export const setScoresSchema = z.array(
  z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
);

export const matchResultSchema = z.object({
  setsA: z.number().int().nonnegative(),
  setsB: z.number().int().nonnegative(),
  setScores: setScoresSchema.optional(),
  /** Умолчание — обычная встреча: техническая победа задаётся явно. */
  resultType: resultTypeSchema.default('NORMAL'),
});
export type MatchResultInput = z.infer<typeof matchResultSchema>;

export const assignTableSchema = z.object({ tableNumber: z.number().int().positive() });
export type AssignTableInput = z.infer<typeof assignTableSchema>;

/**
 * Итог действия над встречей.
 *
 * `updated` — встречи, чей состав изменился следом: победитель уехал в
 * следующий круг, а при правке результата оттуда же уехал прежний (ADR-019).
 * Консоль применяет их к себе, не перезапрашивая турнир целиком.
 */
export const matchUpdateResultSchema = z.object({
  match: matchViewSchema,
  updated: z.array(matchViewSchema),
  /**
   * Этап, достроенный по итогам групп: плей-офф либо финальные группы.
   * `null` — достраивать нечего или ещё рано.
   */
  nextStage: stageViewSchema.nullable(),
  /**
   * Метки групп, где равенство не разрешено судьёй, из-за чего следующий этап
   * не построен: неизвестно, кто вышел. Решает судья — ADR-008.
   */
  blockedByTies: z.array(z.string()),
});
export type MatchUpdateResult = z.infer<typeof matchUpdateResultSchema>;

/**
 * Решение судьи по равенству в таблице — ADR-008.
 *
 * Участники перечисляются в том порядке, который выбрал судья. Хранится как
 * данные и приходит в расчёт параметром, поэтому движок остаётся чистым.
 */
export const tieDecisionSchema = z.object({
  groupId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(2),
  note: z.string().max(500).optional(),
});
export type TieDecisionInput = z.infer<typeof tieDecisionSchema>;

/** Разрешённое равенство меняет места, а иногда и открывает следующий этап. */
export const tieDecisionResultSchema = z.object({
  standings: tournamentStandingsSchema,
  nextStage: stageViewSchema.nullable(),
  blockedByTies: z.array(z.string()),
});
export type TieDecisionResult = z.infer<typeof tieDecisionResultSchema>;
