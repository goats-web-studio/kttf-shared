import { z } from 'zod';

import { PLAYOFF_ROUNDS, type PlayoffRound } from '../brackets/match-length.js';

/**
 * Конфигурация схемы проведения — ТС 4.2.
 *
 * Живёт в общем коде не для удобства: `Tournament.formatConfig` — это колонка
 * `Json`, и без схемы в неё попадёт что угодно. Ту же конфигурацию читает
 * офлайн-консоль, когда считает таблицу локально, — разойтись с сервером
 * в понимании схемы турнира она не имеет права (запрет №2 брифа).
 *
 * Схем в ТЗ 5.1 перечислено шесть, типов здесь четыре: круговая в один и два
 * круга отличается параметром, олимпийка с утешительной — флагом.
 */

/** До скольких выигранных сетов идёт встреча — ТЗ 5.2. */
const setsToWin = z.union([z.literal(2), z.literal(3), z.literal(4)]);

/**
 * Длина встречи по кругам плей-офф — ТЗ 5.2, ADR-044.
 *
 * Всё необязательно: не заданный круг играется общей длиной плей-офф.
 * Правило, какой встрече какая длина, — `playoffSetsToWin` в `brackets`.
 */
export const playoffSetsToWinSchema = z.object(
  Object.fromEntries(PLAYOFF_ROUNDS.map((round) => [round, setsToWin.optional()])) as Record<
    PlayoffRound,
    z.ZodOptional<typeof setsToWin>
  >,
);
export type PlayoffSetsToWin = z.infer<typeof playoffSetsToWinSchema>;

const roundRobin = z.object({
  type: z.literal('ROUND_ROBIN'),
  rounds: z.union([z.literal(1), z.literal(2)]),
  setsToWin,
});

/**
 * Утешительная сетка (ТЗ 5.1) описана, но не построена: движка для неё нет,
 * а собирать сетку в приложении запрещено запретом №2 брифа.
 *
 * Отказ стоит здесь, а не в жеребьёвке. Иначе турнир создаётся, живёт со
 * своим флагом и разваливается только при разложении сетки — организатор
 * узнаёт об отказе через три экрана после того, как сделал выбор (ADR-024).
 */
const knockout = z
  .object({
    type: z.literal('KNOCKOUT'),
    setsToWin,
    playoffSetsToWin: playoffSetsToWinSchema.optional(),
    thirdPlace: z.boolean(),
    consolation: z.boolean(),
  })
  .refine((value) => !value.consolation, {
    message: 'Утешительная сетка пока не поддерживается: движок её не строит',
    path: ['consolation'],
  });

/**
 * Групповой этап задаётся либо числом групп, либо размером группы — ТЗ 5.2.
 * Оба сразу противоречат друг другу при любом составе, кроме одного.
 */
const groupSizing = {
  groupCount: z.number().int().min(2).max(64).optional(),
  groupSize: z.number().int().min(2).max(64).optional(),
  advancePerGroup: z.number().int().positive().max(16),
  /**
   * Кругов в группе — ТЗ 5.2, тот же параметр, что у круговой схемы.
   *
   * Со значением по умолчанию, а не обязательный: турниры, созданные до
   * появления поля, лежат в базе без него и обязаны читаться дальше. Один
   * круг — то, как они и разыгрывались.
   */
  groupRounds: z.union([z.literal(1), z.literal(2)]).default(1),
};

function exactlyOneSizing(value: {
  groupCount?: number | undefined;
  groupSize?: number | undefined;
}): boolean {
  return (value.groupCount === undefined) !== (value.groupSize === undefined);
}

const SIZING_MESSAGE = 'Задайте либо количество групп, либо размер группы, но не оба';

const groupsKnockout = z
  .object({
    type: z.literal('GROUPS_KNOCKOUT'),
    ...groupSizing,
    groupSetsToWin: setsToWin,
    koSetsToWin: setsToWin,
    playoffSetsToWin: playoffSetsToWinSchema.optional(),
    thirdPlace: z.boolean(),
    /**
     * Не вышедшие из групп играют сетку за следующие места — ADR-045.
     *
     * Со значением по умолчанию: турниры, созданные до появления поля,
     * читаются дальше и играются как раньше — без сетки за места.
     */
    exitBracket: z.boolean().default(false),
  })
  .refine(exactlyOneSizing, { message: SIZING_MESSAGE });

/**
 * «Финалы по местам» — ТЗ 5.1: k-я финальная группа собирает тех, кто занял
 * k-е место в своей группе. Поэтому финальных групп ровно столько, сколько
 * выходит из группы: при меньшем числу вышедших некуда идти, при большем
 * финальная группа осталась бы пустой.
 */
const groupsFinalGroups = z
  .object({
    type: z.literal('GROUPS_FINAL_GROUPS'),
    ...groupSizing,
    finalGroupCount: z.number().int().positive().max(16),
    setsToWin,
  })
  .refine(exactlyOneSizing, { message: SIZING_MESSAGE })
  .refine((value) => value.finalGroupCount === value.advancePerGroup, {
    message: 'Финальных групп столько же, сколько выходит из группы: они играют за места',
  });

export const formatConfigSchema = z.union([
  roundRobin,
  knockout,
  groupsKnockout,
  groupsFinalGroups,
]);
export type FormatConfig = z.infer<typeof formatConfigSchema>;

/**
 * Посев и разведение по клубам — ТС 4.2.
 *
 * Разведение по клубам не гарантируется: посев старше, оставшиеся совпадения
 * возвращаются списком (ADR-011).
 */
export const seedingConfigSchema = z.object({
  method: z.enum(['RATING', 'RANDOM', 'MANUAL']),
  separateByClub: z.boolean(),
});
export type SeedingConfig = z.infer<typeof seedingConfigSchema>;
