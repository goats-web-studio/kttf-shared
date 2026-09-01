import { describe, expect, it } from 'vitest';

import { calculateStandings } from './standings.js';
import { calculatePlacement } from './placement.js';
import type { BracketResult, GroupTable, PlacementInput } from './placement-types.js';
import type { PlayedMatch, Standings } from './types.js';

/**
 * Итоговые места — ТЗ 9.4.
 *
 * Таблицы для входа считаются настоящим движком, а не собираются руками:
 * места из таблицы обязаны быть теми же, что увидит судья в консоли.
 */

function win(a: string, b: string, setsA = 2, setsB = 0): PlayedMatch {
  return { a, b, setsA, setsB, resultType: 'NORMAL' };
}

function table(participants: readonly string[], matches: readonly PlayedMatch[]): Standings {
  return calculateStandings(participants, matches);
}

function group(order: number, standings: Standings): GroupTable {
  return { order, standings };
}

function input(overrides: Partial<PlacementInput> = {}): PlacementInput {
  return { groups: [], finalGroups: [], bracket: [], ...overrides };
}

function main(round: number, winner: string | null, loser: string | null): BracketResult {
  return { round, kind: 'MAIN', winner, loser };
}

function third(winner: string | null, loser: string | null): BracketResult {
  return { round: 0, kind: 'THIRD_PLACE', winner, loser };
}

/** Места по участникам — так проверять читаемее, чем по порядку строк. */
function places(rows: readonly { participant: string; place: number | null }[]): Record<string, number | null> {
  return Object.fromEntries(rows.map((row) => [row.participant, row.place]));
}

function reasons(
  rows: readonly { participant: string; reason: string }[],
): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.participant, row.reason]));
}

describe('круговая', () => {
  it('места берутся из таблицы', () => {
    const standings = table(
      ['a', 'b', 'c'],
      [win('a', 'b'), win('a', 'c'), win('b', 'c')],
    );

    const placement = calculatePlacement('ROUND_ROBIN', input({ groups: [group(0, standings)] }));

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, c: 3 });
    expect(reasons(placement.rows)).toEqual({ a: 'TABLE', b: 'TABLE', c: 'TABLE' });
    expect(placement.shared).toEqual([]);
    expect(placement.unresolved).toEqual([]);
  });

  it('без жеребьёвки мест нет', () => {
    expect(calculatePlacement('ROUND_ROBIN', input())).toEqual({
      rows: [],
      shared: [],
      unresolved: [],
    });
  });

  it('неразрешённое равенство оставляет место пустым и уезжает в unresolved', () => {
    // Круг втроём: каждый обыграл каждого, правила 1–5 не разводят.
    const standings = table(
      ['a', 'b', 'c'],
      [win('a', 'b', 2, 1), win('b', 'c', 2, 1), win('c', 'a', 2, 1)],
    );

    const placement = calculatePlacement('ROUND_ROBIN', input({ groups: [group(0, standings)] }));

    expect(places(placement.rows)).toEqual({ a: null, b: null, c: null });
    expect(reasons(placement.rows)).toEqual({ a: 'UNDECIDED', b: 'UNDECIDED', c: 'UNDECIDED' });
    expect(placement.unresolved).toEqual([{ participants: ['a', 'b', 'c'], places: [1, 2, 3] }]);
  });

  it('несколько таблиц в круговой — отказ, а не молчаливое склеивание', () => {
    const standings = table(['a', 'b'], [win('a', 'b')]);

    expect(() =>
      calculatePlacement(
        'ROUND_ROBIN',
        input({ groups: [group(0, standings), group(1, standings)] }),
      ),
    ).toThrow(/одну таблицу/);
  });
});

