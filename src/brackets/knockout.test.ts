import { describe, expect, it } from 'vitest';

import { buildKnockout, nextPowerOfTwo, seedOrder } from './knockout.js';
import type { BracketMatch, BracketSource } from './knockout.js';

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `s${String(index + 1)}`);
}

function participantOf(source: BracketSource): string | null {
  return source.kind === 'PARTICIPANT' ? source.participant : null;
}

function firstRound(matches: readonly BracketMatch[]): BracketMatch[] {
  return matches.filter((match) => match.round === 1);
}

describe('seedOrder', () => {
  it('канонические расстановки', () => {
    expect(seedOrder(1)).toEqual([1]);
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  it('первый и второй номера расходятся по разным половинам', () => {
    for (const size of [4, 8, 16, 32]) {
      const order = seedOrder(size);
      expect(order.indexOf(1)).toBeLessThan(size / 2);
      expect(order.indexOf(2)).toBeGreaterThanOrEqual(size / 2);
    }
  });

  it('в каждой паре первого круга сумма номеров постоянна', () => {
    for (const size of [4, 8, 16]) {
      const order = seedOrder(size);
      for (let i = 0; i < size; i += 2) {
        expect((order[i] ?? 0) + (order[i + 1] ?? 0)).toBe(size + 1);
      }
    }
  });

  it('содержит каждый номер ровно один раз', () => {
    for (const size of [2, 8, 32]) {
      expect([...seedOrder(size)].sort((l, r) => l - r)).toEqual(
        Array.from({ length: size }, (_, index) => index + 1),
      );
    }
  });

  it('отвергает размер, не являющийся степенью двойки', () => {
    for (const size of [0, 3, 6, 12]) {
      expect(() => seedOrder(size)).toThrow(/степенью двойки/);
    }
  });
});

describe('nextPowerOfTwo', () => {
  it('округляет вверх', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(16)).toBe(16);
    expect(nextPowerOfTwo(17)).toBe(32);
  });
});

describe('buildKnockout', () => {
  it('меньше двух участников — сетки нет', () => {
    expect(buildKnockout([]).matches).toEqual([]);
    expect(buildKnockout(['s1']).matches).toEqual([]);
  });

  it('отвергает повторяющихся участников', () => {
    expect(() => buildKnockout(['s1', 's1'])).toThrow(/уникальны/);
  });

  it('двое играют один финал', () => {
    const bracket = buildKnockout(names(2));
    expect(bracket.bracketSize).toBe(2);
    expect(bracket.rounds).toBe(1);
    expect(bracket.matches).toHaveLength(1);
    expect(bracket.byes).toEqual([]);
  });

  for (const count of [2, 4, 8, 16, 32]) {
    it(`${String(count)} участников: полная сетка без свободных проходов`, () => {
      const bracket = buildKnockout(names(count));
      expect(bracket.bracketSize).toBe(count);
      expect(bracket.byes).toEqual([]);
      // В сетке на N участников ровно N−1 встреча
      expect(bracket.matches).toHaveLength(count - 1);
      expect(firstRound(bracket.matches)).toHaveLength(count / 2);
    });
  }

  for (const count of [3, 5, 6, 7, 9, 12, 20]) {
    it(`${String(count)} участников: свободные проходы уходят верхним сеяным`, () => {
      const bracket = buildKnockout(names(count));
      const expectedByes = nextPowerOfTwo(count) - count;
      expect(bracket.byes).toHaveLength(expectedByes);
      // Проход получают именно первые номера посева, а не кто попало
      expect([...bracket.byes].sort()).toEqual(names(expectedByes).sort());
    });

    it(`${String(count)} участников: встреч ровно на одну меньше числа участников`, () => {
      // Каждая встреча выбывает ровно одного, победитель остаётся один
      expect(buildKnockout(names(count)).matches).toHaveLength(count - 1);
    });

    it(`${String(count)} участников: встречи со свободным проходом не создаются`, () => {
      const bracket = buildKnockout(names(count));
      for (const match of bracket.matches) {
        expect(match.a).toBeDefined();
        expect(match.b).toBeDefined();
      }
    });
  }

  it('каждый участник появляется в сетке ровно один раз', () => {
    for (const count of [5, 11, 16, 23]) {
      const bracket = buildKnockout(names(count));
      const seen = bracket.matches
        .flatMap((match) => [participantOf(match.a), participantOf(match.b)])
        .filter((value): value is string => value !== null);
      const all = [...seen, ...bracket.byes];
      expect(new Set(all).size, `${String(count)} участников`).toBe(count);
    }
  });

  it('первый номер посева встречается со вторым не раньше финала', () => {
    const bracket = buildKnockout(names(8));
    const early = bracket.matches.filter((match) => match.round < bracket.rounds);
    for (const match of early) {
      const pair = [participantOf(match.a), participantOf(match.b)];
      expect(pair.includes('s1') && pair.includes('s2')).toBe(false);
    }
  });

  it('каждая встреча кроме первого круга ждёт победителей предыдущих', () => {
    const bracket = buildKnockout(names(8));
    const ids = new Set(bracket.matches.map((match) => match.id));
    for (const match of bracket.matches.filter((m) => m.round > 1)) {
      for (const source of [match.a, match.b]) {
        if (source.kind === 'WINNER') expect(ids.has(source.matchId)).toBe(true);
      }
    }
  });

  it('сетка детерминирована', () => {
    expect(buildKnockout(names(13))).toEqual(buildKnockout(names(13)));
  });
});

