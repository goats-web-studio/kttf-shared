import { z } from 'zod';

import { clubLocalTime } from './club-hours.js';

/**
 * Расписание тренировки по дням — T3 (ADR-059, `docs/11` 3.3, решение
 * владельца от 22.10.2026). Строки «день недели + время», как часы клуба
 * (ADR-055): только так видно «ближайшее занятие» и только так это можно
 * отфильтровать. Строка `schedule` остаётся примечанием к расписанию.
 * Время — минуты от полуночи по UTC+5.
 */

const DAY_MIN = 24 * 60;

/** Занятий в неделю у одной тренировки — не больше двух в день. */
export const TRAINING_SLOTS_MAX = 14;

export const trainingSlotSchema = z
  .object({
    /** 1 — понедельник … 7 — воскресенье. */
    weekday: z.number().int().min(1).max(7),
    startMin: z
      .number()
      .int()
      .min(0)
      .max(DAY_MIN - 1),
    /** Ночных тренировок не бывает: занятие кончается в тот же день. */
    endMin: z.number().int().min(1).max(DAY_MIN),
  })
  .refine((slot) => slot.endMin > slot.startMin, {
    message: 'Занятие кончается позже, чем начинается',
    path: ['endMin'],
  });
export type TrainingSlot = z.infer<typeof trainingSlotSchema>;

/** Слоты тренировки: в один день занятия не пересекаются. */
export const trainingSlotsSchema = z
  .array(trainingSlotSchema)
  .max(TRAINING_SLOTS_MAX)
  .superRefine((slots, ctx) => {
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const day = slots
        .filter((slot) => slot.weekday === weekday)
        .sort((a, b) => a.startMin - b.startMin);

      day.forEach((current, index) => {
        const previous = day[index - 1];

        if (previous !== undefined && current.startMin < previous.endMin) {
          ctx.addIssue({ code: 'custom', message: 'Занятия одного дня пересекаются' });
        }
      });
    }
  });

/**
 * Набор в группу: «есть места», «мало мест», «набор закрыт». Ставит тот,
 * кто ведёт тренировку; `null` — не указано (у индивидуальных — обычно).
 */
export const TRAINING_ENROLLMENTS = ['OPEN', 'FEW', 'CLOSED'] as const;
export const trainingEnrollmentSchema = z.enum(TRAINING_ENROLLMENTS);
export type TrainingEnrollment = z.infer<typeof trainingEnrollmentSchema>;

/** Время суток для фильтра — по началу занятия. */
export const TIMES_OF_DAY = ['MORNING', 'DAY', 'EVENING'] as const;
export const timeOfDaySchema = z.enum(TIMES_OF_DAY);
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

/** Границы: утро — до 12:00, день — до 17:00, вечер — с 17:00. */
export const TIME_OF_DAY_BOUNDS: Readonly<Record<TimeOfDay, readonly [number, number]>> = {
  MORNING: [0, 12 * 60],
  DAY: [12 * 60, 17 * 60],
  EVENING: [17 * 60, DAY_MIN],
};

export function timeOfDay(startMin: number): TimeOfDay {
  if (startMin < TIME_OF_DAY_BOUNDS.MORNING[1]) return 'MORNING';
  if (startMin < TIME_OF_DAY_BOUNDS.DAY[1]) return 'DAY';

  return 'EVENING';
}

/** Строка расписания: дни с одинаковым временем — вместе, «пн, ср, пт 18:00–19:30». */
export interface SlotGroup {
  readonly weekdays: readonly number[];
  readonly startMin: number;
  readonly endMin: number;
}

/**
 * Слоты в строки для показа. Порядок — по первому дню группы, затем по
 * времени: «пн, ср 18:00» раньше «сб 11:00».
 */
export function groupSlots(slots: readonly TrainingSlot[]): SlotGroup[] {
  // Слоты идут по порядку недели, поэтому первый день группы — день её заведения.
  const groups = new Map<
    string,
    { weekdays: number[]; firstDay: number; startMin: number; endMin: number }
  >();

  for (const slot of [...slots].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin)) {
    const key = `${String(slot.startMin)}-${String(slot.endMin)}`;
    const group = groups.get(key);

    if (group === undefined) {
      groups.set(key, {
        weekdays: [slot.weekday],
        firstDay: slot.weekday,
        startMin: slot.startMin,
        endMin: slot.endMin,
      });
    } else if (!group.weekdays.includes(slot.weekday)) {
      group.weekdays.push(slot.weekday);
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.firstDay - b.firstDay || a.startMin - b.startMin)
    .map(({ weekdays, startMin, endMin }) => ({ weekdays, startMin, endMin }));
}

/** Ближайшее занятие: через сколько дней (0 — сегодня), день и начало. */
export interface NextSession {
  readonly inDays: number;
  readonly weekday: number;
  readonly startMin: number;
}

/**
 * Ближайшее занятие от `now` по UTC+5. Уже начавшееся сегодня не считается:
 * на него не успеть. `null` — расписания нет.
 */
export function nextSession(slots: readonly TrainingSlot[], now: Date): NextSession | null {
  const local = clubLocalTime(now);
  let best: NextSession | null = null;

  for (const slot of slots) {
    let inDays = (slot.weekday - local.weekday + 7) % 7;

    if (inDays === 0 && slot.startMin <= local.minute) inDays = 7;

    if (
      best === null ||
      inDays < best.inDays ||
      (inDays === best.inDays && slot.startMin < best.startMin)
    ) {
      best = { inDays, weekday: slot.weekday, startMin: slot.startMin };
    }
  }

  return best;
}