describe('олимпийка', () => {
  it('финал даёт первое и второе место', () => {
    const placement = calculatePlacement('KNOCKOUT', input({ bracket: [main(1, 'a', 'b')] }));

    expect(places(placement.rows)).toEqual({ a: 1, b: 2 });
    expect(placement.shared).toEqual([]);
  });

  it('без матча за третье полуфиналисты делят 3–4', () => {
    const placement = calculatePlacement(
      'KNOCKOUT',
      input({ bracket: [main(1, 'a', 'c'), main(1, 'b', 'd'), main(2, 'a', 'b')] }),
    );

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, c: null, d: null });
    expect(reasons(placement.rows)).toEqual({ a: 'BRACKET', b: 'BRACKET', c: 'SHARED', d: 'SHARED' });
    expect(placement.shared).toEqual([{ participants: ['c', 'd'], places: [3, 4] }]);
  });

  it('матч за третье разводит 3 и 4', () => {
    const placement = calculatePlacement(
      'KNOCKOUT',
      input({
        bracket: [main(1, 'a', 'c'), main(1, 'b', 'd'), main(2, 'a', 'b'), third('c', 'd')],
      }),
    );

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    expect(placement.shared).toEqual([]);
  });

  it('объявленный, но не сыгранный матч за третье оставляет дележ', () => {
    const placement = calculatePlacement(
      'KNOCKOUT',
      input({
        bracket: [main(1, 'a', 'c'), main(1, 'b', 'd'), main(2, 'a', 'b'), third(null, null)],
      }),
    );

    expect(placement.shared).toEqual([{ participants: ['c', 'd'], places: [3, 4] }]);
  });

  it('круги вылета занимают диапазоны подряд', () => {
    const bracket = [
      main(1, 'a', 'e'),
      main(1, 'b', 'f'),
      main(1, 'c', 'g'),
      main(1, 'd', 'h'),
      main(2, 'a', 'c'),
      main(2, 'b', 'd'),
      main(3, 'a', 'b'),
    ];

    const placement = calculatePlacement('KNOCKOUT', input({ bracket }));

    expect(places(placement.rows)).toEqual({
      a: 1,
      b: 2,
      c: null,
      d: null,
      e: null,
      f: null,
      g: null,
      h: null,
    });
    expect(placement.shared).toEqual([
      { participants: ['c', 'd'], places: [3, 4] },
      { participants: ['e', 'f', 'g', 'h'], places: [5, 6, 7, 8] },
    ]);
  });

  it('свободные проходы сокращают диапазон, а не оставляют дыру', () => {
    // Шестеро в сетке на восемь: два сеяных проходят первый круг без встречи,
    // поэтому проигравших в нём двое, и они занимают 5–6, а не 5–8.
    const bracket = [
      main(1, 'c', 'e'),
      main(1, 'd', 'f'),
      main(2, 'a', 'c'),
      main(2, 'b', 'd'),
      main(3, 'a', 'b'),
    ];

    const placement = calculatePlacement('KNOCKOUT', input({ bracket }));

    expect(placement.shared).toEqual([
      { participants: ['c', 'd'], places: [3, 4] },
      { participants: ['e', 'f'], places: [5, 6] },
    ]);
  });

  it('единственный проигравший круга получает место, а не дележ', () => {
    const bracket = [main(1, 'b', 'c'), main(2, 'a', 'b')];

    const placement = calculatePlacement('KNOCKOUT', input({ bracket }));

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, c: 3 });
    expect(reasons(placement.rows).c).toBe('BRACKET');
    expect(placement.shared).toEqual([]);
  });

  it('пустая сетка мест не даёт', () => {
    expect(calculatePlacement('KNOCKOUT', input())).toEqual({
      rows: [],
      shared: [],
      unresolved: [],
    });
  });

  it('несыгранный финал обнуляет все места, а не только первое', () => {
    const bracket = [main(1, 'a', 'c'), main(1, 'b', 'd'), main(2, null, null)];

    const placement = calculatePlacement('KNOCKOUT', input({ bracket }));

    expect(places(placement.rows)).toEqual({ a: null, c: null, b: null, d: null });
    expect(reasons(placement.rows).a).toBe('UNDECIDED');
  });

  it('недоигранный круг обрывает нумерацию ниже себя', () => {
    // Полуфиналы сыграны, один четвертьфинал — нет. Места 3–4 известны,
    // а сколько мест займёт первый круг, ещё неизвестно.
    const bracket = [
      main(1, 'a', 'e'),
      main(1, 'b', 'f'),
      main(1, 'c', 'g'),
      main(1, null, null),
      main(2, 'a', 'c'),
      main(2, 'b', 'd'),
      main(3, 'a', 'b'),
    ];

    const placement = calculatePlacement('KNOCKOUT', input({ bracket }));

    expect(placement.shared).toEqual([{ participants: ['c', 'd'], places: [3, 4] }]);
    expect(places(placement.rows)).toMatchObject({ e: null, f: null, g: null });
    expect(reasons(placement.rows)).toMatchObject({
      e: 'UNDECIDED',
      f: 'UNDECIDED',
      g: 'UNDECIDED',
    });
  });

  it('круг без единого известного проигравшего пропускается', () => {
    const bracket = [main(1, null, null), main(2, 'a', 'b')];

    const placement = calculatePlacement('KNOCKOUT', input({ bracket }));

    expect(places(placement.rows)).toEqual({ a: 1, b: 2 });
  });
});

