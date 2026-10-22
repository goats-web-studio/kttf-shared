import { describe, expect, it } from 'vitest';

import { matchAll, selectAdvancing, type GroupPlacement } from './group-advance.js';
import { buildKnockout, nextPowerOfTwo, seedOrder } from './knockout.js';

/** Группа с местами по порядку: первый в списке занял первое место. */
function group(label: string, ordered: readonly string[], unresolved = []): GroupPlacement {
  return {
    label,
    rows: ordered.map((participant, index) => ({ participant, place: index + 1 })),
    unresolved,
  };
}

/** Половина сетки, где стоит участник: в разных половинах встречаются только в финале. */
function halfOf(seeded: readonly string[], participant: string): 'top' | 'bottom' {
  const size = nextPowerOfTwo(seeded.length);
  const position = seedOrder(size).indexOf(seeded.indexOf(participant) + 1);

  return position < size / 2 ? 'top' : 'bottom';
}

/** Группы `a`, `b`, … по `size` человек: `a1` — победитель группы `a`. */
function groups(count: number, size: number): GroupPlacement[] {
  return Array.from({ length: count }, (_unused, index) => {
    const letter = String.fromCharCode(97 + index);

    return group(
      `гр. ${String(index + 1)}`,
      Array.from({ length: size }, (_skip, place) => `${letter}${String(place + 1)}`),
    );
  });
}

describe('selectAdvancing', () => {
  it('из каждой группы выходит заданное число участников', () => {
    const selection = selectAdvancing(
      [group('гр. 1', ['a1', 'a2', 'a3']), group('гр. 2', ['b1', 'b2', 'b3'])],
      2,
    );

    expect(selection.byPlace).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
    ]);
    expect(selection.seeded).toEqual(['a1', 'b1', 'a2', 'b2']);
    expect(selection.blocked).toEqual([]);
  });

  it('посев идёт по местам: сначала все первые, затем все вторые', () => {
    const selection = selectAdvancing(groups(4, 2), 2);

    expect(selection.seeded.slice(0, 4)).toEqual(['a1', 'b1', 'c1', 'd1']);
    expect([...selection.seeded.slice(4)].sort()).toEqual(['a2', 'b2', 'c2', 'd2']);
  });

  it('одногруппники в разных половинах сетки — встретятся только в финале', () => {
    // Раньше вторые места шли в порядке групп: при четырёх группах A1 и A2
    // попадали в одну половину и встречались в полуфинале.
    for (let count = 2; count <= 16; count += 1) {
      const selection = selectAdvancing(groups(count, 3), 2);

      for (let index = 0; index < count; index += 1) {
        const letter = String.fromCharCode(97 + index);

        expect(
          halfOf(selection.seeded, `${letter}1`),
          `${String(count)} групп, группа ${letter}`,
        ).not.toBe(halfOf(selection.seeded, `${letter}2`));
      }
    }
  });

  it('вторые места при восьми группах — как у RTTF: 7, 8, 5, 6, 3, 4, 1, 2', () => {
    // Протокол RTTF «Группы + Сетка» на 16: посевы 9–16 — вторые места
    // групп 7, 8, 5, 6, 3, 4, 1, 2 (docs/research/rttf-tm, раздел 4.3).
    const selection = selectAdvancing(groups(8, 3), 2);

    expect(selection.seeded.slice(8)).toEqual(['g2', 'h2', 'e2', 'f2', 'c2', 'd2', 'a2', 'b2']);
  });

  it('третьи места не попадают в четверть ни к первому, ни ко второму своей группы', () => {
    const selection = selectAdvancing(groups(4, 3), 3);
    const size = nextPowerOfTwo(selection.seeded.length);
    const quarter = (participant: string): number =>
      Math.floor(seedOrder(size).indexOf(selection.seeded.indexOf(participant) + 1) / (size / 4));

    for (const letter of ['a', 'b', 'c', 'd']) {
      expect(quarter(`${letter}3`)).not.toBe(quarter(`${letter}1`));
      expect(quarter(`${letter}3`)).not.toBe(quarter(`${letter}2`));
    }
  });

  it('одногруппники не встречаются в первом круге плей-офф', () => {
    // Ради этого свойства посев и устроен «по местам, внутри места — по
    // порядку групп»: иначе победитель группы играл бы с её же вторым номером.
    const selection = selectAdvancing(
      [
        group('гр. 1', ['a1', 'a2']),
        group('гр. 2', ['b1', 'b2']),
        group('гр. 3', ['c1', 'c2']),
        group('гр. 4', ['d1', 'd2']),
      ],
      2,
    );

    const bracket = buildKnockout(selection.seeded);
    const firstRound = bracket.matches.filter((entry) => entry.round === 1);

    expect(firstRound).toHaveLength(4);
    for (const entry of firstRound) {
      const left = entry.a.kind === 'PARTICIPANT' ? entry.a.participant : '';
      const right = entry.b.kind === 'PARTICIPANT' ? entry.b.participant : '';
      expect(left.startsWith(right.charAt(0)), `${left} играет с ${right}`).toBe(false);
    }
  });

  it('выходит один — берётся только победитель группы', () => {
    const selection = selectAdvancing([group('гр. 1', ['a1', 'a2']), group('гр. 2', ['b1'])], 1);

    expect(selection.seeded).toEqual(['a1', 'b1']);
  });

  it('группа меньше зоны выхода отдаёт всех, кто в ней есть', () => {
    // Схема с неравными группами: из большей выходят двое, в меньшей второго
    // места просто нет. Сетка достроит недостающее свободным проходом.
    const selection = selectAdvancing([group('гр. 1', ['a1', 'a2']), group('гр. 2', ['b1'])], 2);

    expect(selection.seeded).toEqual(['a1', 'b1', 'a2']);
    expect(selection.byPlace).toEqual([['a1', 'b1'], ['a2']]);
  });

  it('неразрешённое равенство в зоне выхода останавливает отбор', () => {
    const contested: GroupPlacement = {
      label: 'гр. 2',
      rows: [
        { participant: 'b1', place: null },
        { participant: 'b2', place: null },
        { participant: 'b3', place: 3 },
      ],
      unresolved: [{ participants: ['b1', 'b2'], places: [1, 2] }],
    };

    const selection = selectAdvancing([group('гр. 1', ['a1', 'a2']), contested], 2);

    expect(selection.blocked).toEqual(['гр. 2']);
    expect(selection.seeded).toEqual([]);
    expect(selection.byPlace).toEqual([]);
  });

  it('равенство ниже зоны выхода отбору не мешает', () => {
    // Спор за третье место в группе, откуда выходят двое, на состав
    // плей-офф не влияет — ждать решения судьи незачем.
    const contested: GroupPlacement = {
      label: 'гр. 1',
      rows: [
        { participant: 'a1', place: 1 },
        { participant: 'a2', place: 2 },
        { participant: 'a3', place: null },
        { participant: 'a4', place: null },
      ],
      unresolved: [{ participants: ['a3', 'a4'], places: [3, 4] }],
    };

    const selection = selectAdvancing([contested], 2);

    expect(selection.blocked).toEqual([]);
    expect(selection.seeded).toEqual(['a1', 'a2']);
  });

  it('групп нет — выходить некому', () => {
    expect(selectAdvancing([], 2)).toEqual({
      seeded: [],
      byPlace: [[], []],
      exits: [],
      blocked: [],
    });
  });

  it('из группы обязан выходить хотя бы один', () => {
    expect(() => selectAdvancing([group('гр. 1', ['a1'])], 0)).toThrow(/хотя бы один/);
    expect(() => selectAdvancing([group('гр. 1', ['a1'])], 1.5)).toThrow(/хотя бы один/);
  });
});

