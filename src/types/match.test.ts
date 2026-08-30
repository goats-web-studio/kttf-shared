import { describe, expect, it } from 'vitest';

import { assignTableSchema, matchResultSchema, tieDecisionSchema } from './match.js';

const ID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

describe('ввод результата встречи', () => {
  it('быстрая кнопка присылает только счёт', () => {
    // ТЗ 6.3: закрытие встречи не более чем в два действия. Всё, кроме
    // счёта, обязано иметь умолчание, иначе быстрых кнопок не выйдет.
    const parsed = matchResultSchema.parse({ setsA: 3, setsB: 1 });

    expect(parsed.resultType).toBe('NORMAL');
    expect(parsed.setScores).toBeUndefined();
  });

  it('техническая победа задаётся явно', () => {
    const parsed = matchResultSchema.parse({ setsA: 3, setsB: 0, resultType: 'WALKOVER' });

    expect(parsed.resultType).toBe('WALKOVER');
  });

  it('счёт по сетам принимается парами чисел', () => {
    const parsed = matchResultSchema.parse({
      setsA: 2,
      setsB: 0,
      setScores: [
        [11, 9],
        [11, 7],
      ],
    });

    expect(parsed.setScores).toEqual([
      [11, 9],
      [11, 7],
    ]);
  });

  it('отвергает отрицательные и дробные сеты', () => {
    expect(matchResultSchema.safeParse({ setsA: -1, setsB: 3 }).success).toBe(false);
    expect(matchResultSchema.safeParse({ setsA: 1.5, setsB: 3 }).success).toBe(false);
  });

  it('отвергает сет из трёх чисел', () => {
    const broken = { setsA: 1, setsB: 0, setScores: [[11, 9, 7]] };

    expect(matchResultSchema.safeParse(broken).success).toBe(false);
  });

  it('отвергает неизвестный тип результата', () => {
    expect(matchResultSchema.safeParse({ setsA: 3, setsB: 0, resultType: 'DRAW' }).success).toBe(
      false,
    );
  });
});

describe('назначение на стол', () => {
  it('номер стола положительный', () => {
    expect(assignTableSchema.parse({ tableNumber: 4 }).tableNumber).toBe(4);
    expect(assignTableSchema.safeParse({ tableNumber: 0 }).success).toBe(false);
  });
});

describe('решение судьи по равенству', () => {
  it('принимает порядок участников', () => {
    const parsed = tieDecisionSchema.parse({ groupId: ID, orderedIds: [ID, OTHER] });

    expect(parsed.orderedIds).toEqual([ID, OTHER]);
  });

  it('одного участника разделять не с кем', () => {
    expect(tieDecisionSchema.safeParse({ groupId: ID, orderedIds: [ID] }).success).toBe(false);
  });
});