describe('buildKnockout — встреча за третье место', () => {
  it('по умолчанию её нет', () => {
    const bracket = buildKnockout(names(8));
    expect(bracket.matches.some((match) => match.kind === 'THIRD_PLACE')).toBe(false);
  });

  it('добавляется и сводит проигравших в полуфиналах', () => {
    const bracket = buildKnockout(names(8), { thirdPlace: true });
    const third = bracket.matches.find((match) => match.kind === 'THIRD_PLACE');
    expect(third).toBeDefined();
    expect(third?.a.kind).toBe('LOSER');
    expect(third?.b.kind).toBe('LOSER');

    const semifinalIds = bracket.matches
      .filter((match) => match.round === bracket.rounds - 1 && match.kind === 'MAIN')
      .map((match) => match.id);
    expect(semifinalIds).toHaveLength(2);
    for (const source of [third?.a, third?.b]) {
      if (source?.kind === 'LOSER') expect(semifinalIds).toContain(source.matchId);
    }
  });

  it('при неполной сетке полуфиналы всё равно находятся', () => {
    const bracket = buildKnockout(names(5), { thirdPlace: true });
    expect(bracket.matches.some((match) => match.kind === 'THIRD_PLACE')).toBe(true);
  });

  it('на двоих играть за третье место некому', () => {
    const bracket = buildKnockout(names(2), { thirdPlace: true });
    expect(bracket.matches.some((match) => match.kind === 'THIRD_PLACE')).toBe(false);
  });
});

describe('buildKnockout — инвариант расстановки', () => {
  it('свободный проход всегда во второй позиции пары', () => {
    // На этом держится упрощение в buildKnockout: пустой в паре бывает
    // только справа, поэтому левая позиция никогда не пуста.
    for (const count of [3, 5, 6, 7, 9, 11, 13, 20, 31]) {
      const size = nextPowerOfTwo(count);
      const order = seedOrder(size);
      for (let i = 0; i < size; i += 2) {
        const left = order[i] ?? 0;
        const right = order[i + 1] ?? 0;
        const leftIsBye = left > count;
        const rightIsBye = right > count;
        expect(leftIsBye, `${String(count)} участников, пара ${String(i / 2)}`).toBe(false);
        if (rightIsBye) expect(left).toBeLessThanOrEqual(count);
      }
    }
  });
});
