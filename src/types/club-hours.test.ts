import { describe, expect, it } from 'vitest';

import {
  CLUB_CLOSES_MAX_MIN,
  clubHoursOf,
  clubLocalTime,
  clubOpenStatus,
  setClubHoursSchema,
  type ClubHoursInterval,
} from './club-hours.js';

/** Момент по местному времени клуба (UTC+5). 20.10.2026 — вторник. */
function local(iso: string): Date {
  return new Date(`${iso}+05:00`);
}

const at = (weekday: number, opens: string, closes: string): ClubHoursInterval => {
  const minutes = (time: string): number => {
    const [hours = 0, mins = 0] = time.split(':').map(Number);

    return hours * 60 + mins;
  };

  return { weekday, opensMin: minutes(opens), closesMin: minutes(closes) };
};

describe('местное время клуба', () => {
  it('UTC+5 и неделя с понедельника', () => {
    expect(clubLocalTime(local('2026-10-20T10:30:00'))).toEqual({ weekday: 2, minute: 630 });
    // В UTC это ещё суббота 19:30, у клуба — уже воскресенье.
    expect(clubLocalTime(new Date('2026-10-24T19:30:00Z'))).toEqual({ weekday: 7, minute: 30 });
  });
});

describe('открыт ли клуб', () => {
  const weekdays = [1, 2, 3, 4, 5].map((day) => at(day, '08:00', '23:00'));

  it('без часов — неизвестно, а не «закрыто»', () => {
    expect(clubOpenStatus([], local('2026-10-20T10:00:00'))).toEqual({ state: 'unknown' });
  });

  it('открыт внутри интервала — до его конца', () => {
    expect(clubOpenStatus(weekdays, local('2026-10-20T10:00:00'))).toEqual({
      state: 'open',
      until: 23 * 60,
    });
  });

  it('конец интервала уже не входит', () => {
    expect(clubOpenStatus(weekdays, local('2026-10-20T23:00:00'))).toEqual({
      state: 'closed',
      next: { inDays: 1, opensMin: 8 * 60 },
    });
  });

  it('утром до открытия — откроется сегодня', () => {
    expect(clubOpenStatus(weekdays, local('2026-10-20T07:00:00'))).toEqual({
      state: 'closed',
      next: { inDays: 0, opensMin: 8 * 60 },
    });
  });

  it('в выходные — откроется в понедельник', () => {
    expect(clubOpenStatus(weekdays, local('2026-10-24T12:00:00'))).toEqual({
      state: 'closed',
      next: { inDays: 2, opensMin: 8 * 60 },
    });
  });

  it('перерыв между интервалами — откроется после перерыва', () => {
    const split = [at(2, '08:00', '13:00'), at(2, '14:00', '22:00')];

    expect(clubOpenStatus(split, local('2026-10-20T13:30:00'))).toEqual({
      state: 'closed',
      next: { inDays: 0, opensMin: 14 * 60 },
    });
    // В субботу ближайшее — утренний интервал вторника, а не дневной.
    expect(clubOpenStatus(split, local('2026-10-24T12:00:00'))).toEqual({
      state: 'closed',
      next: { inDays: 3, opensMin: 8 * 60 },
    });
  });

  it('ночной интервал вчерашнего дня ещё идёт', () => {
    // Пятница 20:00 — суббота 02:00.
    const night = [at(5, '20:00', '26:00')];

    expect(clubOpenStatus(night, local('2026-10-24T01:00:00'))).toEqual({
      state: 'open',
      until: 2 * 60,
    });
    expect(clubOpenStatus(night, local('2026-10-24T02:00:00'))).toEqual({
      state: 'closed',
      next: { inDays: 6, opensMin: 20 * 60 },
    });
  });

  it('вчерашний обычный интервал ночью не продлевается', () => {
    expect(clubOpenStatus([at(1, '08:00', '23:00')], local('2026-10-20T01:00:00'))).toEqual({
      state: 'closed',
      next: { inDays: 6, opensMin: 8 * 60 },
    });
  });

  it('единственный день недели уже прошёл — откроется через неделю', () => {
    expect(clubOpenStatus([at(2, '08:00', '10:00')], local('2026-10-20T12:00:00'))).toEqual({
      state: 'closed',
      next: { inDays: 7, opensMin: 8 * 60 },
    });
  });
});

describe('интервалы дня', () => {
  it('по порядку открытия и только этого дня', () => {
    const hours = [at(2, '14:00', '22:00'), at(1, '08:00', '23:00'), at(2, '08:00', '13:00')];

    expect(clubHoursOf(hours, 2)).toEqual([at(2, '08:00', '13:00'), at(2, '14:00', '22:00')]);
    expect(clubHoursOf(hours, 7)).toEqual([]);
  });
});

describe('правка часов', () => {
  it('пустая неделя — «часы не указаны»', () => {
    expect(setClubHoursSchema.safeParse({ hours: [] }).success).toBe(true);
  });

  it('закрытие раньше открытия отвергается', () => {
    expect(setClubHoursSchema.safeParse({ hours: [at(1, '22:00', '08:00')] }).success).toBe(false);
  });

  it('ночной интервал — до шести утра следующего дня', () => {
    expect(setClubHoursSchema.safeParse({ hours: [at(5, '20:00', '30:00')] }).success).toBe(true);
    expect(
      setClubHoursSchema.safeParse({
        hours: [{ weekday: 5, opensMin: 1200, closesMin: CLUB_CLOSES_MAX_MIN + 1 }],
      }).success,
    ).toBe(false);
  });

  it('пересекающиеся интервалы одного дня отвергаются, соседние — нет', () => {
    expect(
      setClubHoursSchema.safeParse({ hours: [at(1, '08:00', '14:00'), at(1, '13:00', '20:00')] })
        .success,
    ).toBe(false);
    expect(
      setClubHoursSchema.safeParse({ hours: [at(1, '08:00', '13:00'), at(1, '13:00', '20:00')] })
        .success,
    ).toBe(true);
  });

  it('больше трёх интервалов в день отвергается', () => {
    const four = [
      at(1, '06:00', '07:00'),
      at(1, '08:00', '09:00'),
      at(1, '10:00', '11:00'),
      at(1, '12:00', '13:00'),
    ];

    expect(setClubHoursSchema.safeParse({ hours: four }).success).toBe(false);
  });
});
