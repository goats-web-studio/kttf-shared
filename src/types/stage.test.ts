import { describe, expect, it } from 'vitest';

import { bracketSourceSchema, drawResultSchema, drawSwapSchema, matchViewSchema } from './stage.js';

const ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000002';

const match = {
  id: ID,
  stageId: ID,
  groupId: null,
  playerAId: null,
  playerBId: null,
  sourceA: { kind: 'WINNER', matchId: OTHER },
  sourceB: { kind: 'WINNER', matchId: OTHER },
  status: 'PENDING',
  tableNumber: null,
  setsA: null,
  setsB: null,
  resultType: null,
  bracketRound: 2,
  bracketSlot: 0,
  startedAt: null,
  finishedAt: null,
};

describe('встреча в сетке', () => {
  it('существует до того, как известны её участники', () => {
    // Полуфинал — это «победитель такой-то встречи». Сетка разворачивается
    // целиком при жеребьёвке, иначе её нечем показать (ТЗ 9.4, ADR-019).
    expect(matchViewSchema.safeParse(match).success).toBe(true);
  });

  it('участник, известный сразу, идёт без источника', () => {
    expect(
      matchViewSchema.safeParse({
        ...match,
        playerAId: ID,
        playerBId: OTHER,
        sourceA: null,
        sourceB: null,
        bracketRound: 1,
      }).success,
    ).toBe(true);
  });

  it('несёт время выхода на стол и закрытия', () => {
    // Очередь консоли сортируется по тому, кто дольше не играл (ТЗ 6.1).
    // Без этих полей приоритет пришлось бы выводить из порядка встреч,
    // а он описывает сетку, а не зал.
    expect(
      matchViewSchema.safeParse({
        ...match,
        status: 'FINISHED',
        startedAt: '2026-09-05T10:00:00.000Z',
        finishedAt: '2026-09-05T10:25:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('источник бывает только победителем или проигравшим', () => {
    expect(bracketSourceSchema.safeParse({ kind: 'WINNER', matchId: ID }).success).toBe(true);
    expect(bracketSourceSchema.safeParse({ kind: 'LOSER', matchId: ID }).success).toBe(true);
    expect(bracketSourceSchema.safeParse({ kind: 'SEED', matchId: ID }).success).toBe(false);
  });
});

describe('результат жеребьёвки', () => {
  it('несведённые совпадения по клубам возвращаются всегда', () => {
    // Пустой список — тоже ответ. Организатор обязан увидеть совпадения
    // здесь, а не обнаружить их в зале (ADR-011).
    expect(
      drawResultSchema.safeParse({ tournamentId: ID, stages: [], clubCollisions: [] }).success,
    ).toBe(true);
    expect(drawResultSchema.safeParse({ tournamentId: ID, stages: [] }).success).toBe(false);
  });
});

describe('ручная корректировка жеребьёвки', () => {
  it('обмен требует двух разных игроков', () => {
    // Обмен с самим собой — не корректировка, а опечатка организатора.
    expect(drawSwapSchema.safeParse({ playerAId: ID, playerBId: OTHER_ID }).success).toBe(true);
    expect(drawSwapSchema.safeParse({ playerAId: ID, playerBId: ID }).success).toBe(false);
    expect(drawSwapSchema.safeParse({ playerAId: ID }).success).toBe(false);
  });
});
