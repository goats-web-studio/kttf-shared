import { describe, expect, it } from 'vitest';

import { calculateStandings, LOSS_POINTS, WIN_POINTS } from './standings.js';
import type { ParticipantId, PlayedMatch } from './types.js';

/** Встреча без счёта по мячам: разница мячей в разведении не участвует. */
function match(a: ParticipantId, b: ParticipantId, setsA: number, setsB: number): PlayedMatch {
  return { a, b, setsA, setsB, resultType: 'NORMAL' };
}

/** Встреча со счётом по сетам — нужна там, где проверяется разница мячей. */
function scored(
  a: ParticipantId,
  b: ParticipantId,
  setScores: readonly (readonly [number, number])[],
): PlayedMatch {
  let setsA = 0;
  let setsB = 0;
  for (const [ballsA, ballsB] of setScores) {
    if (ballsA > ballsB) setsA += 1;
    else setsB += 1;
  }
  return { a, b, setsA, setsB, setScores, resultType: 'NORMAL' };
}

function placesOf(
  participants: ParticipantId[],
  matches: PlayedMatch[],
): Record<string, number | null> {
  const { rows } = calculateStandings(participants, matches);
  return Object.fromEntries(rows.map((row) => [row.participant, row.place]));
}

describe('calculateStandings — подсчёт', () => {
  it('очки по регламенту: победа 2, поражение 1', () => {
    const { rows } = calculateStandings(['a', 'b'], [match('a', 'b', 3, 1)]);
    const a = rows.find((row) => row.participant === 'a');
    const b = rows.find((row) => row.participant === 'b');
    expect(a?.points).toBe(WIN_POINTS);
    expect(b?.points).toBe(LOSS_POINTS);
    expect(a?.wins).toBe(1);
    expect(b?.losses).toBe(1);
  });

  it('за неявку и снятие проигравший не получает очка', () => {
    for (const resultType of ['WALKOVER', 'RETIRED'] as const) {
      const { rows } = calculateStandings(
        ['a', 'b'],
        [{ a: 'a', b: 'b', setsA: 3, setsB: 0, resultType }],
      );
      const b = rows.find((row) => row.participant === 'b');
      expect(b?.points, resultType).toBe(0);
    }
  });

  it('сеты и мячи считаются обеим сторонам', () => {
    const { rows } = calculateStandings(
      ['a', 'b'],
      [
        scored('a', 'b', [
          [11, 9],
          [9, 11],
          [11, 7],
        ]),
      ],
    );
    const a = rows.find((row) => row.participant === 'a');
    const b = rows.find((row) => row.participant === 'b');
    expect(a?.setsWon).toBe(2);
    expect(a?.setsLost).toBe(1);
    expect(a?.ballsWon).toBe(31);
    expect(a?.ballsLost).toBe(27);
    expect(b?.ballDiff).toBe(-4);
  });

  it('без счёта по сетам разница мячей нулевая, а не выдуманная', () => {
    const { rows } = calculateStandings(['a', 'b'], [match('a', 'b', 3, 0)]);
    expect(rows.every((row) => row.ballsWon === 0 && row.ballsLost === 0)).toBe(true);
  });

  it('отвергает встречу с посторонним участником', () => {
    expect(() => calculateStandings(['a', 'b'], [match('a', 'c', 3, 0)])).toThrow(/вне списка/);
  });

  it('отвергает повторяющихся участников', () => {
    expect(() => calculateStandings(['a', 'a'], [])).toThrow(/уникальны/);
  });
});