describe('не вышедшие из групп — сетка за места, ADR-045', () => {
  it('сеются тем же порядком: все третьи, затем все четвёртые', () => {
    const selection = selectAdvancing(
      [group('гр. 1', ['a1', 'a2', 'a3', 'a4']), group('гр. 2', ['b1', 'b2', 'b3', 'b4'])],
      2,
    );

    expect(selection.exits).toEqual(['a3', 'b3', 'a4', 'b4']);
  });

  it('третий одной группы в первом круге встречает четвёртого другой', () => {
    const selection = selectAdvancing(
      [group('гр. 1', ['a1', 'a2', 'a3', 'a4']), group('гр. 2', ['b1', 'b2', 'b3', 'b4'])],
      2,
    );
    const bracket = buildKnockout(selection.exits);
    const pairs = bracket.matches
      .filter((match) => match.round === 1)
      .map((match) =>
        [match.a, match.b].map((side) => (side.kind === 'PARTICIPANT' ? side.participant : '')),
      );

    expect(pairs).toEqual([
      ['a3', 'b4'],
      ['b3', 'a4'],
    ]);
  });

  it('группы разного размера: короткой группе просто нечего отдать', () => {
    const selection = selectAdvancing(
      [group('гр. 1', ['a1', 'a2', 'a3', 'a4']), group('гр. 2', ['b1', 'b2', 'b3'])],
      2,
    );

    expect(selection.exits).toEqual(['a3', 'b3', 'a4']);
  });

  it('пока отбор остановлен, выбывших тоже нет', () => {
    const selection = selectAdvancing(
      [
        {
          label: 'гр. 1',
          rows: [
            { participant: 'a1', place: null },
            { participant: 'a2', place: null },
            { participant: 'a3', place: 3 },
          ],
          unresolved: [{ participants: ['a1', 'a2'], places: [1, 2] }],
        },
      ],
      1,
    );

    expect(selection.exits).toEqual([]);
  });
});

describe('посев блока — паросочетание, ADR-061', () => {
  const entries = [
    { participant: 'x', group: 0 },
    { participant: 'y', group: 1 },
  ];
  const anywhere = (): number => 1;

  it('занятый посев освобождается, если прежнему владельцу есть куда уйти', () => {
    const owners = matchAll(entries, [[1, 2], [1]], anywhere, 1);

    expect(owners).toEqual(
      new Map([
        [2, 0],
        [1, 1],
      ]),
    );
  });

  it('двоим на один посев места нет', () => {
    expect(matchAll(entries, [[1], [1]], anywhere, 1)).toBeNull();
  });
});

describe('не вышедшие из групп — разведение одногруппников, ADR-061', () => {
  it('третий и четвёртый одной группы — в разных половинах сетки за места', () => {
    const selection = selectAdvancing(groups(4, 4), 2);

    for (const letter of ['a', 'b', 'c', 'd']) {
      expect(halfOf(selection.exits, `${letter}3`)).not.toBe(halfOf(selection.exits, `${letter}4`));
    }
  });
});
