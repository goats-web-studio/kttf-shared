import { describe, expect, it } from 'vitest';

import { selectAdvancing, type GroupPlacement } from './group-advance.js';
import { buildKnockout } from './knockout.js';

/** Группа с местами по порядку: первый в списке занял первое место. */
function group(label: string, ordered: readonly string[], unresolved = []): GroupPlacement {
  return {
    label,
    rows: ordered.map((participant, index) => ({ participant, place: index + 1 })),
    unresolved,
  };
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
    const selection = selectAdvancing(
      [
        group('гр. 1', ['a1', 'a2']),
        group('гр. 2', ['b1', 'b2']),
        group('гр. 3', ['c1', 'c2']),
        group('гр. 4', ['d1', 'd2']),
      ],
      2,
    );

    expect(selection.seeded).toEqual(['a1', 'b1', 'c1', 'd1', 'a2', 'b2', 'c2', 'd2']);
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
    expect(selectAdvancing([], 2)).toEqual({ seeded: [], byPlace: [[], []], blocked: [] });
  });

  it('из группы обязан выходить хотя бы один', () => {
    expect(() => selectAdvancing([group('гр. 1', ['a1'])], 0)).toThrow(/хотя бы один/);
    expect(() => selectAdvancing([group('гр. 1', ['a1'])], 1.5)).toThrow(/хотя бы один/);
  });
});
