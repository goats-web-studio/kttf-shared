import { describe, expect, it } from 'vitest';

import { applyDelta, calculateMatch } from './calculate-match.js';
import { GAP_ZERO, K_BASE, MIN_RATING, PROVISIONAL_THRESHOLD, START_RATING } from './constants.js';
import { gapMultiplier, isProvisional } from './factors.js';
import { generateMatches } from './test-cases.js';
import type { MatchInput } from './types.js';

/**
 * Инварианты движка рейтинга. 03-tech-spec.md, раздел 5.5.
 *
 * Это не «тесты на всякий случай». Ошибка здесь — единственная, которую
 * пользователь не прощает: клуб уходит вместе с игроком, чей рейтинг посчитан
 * неверно. Бриф, раздел 8, приоритет №1.
 */

const CASES = generateMatches();
const RATED = { rating: 400, ratedMatches: 50 } as const;

function movesRating(input: MatchInput): boolean {
  const { winnerDelta, loserDelta } = calculateMatch(input);
  return winnerDelta !== 0 || loserDelta !== 0;
}

describe(`выборка (${String(CASES.length)} случаев)`, () => {
  it('содержит все интересные комбинации', () => {
    expect(CASES.some((c) => movesRating(c))).toBe(true);
    expect(CASES.some((c) => !movesRating(c))).toBe(true);
    expect(CASES.some((c) => isProvisional(c.winner))).toBe(true);
    expect(CASES.some((c) => !isProvisional(c.winner) && !isProvisional(c.loser))).toBe(true);
    expect(CASES.some((c) => c.winner.rating - c.loser.rating >= GAP_ZERO)).toBe(true);
    expect(CASES.some((c) => c.winner.rating < c.loser.rating)).toBe(true);
  });
});

describe('инвариант 1 — замкнутость для рейтинговых', () => {
  it('winnerDelta + loserDelta === 0, когда оба игрока рейтинговые', () => {
    const rated = CASES.filter((c) => !isProvisional(c.winner) && !isProvisional(c.loser));
    expect(rated.length).toBeGreaterThan(100);

    for (const [index, input] of rated.entries()) {
      const { winnerDelta, loserDelta } = calculateMatch(input);
      expect(winnerDelta + loserDelta, `случай ${String(index)}: ${JSON.stringify(input)}`).toBe(0);
    }
  });

  it('imbalance при этом ровно ноль', () => {
    for (const input of CASES.filter((c) => !isProvisional(c.winner) && !isProvisional(c.loser))) {
      expect(calculateMatch(input).imbalance).toBe(0);
    }
  });
});