describe('calculateStandings — разведение равенства', () => {
  it('разные очки — мест хватает всем', () => {
    const places = placesOf(
      ['a', 'b', 'c'],
      [match('a', 'b', 3, 0), match('a', 'c', 3, 0), match('b', 'c', 3, 0)],
    );
    expect(places).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('правило 1: двоих разводит личная встреча', () => {
    // a и b набрали поровну, но b обыграл a
    const places = placesOf(
      ['a', 'b', 'c'],
      [match('b', 'a', 3, 0), match('a', 'c', 3, 0), match('b', 'c', 3, 0)],
    );
    expect(places.b).toBe(1);
    expect(places.a).toBe(2);
    expect(places.c).toBe(3);
  });

  it('правило 2: круг из троих разводится разницей сетов между ними', () => {
    // Классический круг: a>b, b>c, c>a. Очки равны, личная встреча не помогает.
    const places = placesOf(
      ['a', 'b', 'c'],
      [match('a', 'b', 3, 0), match('b', 'c', 3, 1), match('c', 'a', 3, 2)],
    );
    // Разница сетов между равными: a = 3-3 = 0, b = 1-3+3-... считаем по факту
    expect(new Set(Object.values(places))).toEqual(new Set([1, 2, 3]));
    expect(Object.values(places).every((place) => place !== null)).toBe(true);
  });

  it('правило 3: когда сеты равны, разводит разница мячей между равными', () => {
    const places = placesOf(
      ['a', 'b', 'c'],
      [
        scored('a', 'b', [
          [11, 0],
          [11, 0],
        ]),
        scored('b', 'c', [
          [11, 0],
          [11, 0],
        ]),
        scored('c', 'a', [
          [11, 9],
          [11, 9],
        ]),
      ],
    );
    // Круг, у всех 2:2 по сетам. Мячи между равными различаются.
    expect(new Set(Object.values(places))).toEqual(new Set([1, 2, 3]));
  });

  it('рекурсия: правило развело частично, к оставшимся правила применяются заново', () => {
    // Четверо по 3 очка. Личная встреча выделяет d вниз, остальные трое
    // остаются равны — и внутри тройки личная встреча считается уже иначе.
    const participants = ['a', 'b', 'c', 'd', 'e'];
    const matches = [
      // e проигрывает всем — он заведомо последний
      match('a', 'e', 3, 0),
      match('b', 'e', 3, 0),
      match('c', 'e', 3, 0),
      match('d', 'e', 3, 0),
      // среди a,b,c,d — круг с разными счётами
      match('a', 'b', 3, 0),
      match('b', 'c', 3, 1),
      match('c', 'd', 3, 0),
      match('d', 'a', 3, 1),
      match('a', 'c', 3, 2),
      match('b', 'd', 3, 2),
    ];
    const { rows, unresolved } = calculateStandings(participants, matches);
    expect(unresolved).toEqual([]);
    expect(rows.map((row) => row.place)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.at(-1)?.participant).toBe('e');
  });

  it('полностью идентичные участники остаются неразрешёнными', () => {
    // a и b обменялись победами с c и d одинаково, между собой не играли...
    // Проще: двое не сыграли ни одной встречи — статистика идентична.
    const { rows, unresolved } = calculateStandings(['a', 'b'], []);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]?.participants).toEqual(['a', 'b']);
    expect(unresolved[0]?.places).toEqual([1, 2]);
    expect(rows.every((row) => row.place === null)).toBe(true);
  });

  it('неразрешённая группа перечисляет ровно те места, которые делит', () => {
    // Первый определён, трое сзади идентичны
    const { unresolved } = calculateStandings(
      ['top', 'x', 'y', 'z'],
      [match('top', 'x', 3, 0), match('top', 'y', 3, 0), match('top', 'z', 3, 0)],
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]?.places).toEqual([2, 3, 4]);
    expect([...(unresolved[0]?.participants ?? [])].sort()).toEqual(['x', 'y', 'z']);
  });

  it('состав неразрешённой группы детерминирован при любом порядке участников', () => {
    const first = calculateStandings(['a', 'b', 'c'], []);
    const second = calculateStandings(['c', 'a', 'b'], []);
    expect(first.unresolved[0]?.participants).toEqual(second.unresolved[0]?.participants);
  });
});