describe('группы плюс сетка', () => {
  const groups = [
    group(0, table(['a', 'c'], [win('a', 'c')])),
    group(1, table(['b', 'd'], [win('b', 'd')])),
  ];

  it('не вышедшие из группы остаются без места с причиной GROUP_EXIT', () => {
    const placement = calculatePlacement(
      'GROUPS_KNOCKOUT',
      input({ groups, bracket: [main(1, 'a', 'b')] }),
    );

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, c: null, d: null });
    expect(reasons(placement.rows)).toEqual({
      a: 'BRACKET',
      b: 'BRACKET',
      c: 'GROUP_EXIT',
      d: 'GROUP_EXIT',
    });
  });

  it('пока сетка не сыграна, выбывших ещё нет', () => {
    const placement = calculatePlacement('GROUPS_KNOCKOUT', input({ groups }));

    expect(reasons(placement.rows)).toEqual({
      a: 'UNDECIDED',
      c: 'UNDECIDED',
      b: 'UNDECIDED',
      d: 'UNDECIDED',
    });
  });

  it('участник сетки, которого нет в таблицах, места не теряет', () => {
    const placement = calculatePlacement(
      'GROUPS_KNOCKOUT',
      input({ groups: [], bracket: [main(1, null, null), main(2, 'x', 'y')] }),
    );

    expect(places(placement.rows)).toEqual({ x: 1, y: 2 });
  });

  it('несыгранный финал перечисляет и групповых, и сеточных', () => {
    const placement = calculatePlacement(
      'GROUPS_KNOCKOUT',
      input({ groups, bracket: [main(1, 'a', 'z'), main(2, null, null)] }),
    );

    expect(Object.keys(reasons(placement.rows)).sort()).toEqual(['a', 'b', 'c', 'd', 'z']);
  });
});

describe('группы плюс финальные группы', () => {
  it('k-я финальная группа играет за свой диапазон мест', () => {
    const finalGroups = [
      group(0, table(['a', 'b'], [win('a', 'b')])),
      group(1, table(['c', 'd'], [win('c', 'd')])),
    ];

    const placement = calculatePlacement('GROUPS_FINAL_GROUPS', input({ finalGroups }));

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    expect(reasons(placement.rows).c).toBe('TABLE');
  });

  it('смещение считается по размеру групп, а не по их номеру', () => {
    const finalGroups = [
      group(0, table(['a', 'b', 'e'], [win('a', 'b'), win('a', 'e'), win('b', 'e')])),
      group(1, table(['c', 'd'], [win('c', 'd')])),
    ];

    const placement = calculatePlacement('GROUPS_FINAL_GROUPS', input({ finalGroups }));

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, e: 3, c: 4, d: 5 });
  });

  it('порядок групп задаётся полем order, а не порядком в массиве', () => {
    const finalGroups = [
      group(1, table(['c', 'd'], [win('c', 'd')])),
      group(0, table(['a', 'b'], [win('a', 'b')])),
    ];

    const placement = calculatePlacement('GROUPS_FINAL_GROUPS', input({ finalGroups }));

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });

  it('неразрешённое равенство смещается вместе с местами', () => {
    const tie = table(
      ['c', 'd', 'e'],
      [win('c', 'd', 2, 1), win('d', 'e', 2, 1), win('e', 'c', 2, 1)],
    );
    const finalGroups = [group(0, table(['a', 'b'], [win('a', 'b')])), group(1, tie)];

    const placement = calculatePlacement('GROUPS_FINAL_GROUPS', input({ finalGroups }));

    expect(placement.unresolved).toEqual([{ participants: ['c', 'd', 'e'], places: [3, 4, 5] }]);
    expect(places(placement.rows)).toMatchObject({ c: null, d: null, e: null });
  });

  it('оставшийся вне финальных групп остаётся без определённого места', () => {
    const placement = calculatePlacement(
      'GROUPS_FINAL_GROUPS',
      input({
        groups: [group(0, table(['a', 'b', 'z'], [win('a', 'b'), win('a', 'z'), win('b', 'z')]))],
        finalGroups: [group(0, table(['a', 'b'], [win('a', 'b')]))],
      }),
    );

    expect(places(placement.rows)).toEqual({ a: 1, b: 2, z: null });
    expect(reasons(placement.rows).z).toBe('UNDECIDED');
  });
});
