import { z } from 'zod';

/**
 * Часы работы клуба — ADR-055, `docs/09` 3.1.
 *
 * Неделя строками, а не картинкой, как у RTTF: только так видно «открыто
 * сейчас» и только так это можно отфильтровать. Время — минуты от полуночи
 * по местному времени клуба.
 */

/**
 * Местное время клуба — UTC+5.
 *
 * С 1 марта 2024 года Казахстан живёт в одном часовом поясе. Пояс клуба
 * поэтому не хранится: колонка, у которой одно значение на всю страну,
 * только ждала бы опечатки.
 */
export const CLUB_UTC_OFFSET_MIN = 5 * 60;

const DAY_MIN = 24 * 60;

/**
 * Позже шести утра следующего дня клуб не закрывается.
 *
 * Ночной интервал «20:00–02:00» записывается как 1200–1560: так он остаётся
 * одной строкой и одним правилом, а не двумя кусками в двух днях.
 */
export const CLUB_CLOSES_MAX_MIN = DAY_MIN + 6 * 60;

/** Интервалов в день больше трёх не бывает: «утро, день, вечер» — это три. */
export const CLUB_HOURS_PER_DAY_MAX = 3;

export const clubHoursIntervalSchema = z
  .object({
    /** 1 — понедельник … 7 — воскресенье. */
    weekday: z.number().int().min(1).max(7),
    opensMin: z
      .number()
      .int()
      .min(0)
      .max(DAY_MIN - 1),
    closesMin: z.number().int().min(1).max(CLUB_CLOSES_MAX_MIN),
  })
  .refine((interval) => interval.closesMin > interval.opensMin, {
    message: 'Клуб закрывается позже, чем открывается',
    path: ['closesMin'],
  });
export type ClubHoursInterval = z.infer<typeof clubHoursIntervalSchema>;

/**
 * Неделя целиком: правка часов заменяет все строки разом.
 *
 * Пустой список — «часы не указаны», а не «закрыто всегда».
 */
export const setClubHoursSchema = z.object({
  hours: z
    .array(clubHoursIntervalSchema)
    .max(7 * CLUB_HOURS_PER_DAY_MAX)
    .superRefine((hours, ctx) => {
      for (let weekday = 1; weekday <= 7; weekday += 1) {
        const day = hours
          .filter((interval) => interval.weekday === weekday)
          .sort((a, b) => a.opensMin - b.opensMin);

        if (day.length > CLUB_HOURS_PER_DAY_MAX) {
          ctx.addIssue({ code: 'custom', message: 'Не больше трёх интервалов в день' });
        }

        day.forEach((current, index) => {
          const previous = day[index - 1];

          if (previous !== undefined && current.opensMin < previous.closesMin) {
            ctx.addIssue({ code: 'custom', message: 'Интервалы одного дня пересекаются' });
          }
        });
      }
    }),
});
export type SetClubHoursInput = z.infer<typeof setClubHoursSchema>;

/** День недели и минута по местному времени клуба. */
export interface ClubLocalTime {
  readonly weekday: number;
  readonly minute: number;
}

export function clubLocalTime(now: Date): ClubLocalTime {
  const local = new Date(now.getTime() + CLUB_UTC_OFFSET_MIN * 60_000);

  return {
    // getUTCDay: 0 — воскресенье; у нас неделя с понедельника.
    weekday: ((local.getUTCDay() + 6) % 7) + 1,
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/**
 * Открыт ли клуб.
 *
 * - `unknown` — часы не указаны: «закрыто» здесь было бы неправдой
 * - `open` — `until` в минутах от полуночи сегодняшнего дня (бывает больше
 *   суток, если клуб закрывается ночью)
 * - `closed` — `next` — ближайшее открытие: через сколько дней и во сколько
 */
export type ClubOpenStatus =
  | { readonly state: 'unknown' }
  | { readonly state: 'open'; readonly until: number }
  | {
      readonly state: 'closed';
      readonly next: { readonly inDays: number; readonly opensMin: number };
    };

export function clubOpenStatus(hours: readonly ClubHoursInterval[], now: Date): ClubOpenStatus {
  const { weekday, minute } = clubLocalTime(now);

  const today = hours.find(
    (interval) =>
      interval.weekday === weekday && interval.opensMin <= minute && minute < interval.closesMin,
  );

  if (today !== undefined) return { state: 'open', until: today.closesMin };

  // Вчерашний ночной интервал ещё идёт: «пт 20:00–02:00» в субботу в час ночи.
  const yesterday = ((weekday + 5) % 7) + 1;
  const night = hours.find(
    (interval) =>
      interval.weekday === yesterday &&
      interval.closesMin > DAY_MIN &&
      minute + DAY_MIN < interval.closesMin,
  );

  if (night !== undefined) return { state: 'open', until: night.closesMin - DAY_MIN };

  // Ближайшее открытие: через сколько дней и во сколько. Сегодняшнее, которое
  // уже прошло, — это открытие через неделю.
  const next = hours
    .map((interval) => {
      const ahead = (interval.weekday - weekday + 7) % 7;

      return {
        inDays: ahead === 0 && interval.opensMin <= minute ? 7 : ahead,
        opensMin: interval.opensMin,
      };
    })
    .sort((a, b) => a.inDays - b.inDays || a.opensMin - b.opensMin)[0];

  if (next === undefined) return { state: 'unknown' };

  return { state: 'closed', next };
}

/** Интервалы одного дня по порядку — для строки «Сегодня 08:00–23:00». */
export function clubHoursOf(
  hours: readonly ClubHoursInterval[],
  weekday: number,
): readonly ClubHoursInterval[] {
  return hours
    .filter((interval) => interval.weekday === weekday)
    .sort((a, b) => a.opensMin - b.opensMin);
}