describe('инвариант 2 — провизорный вброс измерим', () => {
  it('imbalance ненулевой ровно тогда, когда победитель провизорный и встреча двигает рейтинг', () => {
    for (const input of CASES) {
      const result = calculateMatch(input);
      const expectedNonZero = isProvisional(input.winner) && movesRating(input);
      expect(result.imbalance !== 0, JSON.stringify(input)).toBe(expectedNonZero);
    }
  });

  it('провизорный проигравший расхождения не создаёт: K_PROV_LOSS совпадает с K_BASE', () => {
    const result = calculateMatch({
      winner: RATED,
      loser: { rating: 400, ratedMatches: 0 },
      winnerSets: 3,
      loserSets: 0,
      level: 'REGIONAL',
      resultType: 'NORMAL',
    });
    expect(result.factors.kWinner).toBe(K_BASE);
    expect(result.factors.kLoser).toBe(K_BASE);
    expect(result.imbalance).toBe(0);
  });

  it('вброс всегда в пользу игрока, а не против него', () => {
    for (const input of CASES) {
      expect(calculateMatch(input).imbalance).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('инвариант 3 — рейтинг не опускается ниже MIN_RATING', () => {
  it('отсечка срабатывает и помечается', () => {
    const result = applyDelta(5, -100);
    expect(result.rating).toBe(MIN_RATING);
    expect(result.clamped).toBe(true);
    expect(result.appliedDelta).toBe(-4);
  });

  it('при любой дельте из выборки результат не ниже MIN_RATING', () => {
    for (const input of CASES) {
      const { winnerDelta, loserDelta } = calculateMatch(input);
      expect(applyDelta(input.winner.rating, winnerDelta).rating).toBeGreaterThanOrEqual(
        MIN_RATING,
      );
      expect(applyDelta(input.loser.rating, loserDelta).rating).toBeGreaterThanOrEqual(MIN_RATING);
    }
  });

  it('без отсечки применённая дельта равна запрошенной', () => {
    const result = applyDelta(300, -12.34);
    expect(result.clamped).toBe(false);
    expect(result.appliedDelta).toBe(-12.34);
    expect(result.rating).toBe(287.66);
  });
});

describe('инвариант 4 — техническая победа и снятие рейтинг не двигают', () => {
  it('обе дельты равны нулю', () => {
    for (const input of CASES.filter((c) => c.resultType !== 'NORMAL')) {
      const { winnerDelta, loserDelta, imbalance } = calculateMatch(input);
      expect(winnerDelta).toBe(0);
      expect(loserDelta).toBe(0);
      expect(imbalance).toBe(0);
    }
  });
});

describe('инвариант 5 — разрыв GAP_ZERO обнуляет изменение', () => {
  it('при разрыве 100 и более в пользу победителя обе дельты нулевые', () => {
    const wide = CASES.filter((c) => c.winner.rating - c.loser.rating >= GAP_ZERO);
    expect(wide.length).toBeGreaterThan(100);

    for (const input of wide) {
      const { winnerDelta, loserDelta } = calculateMatch(input);
      expect(winnerDelta, JSON.stringify(input)).toBe(0);
      expect(loserDelta).toBe(0);
    }
  });

  it('ровно на границе уже ноль', () => {
    expect(gapMultiplier(350, 250)).toBe(0);
  });

  it('на волос до границы — ещё не ноль', () => {
    expect(gapMultiplier(349.99, 250)).toBeGreaterThan(0);
  });
});

describe('инвариант 6 — непрерывность множителя разрыва', () => {
  it('скачка у границы нет: подход слева даёт околонулевые значения', () => {
    for (const gap of [99, 99.9, 99.99, 99.999]) {
      const value = gapMultiplier(250 + gap, 250);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(0.011);
    }
  });

  it('множитель монотонно убывает с ростом разрыва', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let gap = 0; gap <= 150; gap += 1) {
      const value = gapMultiplier(250 + gap, 250);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('победа аутсайдера ограничением не затронута', () => {
    for (let gap = 1; gap <= 300; gap += 1) {
      expect(gapMultiplier(250, 250 + gap)).toBe(1);
    }
  });
});

describe('инвариант 7 — сенсация тем дороже, чем больше разрыв', () => {
  it('выигрыш победителя монотонно растёт с ростом превосходства соперника', () => {
    let previous = 0;
    for (let gap = 0; gap <= 400; gap += 10) {
      const { winnerDelta } = calculateMatch({
        winner: { rating: 300, ratedMatches: 50 },
        loser: { rating: 300 + gap, ratedMatches: 50 },
        winnerSets: 3,
        loserSets: 0,
        level: 'REGIONAL',
        resultType: 'NORMAL',
      });
      expect(winnerDelta).toBeGreaterThanOrEqual(previous);
      previous = winnerDelta;
    }
  });

  it('победа фаворита стоит меньше победы аутсайдера при том же разрыве', () => {
    const common = {
      winnerSets: 3,
      loserSets: 0,
      level: 'REGIONAL',
      resultType: 'NORMAL',
    } as const;
    const favourite = calculateMatch({
      winner: { rating: 350, ratedMatches: 50 },
      loser: { rating: 300, ratedMatches: 50 },
      ...common,
    });
    const underdog = calculateMatch({
      winner: { rating: 300, ratedMatches: 50 },
      loser: { rating: 350, ratedMatches: 50 },
      ...common,
    });
    expect(underdog.winnerDelta).toBeGreaterThan(favourite.winnerDelta);
  });
});

describe('инвариант 8 — знаки дельт', () => {
  it('победитель не теряет, проигравший не приобретает', () => {
    for (const input of CASES) {
      const { winnerDelta, loserDelta } = calculateMatch(input);
      expect(winnerDelta, JSON.stringify(input)).toBeGreaterThanOrEqual(0);
      expect(loserDelta).toBeLessThanOrEqual(0);
    }
  });

  it('минус-нуля в дельтах не бывает', () => {
    // -0 не равен 0 по Object.is и всплывает потом в сравнениях,
    // сериализации и колонке Decimal. Дельта проигравшего — единственное
    // место, где он может появиться, потому что получается отрицанием.
    for (const input of CASES) {
      const { winnerDelta, loserDelta, imbalance } = calculateMatch(input);
      expect(Object.is(winnerDelta, -0), JSON.stringify(input)).toBe(false);
      expect(Object.is(loserDelta, -0), JSON.stringify(input)).toBe(false);
      expect(Object.is(imbalance, -0)).toBe(false);
    }
  });

  it('applyDelta тоже не возвращает минус-ноль', () => {
    expect(Object.is(applyDelta(0, 0).rating, -0)).toBe(false);
    expect(Object.is(applyDelta(5, -5).rating, -0)).toBe(false);
  });
});

describe('инвариант 9 — округление не создаёт и не уничтожает очки', () => {
  it('в длинной серии между рейтинговыми сумма изменений ровно ноль', () => {
    let ratingA = START_RATING;
    let ratingB = START_RATING;
    const total = ratingA + ratingB;

    for (const [index, input] of CASES.slice(0, 2000).entries()) {
      const aWins = index % 2 === 0;
      const result = calculateMatch({
        winner: {
          rating: aWins ? ratingA : ratingB,
          ratedMatches: PROVISIONAL_THRESHOLD,
        },
        loser: {
          rating: aWins ? ratingB : ratingA,
          ratedMatches: PROVISIONAL_THRESHOLD,
        },
        winnerSets: input.winnerSets,
        loserSets: input.loserSets,
        level: input.level,
        resultType: input.resultType,
      });

      if (aWins) {
        ratingA = applyDelta(ratingA, result.winnerDelta).rating;
        ratingB = applyDelta(ratingB, result.loserDelta).rating;
      } else {
        ratingB = applyDelta(ratingB, result.winnerDelta).rating;
        ratingA = applyDelta(ratingA, result.loserDelta).rating;
      }
    }

    expect(ratingA + ratingB).toBeCloseTo(total, 10);
  });
});

describe('инвариант 10 — пересчёт истории равен инкрементальному расчёту', () => {
  it('сумма дельт из журнала даёт то же значение, что пошаговое применение', () => {
    const journal: number[] = [];
    let incremental = START_RATING;
    const opponent = { rating: 380, ratedMatches: 50 } as const;

    for (const [index, input] of CASES.slice(0, 500).entries()) {
      const snapshot = {
        rating: incremental,
        ratedMatches: PROVISIONAL_THRESHOLD + index,
      };
      const won = index % 3 !== 0;
      const result = calculateMatch({
        winner: won ? snapshot : opponent,
        loser: won ? opponent : snapshot,
        winnerSets: input.winnerSets,
        loserSets: input.loserSets,
        level: input.level,
        resultType: input.resultType,
      });

      const delta = won ? result.winnerDelta : result.loserDelta;
      const applied = applyDelta(incremental, delta);
      journal.push(applied.appliedDelta);
      incremental = applied.rating;
    }

    const replayed = journal.reduce(
      (rating, delta) => applyDelta(rating, delta).rating,
      START_RATING,
    );
    expect(replayed).toBe(incremental);
  });
});
