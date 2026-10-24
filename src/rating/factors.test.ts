import { describe, expect, it } from 'vitest';

import { averageOf, bonusPercent, scoreMultiplier, tournamentFactor } from './factors.js';
import { ratingLevel, ratingLevelRange, RATING_LEVELS } from './level.js';

describe('коэффициент турнира k — по среднему рейтингу участников', () => {
  it.each([
    [0, 0.2],
    [249.99, 0.2],
    [250, 0.25],
    [349.99, 0.25],
    [350, 0.3],
    [449.99, 0.3],
    [450, 0.35],
    [549.99, 0.35],
    [550, 0.4],
    [1400, 0.4],
  ])('средний %s → k = %s', (average, k) => {
    expect(tournamentFactor(average)).toBe(k);
  });
});

describe('коэффициент счёта D', () => {
  it.each([
    [2, 1, 0.8],
    [3, 2, 0.8],
    [4, 3, 0.8],
    [2, 0, 1],
    [3, 1, 1],
    [4, 2, 1],
    [3, 0, 1.2],
    [4, 1, 1.2],
    [4, 0, 1.2],
  ])('%s:%s → D = %s', (winner, loser, d) => {
    expect(scoreMultiplier(winner, loser)).toBe(d);
  });
});

describe('среднее', () => {
  it('пустой состав даёт ноль, а не NaN', () => {
    expect(averageOf([])).toBe(0);
  });

  it('считает обычное среднее', () => {
    expect(averageOf([200, 300, 400])).toBe(300);
  });
});

describe('бонус призёру — процент от рейтинга на старте', () => {
  it.each([
    [-80, [2.5, 1.5, 1]],
    [99.99, [2.5, 1.5, 1]],
    [100, [2, 1, 0.5]],
    [149.99, [2, 1, 0.5]],
    [150, [1, 0.5, 0]],
    [200, [1, 0.5, 0]],
    [200.01, [0, 0, 0]],
  ])('превосходство над сильнейшими %s → %j', (lead, places) => {
    expect([bonusPercent(1, lead), bonusPercent(2, lead), bonusPercent(3, lead)]).toEqual(places);
  });
});

describe('уровень 1–10 — ADR-070', () => {
  it.each([
    [-5, 1],
    [1, 1],
    [99.99, 1],
    [100, 2],
    [199.99, 2],
    [200, 3],
    [300, 4],
    [399.99, 4],
    [400, 5],
    [474.99, 5],
    [475, 6],
    [550, 7],
    [699.99, 7],
    [700, 8],
    [850, 9],
    [999.99, 9],
    [1000, 10],
    [1800, 10],
  ])('рейтинг %s → уровень %s', (rating, level) => {
    expect(ratingLevel(rating)).toBe(level);
  });

  it('диапазоны идут встык, без дыр и наложений', () => {
    for (const level of RATING_LEVELS) {
      const range = ratingLevelRange(level);
      expect(ratingLevel(range.from)).toBe(level);
      if (range.to !== null) expect(ratingLevel(range.to - 0.01)).toBe(level);
    }
  });

  it('у десятого уровня потолка нет', () => {
    expect(ratingLevelRange(10)).toEqual({ from: 1000, to: null });
    expect(ratingLevelRange(1)).toEqual({ from: 0, to: 100 });
  });
});
