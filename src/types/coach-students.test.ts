import { describe, expect, it } from 'vitest';

import {
  COACH_STUDENTS_TOP,
  coachStudentsViewSchema,
  coachTenureViewSchema,
  isNamedStudent,
} from './coach-students.js';

const ID = '0b6f3c4e-7a51-4b8a-9d2e-5f1c3a7b9e10';
const city = { id: ID, name: 'Алматы', nameKk: null };
const student = {
  id: ID,
  lastName: 'Иванов',
  firstName: 'Пётр',
  photoUrl: null,
  rating: '412.50',
  city,
};

describe('ученики тренера', () => {
  it('по имени — с 14 лет по году рождения, младшие только числом', () => {
    const now = new Date('2026-10-21T00:00:00Z');

    expect(isNamedStudent(2012, now)).toBe(true);
    expect(isNamedStudent(2013, now)).toBe(false);
    expect(isNamedStudent(1990)).toBe(true);
  });

  it('сводка учеников читается схемой; топ не длиннее предела', () => {
    const view = {
      current: 12,
      younger: 4,
      former: 3,
      top: [student],
      medals: {
        total: 5,
        recent: [
          {
            player: student,
            place: 1,
            tournament: { id: ID, name: 'Кубок зала', startsAt: '2026-10-18T12:00:00.000Z' },
          },
        ],
      },
      growth: [{ player: student, delta: '+42.10' }],
    };

    expect(coachStudentsViewSchema.parse(view)).toEqual(view);
    expect(
      coachStudentsViewSchema.safeParse({
        ...view,
        top: Array.from({ length: COACH_STUDENTS_TOP + 1 }, () => student),
      }).success,
    ).toBe(false);
  });

  it('медаль — только места 1–3', () => {
    const medal = {
      player: student,
      place: 4,
      tournament: { id: ID, name: 'Кубок', startsAt: '2026-10-18T12:00:00.000Z' },
    };

    expect(
      coachStudentsViewSchema.safeParse({
        current: 1,
        younger: 0,
        former: 0,
        top: [],
        medals: { total: 0, recent: [medal] },
        growth: [],
      }).success,
    ).toBe(false);
  });

  it('тренер в истории: текущий без конца, прежний с концом', () => {
    expect(
      coachTenureViewSchema.parse({
        coachPlayerId: ID,
        name: 'Петров Алексей',
        slug: 'petrov-aleksey',
        from: '2024-01-01T00:00:00.000Z',
        to: null,
      }).to,
    ).toBeNull();
  });
});
