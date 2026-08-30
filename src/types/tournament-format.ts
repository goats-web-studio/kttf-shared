import { z } from 'zod';

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

const roundRobin = z.object({
  type: z.literal('ROUND_ROBIN'),
  rounds: z.union([z.literal(1), z.literal(2)]),
  setsToWin,
});

const knockout = z.object({
  type: z.literal('KNOCKOUT'),
  setsToWin,
  thirdPlace: z.boolean(),
  consolation: z.boolean(),
});

/**
 * Групповой этап задаётся либо числом групп, либо размером группы — ТЗ 5.2.
 * Оба сразу противоречат друг другу при любом составе, кроме одного.
 */
const groupSizing = {
  groupCount: z.number().int().min(2).max(64).optional(),
  groupSize: z.number().int().min(2).max(64).optional(),
  advancePerGroup: z.number().int().positive().max(16),
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
    thirdPlace: z.boolean(),
  })
  .refine(exactlyOneSizing, { message: SIZING_MESSAGE });

const groupsFinalGroups = z
  .object({
    type: z.literal('GROUPS_FINAL_GROUPS'),
    ...groupSizing,
    finalGroupCount: z.number().int().positive().max(16),
    setsToWin,
  })
  .refine(exactlyOneSizing, { message: SIZING_MESSAGE });

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