describe('calculateStandings — решение судьи', () => {
  const participants = ['top', 'x', 'y', 'z'];
  const matches = [match('top', 'x', 3, 0), match('top', 'y', 3, 0), match('top', 'z', 3, 0)];

  it('применяется и закрывает равенство', () => {
    const { rows, unresolved } = calculateStandings(participants, matches, {
      tieDecisions: [['z', 'x', 'y']],
    });
    expect(unresolved).toEqual([]);
    const places = Object.fromEntries(rows.map((row) => [row.participant, row.place]));
    expect(places).toEqual({ top: 1, z: 2, x: 3, y: 4 });
  });

  it('решение с другим составом не подходит и равенство остаётся', () => {
    const { unresolved } = calculateStandings(participants, matches, {
      tieDecisions: [['x', 'y']],
    });
    expect(unresolved).toHaveLength(1);
  });

  it('лишние решения не мешают', () => {
    const { unresolved } = calculateStandings(participants, matches, {
      tieDecisions: [
        ['нет', 'таких'],
        ['y', 'z', 'x'],
      ],
    });
    expect(unresolved).toEqual([]);
  });

  it('движок остаётся чистым: тот же вход даёт тот же выход', () => {
    const options = { tieDecisions: [['z', 'x', 'y']] };
    expect(calculateStandings(participants, matches, options)).toEqual(
      calculateStandings(participants, matches, options),
    );
  });
});

describe('calculateStandings — снявшийся участник (ADR-009)', () => {
  it('сыгранные встречи остаются, несыгранные идут технической победой', () => {
    // c снялся после встречи с a; встречи с b и d записаны техническими
    const { rows, unresolved } = calculateStandings(
      ['a', 'b', 'c', 'd'],
      [
        match('a', 'c', 3, 2),
        { a: 'b', b: 'c', setsA: 3, setsB: 0, resultType: 'WALKOVER' },
        { a: 'd', b: 'c', setsA: 3, setsB: 0, resultType: 'WALKOVER' },
        match('a', 'b', 3, 0),
        match('a', 'd', 3, 0),
        match('b', 'd', 3, 1),
      ],
    );
    expect(unresolved).toEqual([]);

    const c = rows.find((row) => row.participant === 'c');
    // Три поражения: одно обычное (0 очков за поражение? нет — 1) и два технических (0)
    expect(c?.played).toBe(3);
    expect(c?.points).toBe(LOSS_POINTS);
    expect(c?.setsWon).toBe(2);
    expect(rows.at(-1)?.participant).toBe('c');
  });
});

describe('calculateStandings — победа второй стороны', () => {
  it('когда выигрывает b, очки и сеты достаются ему', () => {
    const { rows } = calculateStandings(['a', 'b'], [match('a', 'b', 1, 3)]);
    const a = rows.find((row) => row.participant === 'a');
    const b = rows.find((row) => row.participant === 'b');
    expect(b?.wins).toBe(1);
    expect(b?.points).toBe(WIN_POINTS);
    expect(b?.place).toBe(1);
    expect(a?.losses).toBe(1);
    expect(a?.points).toBe(LOSS_POINTS);
    expect(a?.place).toBe(2);
  });

  it('две независимые неразрешённые группы идут в порядке убывания очков', () => {
    // a и b обыграли c и d одинаково, между собой не играли — как и c с d
    const { rows, unresolved } = calculateStandings(
      ['a', 'b', 'c', 'd'],
      [match('a', 'c', 3, 0), match('a', 'd', 3, 0), match('b', 'c', 3, 0), match('b', 'd', 3, 0)],
    );
    expect(unresolved).toHaveLength(2);
    expect(unresolved[0]?.places).toEqual([1, 2]);
    expect(unresolved[1]?.places).toEqual([3, 4]);
    expect(rows.map((row) => row.participant)).toEqual(['a', 'b', 'c', 'd']);
    expect(rows.every((row) => row.place === null)).toBe(true);
  });
});
