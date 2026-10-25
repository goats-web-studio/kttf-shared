import { describe, expect, it } from 'vitest';

import { projectDeltas } from './project.js';

const at = (playerId: string, rating: number, tournaments = 10) => ({
  playerId,
  isRated: true,
  ratingAtStart: rating,
  matchesAtStart: 50,
  tournamentsAtStart: tournaments,
});

describe('прогноз дельты — ADR-077', () => {
  it('победитель растёт, проигравший падает, сумма — около нуля у опытных', () => {
    const deltas = projectDeltas(
      [at('a', 300), at('b', 300)],
      [{ id: 'm1', a: 'a', b: 'b', setsA: 3, setsB: 1, resultType: 'NORMAL' }],
    );

    expect(deltas.get('a') ?? 0).toBeGreaterThan(0);
    expect(deltas.get('b') ?? 0).toBeLessThan(0);
  });

  it('техническая победа рейтинг не двигает', () => {
    const deltas = projectDeltas(
      [at('a', 300), at('b', 300)],
      [{ id: 'm1', a: 'a', b: 'b', setsA: 3, setsB: 0, resultType: 'WALKOVER' }],
    );

    expect(deltas.size).toBe(0);
  });

  it('вне зачёта и несыгранное в расчёт не идут', () => {
    const deltas = projectDeltas(
      [at('a', 300), { ...at('b', 300), isRated: false }, at('c', 300)],
      [
        { id: 'm1', a: 'a', b: 'b', setsA: 3, setsB: 0, resultType: 'NORMAL' },
        { id: 'm2', a: 'a', b: 'c', setsA: null, setsB: null, resultType: 'NORMAL' },
      ],
    );

    expect(deltas.size).toBe(0);
  });
});
