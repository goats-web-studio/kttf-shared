import { describe, expect, it } from 'vitest';

import { splitIntoGroups } from './groups.js';
import type { GroupCandidate } from './groups.js';

/** Посеянные участники без клубов: `s1` сильнейший. */
function seeded(count: number): GroupCandidate[] {
  return Array.from({ length: count }, (_, index) => ({ participant: `s${String(index + 1)}` }));
}

function withClubs(pairs: readonly (readonly [string, string | undefined])[]): GroupCandidate[] {
  return pairs.map(([participant, club]) =>
    club === undefined ? { participant } : { participant, club },
  );
}

describe('splitIntoGroups — раскладка', () => {
  it('пустой список даёт пустой результат', () => {
    expect(splitIntoGroups([], { groupCount: 4 })).toEqual({ groups: [], clubCollisions: [] });
  });

  it('отвергает повторяющихся участников', () => {
    expect(() =>
      splitIntoGroups([{ participant: 'a' }, { participant: 'a' }], { groupCount: 2 }),
    ).toThrow(/уникальны/);
  });

  it('требует задать либо число групп, либо размер', () => {
    expect(() => splitIntoGroups(seeded(4), {})).toThrow(/не задано/);
    expect(() => splitIntoGroups(seeded(4), { groupCount: 2, groupSize: 2 })).toThrow(/не оба/);
  });

  it('отвергает бессмысленные значения', () => {
    expect(() => splitIntoGroups(seeded(4), { groupCount: 0 })).toThrow(/целым от 1/);
    expect(() => splitIntoGroups(seeded(4), { groupSize: 1 })).toThrow(/целым от 2/);
  });

  it('групп не больше, чем участников', () => {
    const { groups } = splitIntoGroups(seeded(3), { groupCount: 10 });
    expect(groups).toHaveLength(3);
  });

  it('размер группы переводится в число групп с округлением вверх', () => {
    expect(splitIntoGroups(seeded(10), { groupSize: 4 }).groups).toHaveLength(3);
    expect(splitIntoGroups(seeded(8), { groupSize: 4 }).groups).toHaveLength(2);
  });

  it('змейка: первая полоса слева направо, вторая справа налево', () => {
    const { groups } = splitIntoGroups(seeded(8), { groupCount: 4 });
    expect(groups.map((group) => group.participants)).toEqual([
      ['s1', 's8'],
      ['s2', 's7'],
      ['s3', 's6'],
      ['s4', 's5'],
    ]);
  });

  it('змейка на трёх полосах продолжает чередование', () => {
    const { groups } = splitIntoGroups(seeded(9), { groupCount: 3 });
    expect(groups.map((group) => group.participants)).toEqual([
      ['s1', 's6', 's7'],
      ['s2', 's5', 's8'],
      ['s3', 's4', 's9'],
    ]);
  });

  it('все участники распределены и никто не потерян', () => {
    for (const [count, groupCount] of [
      [12, 4],
      [17, 4],
      [23, 6],
      [7, 2],
    ] as const) {
      const { groups } = splitIntoGroups(seeded(count), { groupCount });
      const all = groups.flatMap((group) => group.participants);
      expect(all).toHaveLength(count);
      expect(new Set(all).size).toBe(count);
    }
  });

  it('размеры групп различаются не больше чем на одного', () => {
    const { groups } = splitIntoGroups(seeded(17), { groupCount: 4 });
    const sizes = groups.map((group) => group.participants.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('группы подписаны как в зале', () => {
    const { groups } = splitIntoGroups(seeded(4), { groupCount: 2 });
    expect(groups.map((group) => group.label)).toEqual(['гр. 1', 'гр. 2']);
  });

  it('раскладка детерминирована', () => {
    expect(splitIntoGroups(seeded(15), { groupCount: 4 })).toEqual(
      splitIntoGroups(seeded(15), { groupCount: 4 }),
    );
  });
});

describe('splitIntoGroups — разведение по клубам', () => {
  it('одноклубники одной полосы расходятся по разным группам', () => {
    const candidates = withClubs([
      ['a1', 'alpha'],
      ['a2', 'alpha'],
      ['b1', 'beta'],
      ['b2', 'beta'],
    ]);
    const { groups, clubCollisions } = splitIntoGroups(candidates, { groupCount: 2 });
    expect(clubCollisions).toEqual([]);
    for (const group of groups) {
      expect(new Set(group.participants).size).toBe(2);
    }
  });

  it('посев важнее разведения: полосы не перемешиваются', () => {
    // Вся первая полоса из одного клуба — развести внутри полосы нечем,
    // но менять полосу нельзя: это сдвинуло бы игрока через уровень силы.
    const candidates = withClubs([
      ['s1', 'alpha'],
      ['s2', 'alpha'],
      ['s3', 'beta'],
      ['s4', 'beta'],
    ]);
    const { groups } = splitIntoGroups(candidates, { groupCount: 2 });
    // s1 и s2 остались в разных группах — они из одной полосы, их развели
    const groupOf = (id: string): number =>
      groups.findIndex((group) => group.participants.includes(id));
    expect(groupOf('s1')).not.toBe(groupOf('s2'));
  });

  it('неизбежные совпадения сообщаются, а не замалчиваются', () => {
    // Троих из одного клуба в две группы развести арифметически нельзя
    const candidates = withClubs([
      ['a1', 'alpha'],
      ['a2', 'alpha'],
      ['a3', 'alpha'],
      ['b1', 'beta'],
    ]);
    const { clubCollisions } = splitIntoGroups(candidates, { groupCount: 2 });
    expect(clubCollisions).toHaveLength(1);
    expect(clubCollisions[0]?.club).toBe('alpha');
    expect(clubCollisions[0]?.participants).toHaveLength(2);
  });

  it('участники без клуба совпадений не создают', () => {
    const candidates = withClubs([
      ['x1', undefined],
      ['x2', undefined],
      ['x3', undefined],
      ['x4', undefined],
    ]);
    expect(splitIntoGroups(candidates, { groupCount: 2 }).clubCollisions).toEqual([]);
  });

  it('разведение можно выключить', () => {
    const candidates = withClubs([
      ['a1', 'alpha'],
      ['a2', 'alpha'],
      ['b1', 'beta'],
      ['b2', 'beta'],
    ]);
    const off = splitIntoGroups(candidates, { groupCount: 2, separateByClub: false });
    // Без разведения змейка кладёт a1 и a2 в разные группы по построению,
    // но во второй полосе порядок уже не корректируется
    expect(off.groups.map((group) => group.participants)).toEqual([
      ['a1', 'b2'],
      ['a2', 'b1'],
    ]);
  });

  it('на реальном составе клубы разводятся полностью', () => {
    // 16 участников, четыре клуба по четыре человека, четыре группы
    const clubs = ['alpha', 'beta', 'gamma', 'delta'];
    const candidates = Array.from({ length: 16 }, (_, index) => ({
      participant: `p${String(index + 1)}`,
      club: clubs[index % 4] ?? 'alpha',
    }));
    const { clubCollisions } = splitIntoGroups(candidates, { groupCount: 4 });
    expect(clubCollisions).toEqual([]);
  });
});
