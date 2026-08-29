import { describe, expect, it } from 'vitest';

import { countRoundRobinMatches, countRounds, scheduleRoundRobin } from './round-robin.js';
import type { ScheduledMatch } from './types.js';

function pairKey(match: ScheduledMatch): string {
  return [match.a, match.b].sort().join('|');
}

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${String(index + 1)}`);
}

describe('scheduleRoundRobin', () => {
  it('меньше двух участников — играть нечего', () => {
    expect(scheduleRoundRobin([])).toEqual([]);
    expect(scheduleRoundRobin(['p1'])).toEqual([]);
  });

  it('отвергает повторяющихся участников', () => {
    expect(() => scheduleRoundRobin(['p1', 'p1'])).toThrow(/уникальны/);
  });

  for (const count of [2, 3, 4, 5, 6, 7, 8, 12, 16, 24]) {
    describe(`${String(count)} участников`, () => {
      const participants = names(count);
      const matches = scheduleRoundRobin(participants);

      it('каждый играет с каждым ровно один раз', () => {
        const seen = new Map<string, number>();
        for (const match of matches) {
          const key = pairKey(match);
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
        expect(seen.size).toBe(countRoundRobinMatches(count));
        expect([...seen.values()].every((times) => times === 1)).toBe(true);
      });

      it('число встреч совпадает с формулой', () => {
        expect(matches.length).toBe((count * (count - 1)) / 2);
      });

      it('никто не играет дважды в одном туре', () => {
        const byRound = new Map<number, string[]>();
        for (const match of matches) {
          const round = byRound.get(match.round) ?? [];
          round.push(match.a, match.b);
          byRound.set(match.round, round);
        }
        for (const [round, players] of byRound) {
          expect(new Set(players).size, `тур ${String(round)}`).toBe(players.length);
        }
      });

      it('туров ровно столько, сколько предсказано', () => {
        const rounds = new Set(matches.map((match) => match.round));
        expect(rounds.size).toBe(countRounds(count));
        expect(Math.min(...rounds)).toBe(1);
        expect(Math.max(...rounds)).toBe(countRounds(count));
      });

      it('никто не играет сам с собой', () => {
        expect(matches.every((match) => match.a !== match.b)).toBe(true);
      });

      it('при нечётном числе в каждом туре ровно один отдыхает', () => {
        if (count % 2 === 0) return;
        const byRound = new Map<number, Set<string>>();
        for (const match of matches) {
          const round = byRound.get(match.round) ?? new Set<string>();
          round.add(match.a);
          round.add(match.b);
          byRound.set(match.round, round);
        }
        for (const [round, playing] of byRound) {
          expect(playing.size, `тур ${String(round)}`).toBe(count - 1);
        }
      });
    });
  }

  it('стороны чередуются: первый участник не играет всегда одной стороной', () => {
    const matches = scheduleRoundRobin(names(6));
    const asA = matches.filter((match) => match.a === 'p1').length;
    const asB = matches.filter((match) => match.b === 'p1').length;
    expect(asA).toBeGreaterThan(0);
    expect(asB).toBeGreaterThan(0);
  });

  it('расписание детерминировано', () => {
    const participants = names(9);
    expect(scheduleRoundRobin(participants)).toEqual(scheduleRoundRobin(participants));
  });
});

describe('scheduleRoundRobin, два круга', () => {
  for (const count of [3, 4, 5, 8]) {
    it(`${String(count)} участников: каждая пара встречается дважды`, () => {
      const matches = scheduleRoundRobin(names(count), 2);
      const seen = new Map<string, number>();
      for (const match of matches) {
        const key = pairKey(match);
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      expect(matches.length).toBe(countRoundRobinMatches(count, 2));
      expect([...seen.values()].every((times) => times === 2)).toBe(true);
    });

    it(`${String(count)} участников: во втором круге стороны меняются`, () => {
      const matches = scheduleRoundRobin(names(count), 2);
      const forward = new Set(matches.map((match) => `${match.a}>${match.b}`));
      for (const match of matches) {
        expect(forward.has(`${match.b}>${match.a}`), `${match.a} — ${match.b}`).toBe(true);
      }
    });

    it(`${String(count)} участников: нумерация туров сквозная`, () => {
      const matches = scheduleRoundRobin(names(count), 2);
      const rounds = [...new Set(matches.map((match) => match.round))].sort((l, r) => l - r);
      expect(rounds).toEqual(
        Array.from({ length: countRounds(count) * 2 }, (_, index) => index + 1),
      );
    });

    it(`${String(count)} участников: в туре по-прежнему никто не играет дважды`, () => {
      const matches = scheduleRoundRobin(names(count), 2);
      const byRound = new Map<number, string[]>();
      for (const match of matches) {
        const round = byRound.get(match.round) ?? [];
        round.push(match.a, match.b);
        byRound.set(match.round, round);
      }
      for (const [round, players] of byRound) {
        expect(new Set(players).size, `тур ${String(round)}`).toBe(players.length);
      }
    });
  }
});

describe('countRounds и countRoundRobinMatches', () => {
  it('при менее чем двух участниках играть нечего', () => {
    for (const count of [0, 1]) {
      expect(countRounds(count)).toBe(0);
      expect(countRoundRobinMatches(count)).toBe(0);
      expect(countRoundRobinMatches(count, 2)).toBe(0);
    }
  });

  it('чётное число даёт на один тур меньше, нечётное — по числу участников', () => {
    expect(countRounds(4)).toBe(3);
    expect(countRounds(5)).toBe(5);
    expect(countRounds(8)).toBe(7);
  });

  it('второй круг удваивает число встреч', () => {
    expect(countRoundRobinMatches(8, 1)).toBe(28);
    expect(countRoundRobinMatches(8, 2)).toBe(56);
  });
});
