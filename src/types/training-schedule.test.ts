import { describe, expect, it } from 'vitest';

import { listTrainingsSchema } from './coach.js';
import {
  TRAINING_SLOTS_MAX,
  groupSlots,
  nextSession,
  timeOfDay,
  trainingSlotSchema,
  trainingSlotsSchema,
} from './training-schedule.js';

const evening = (weekday: number) => ({ weekday, startMin: 18 * 60, endMin: 19 * 60 + 30 });

/** Момент по UTC+5: `2026-10-22` — четверг. */
const at = (localIso: string) => new Date(`${localIso}+05:00`);

describe('слоты расписания', () => {
  it('занятие кончается позже, чем начинается, и в тот же день', () => {
    expect(trainingSlotSchema.safeParse(evening(1)).success).toBe(true);
    expect(trainingSlotSchema.safeParse({ weekday: 1, startMin: 600, endMin: 600 }).success).toBe(
      false,
    );
    expect(trainingSlotSchema.safeParse({ weekday: 8, startMin: 600, endMin: 660 }).success).toBe(
      false,
    );
    expect(trainingSlotSchema.safeParse({ weekday: 1, startMin: 1380, endMin: 1500 }).success).toBe(
      false,
    );
  });

  it('в один день занятия не пересекаются, в разные — как угодно', () => {
    expect(trainingSlotsSchema.safeParse([evening(1), evening(3)]).success).toBe(true);
    expect(
      trainingSlotsSchema.safeParse([
        evening(1),
        { weekday: 1, startMin: 19 * 60, endMin: 20 * 60 },
      ]).success,
    ).toBe(false);
    expect(
      trainingSlotsSchema.safeParse([
        evening(1),
        { weekday: 1, startMin: 10 * 60, endMin: 11 * 60 },
      ]).success,
    ).toBe(true);
  });

  it('не больше предела в неделю', () => {
    const slots = Array.from({ length: TRAINING_SLOTS_MAX + 1 }, (_, i) => ({
      weekday: (i % 7) + 1,
      startMin: 60 * (i < 7 ? 8 : 18),
      endMin: 60 * (i < 7 ? 9 : 19),
    }));

    expect(trainingSlotsSchema.safeParse(slots).success).toBe(false);
  });
});

describe('время суток', () => {
  it('утро до 12, день до 17, вечер с 17', () => {
    expect(timeOfDay(9 * 60)).toBe('MORNING');
    expect(timeOfDay(12 * 60)).toBe('DAY');
    expect(timeOfDay(17 * 60)).toBe('EVENING');
  });
});

describe('строки расписания', () => {
  it('дни с одним временем — вместе, по порядку недели', () => {
    expect(
      groupSlots([
        { weekday: 6, startMin: 660, endMin: 750 },
        evening(5),
        evening(1),
        evening(3),
        evening(3),
      ]),
    ).toEqual([
      { weekdays: [1, 3, 5], startMin: 1080, endMin: 1170 },
      { weekdays: [6], startMin: 660, endMin: 750 },
    ]);
  });

  it('в один день раньше — первым', () => {
    expect(
      groupSlots([
        { weekday: 1, startMin: 1080, endMin: 1140 },
        { weekday: 1, startMin: 600, endMin: 660 },
      ]).map((group) => group.startMin),
    ).toEqual([600, 1080]);
  });

  it('пусто — пусто', () => {
    expect(groupSlots([])).toEqual([]);
  });
});

describe('ближайшее занятие', () => {
  it('сегодня, если ещё не началось', () => {
    expect(nextSession([evening(4)], at('2026-10-22T10:00:00'))).toEqual({
      inDays: 0,
      weekday: 4,
      startMin: 1080,
    });
  });

  it('началось — через неделю, если других нет', () => {
    expect(nextSession([evening(4)], at('2026-10-22T18:30:00'))?.inDays).toBe(7);
  });

  it('из нескольких — ближайшее; в один день — раньшее', () => {
    expect(
      nextSession(
        [evening(1), evening(5), { weekday: 5, startMin: 600, endMin: 660 }],
        at('2026-10-22T20:00:00'),
      ),
    ).toEqual({ inDays: 1, weekday: 5, startMin: 600 });
  });

  it('в один день позднее занятие не вытесняет раннее', () => {
    expect(
      nextSession(
        [{ weekday: 5, startMin: 600, endMin: 660 }, evening(5)],
        at('2026-10-22T20:00:00'),
      )?.startMin,
    ).toBe(600);
  });

  it('расписания нет — нет и ближайшего', () => {
    expect(nextSession([], new Date())).toBeNull();
  });
});

describe('фильтры расписания в адресе', () => {
  it('дни и время — списками, «есть места» — флагом', () => {
    expect(listTrainingsSchema.parse({ day: '1,3', time: 'EVENING', open: 'true' })).toMatchObject({
      day: [1, 3],
      time: ['EVENING'],
      open: true,
    });
    expect(listTrainingsSchema.safeParse({ day: '8' }).success).toBe(false);
    expect(listTrainingsSchema.safeParse({ time: 'NIGHT' }).success).toBe(false);
  });
});
