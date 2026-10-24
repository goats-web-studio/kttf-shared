import { describe, expect, it } from 'vitest';

import { applyDelta, calculateMatch } from './calculate-match.js';
import {
  GAP_ZERO,
  MIN_RATING,
  NOVICE_K_LOSS,
  NOVICE_K_WIN,
  NOVICE_TOURNAMENTS,
  START_RATING,
} from './constants.js';
import { baseDelta, isNovice } from './factors.js';
import { generateMatches } from './test-cases.js';
import type { MatchInput, PlayerSnapshot } from './types.js';

/**
 * Инварианты движка рейтинга. 03-tech-spec.md, раздел 5.5; формула RTTF, ADR-069.
 *
 * Это не «тесты на всякий случай». Ошибка здесь — единственная, которую
 * пользователь не прощает: клуб уходит вместе с игроком, чей рейтинг посчитан
 * неверно. Бриф, раздел 8, приоритет №1.
 */

const CASES = generateMatches();
const REGULAR: PlayerSnapshot = { rating: 400, ratedMatches: 50, ratedTournaments: 10 };
const NOVICE: PlayerSnapshot = { rating: 400, ratedMatches: 3, ratedTournaments: 0 };

function movesRating(input: MatchInput): boolean {
  const { winnerDelta, loserDelta } = calculateMatch(input);
  return winnerDelta !== 0 || loserDelta !== 0;
}

function hasNovice(input: MatchInput): boolean {
  return isNovice(input.winner) || isNovice(input.loser);
}

function match(
  winner: PlayerSnapshot,
  loser: PlayerSnapshot,
  overrides: Partial<MatchInput> = {},
): MatchInput {
  return {
    winner,
    loser,
    winnerSets: 3,
    loserSets: 1,
    tournamentFactor: 0.3,
    resultType: 'NORMAL',
    ...overrides,
  };
}

function rated(rating: number): PlayerSnapshot {
  return { ...REGULAR, rating };
}

describe(`выборка (${String(CASES.length)} случаев)`, () => {
  it('содержит все интересные комбинации', () => {
    expect(CASES.some((c) => movesRating(c))).toBe(true);
    expect(CASES.some((c) => !movesRating(c))).toBe(true);
    expect(CASES.some((c) => isNovice(c.winner))).toBe(true);
    expect(CASES.some((c) => isNovice(c.loser) && !isNovice(c.winner))).toBe(true);
    expect(CASES.some((c) => !hasNovice(c))).toBe(true);
    expect(CASES.some((c) => c.winner.rating - c.loser.rating >= GAP_ZERO)).toBe(true);
    expect(CASES.some((c) => c.winner.rating < c.loser.rating)).toBe(true);
  });
});

describe('первоисточник — примеры, которые обязаны совпасть с RTTF до сотых', () => {
  it('фаворит 500 обыграл 450 со счётом 3:1 при k = 0.3: ±1.5', () => {
    const result = calculateMatch(match(rated(500), rated(450)));
    expect(result.winnerDelta).toBe(1.5);
    expect(result.loserDelta).toBe(-1.5);
  });

  it('аутсайдер 450 обыграл 500 со счётом 3:2 при k = 0.3: ±3.6', () => {
    const result = calculateMatch(match(rated(450), rated(500), { winnerSets: 3, loserSets: 2 }));
    expect(result.winnerDelta).toBe(3.6);
    expect(result.loserDelta).toBe(-3.6);
  });

  it('равные при k = 0.4 и счёте 3:0: 10 × 0.4 × 1.2 = 4.8', () => {
    const result = calculateMatch(
      match(rated(600), rated(600), { tournamentFactor: 0.4, winnerSets: 3, loserSets: 0 }),
    );
    expect(result.winnerDelta).toBe(4.8);
  });

  it('новичок побеждает: k = 1 и D = 1 при любом счёте, соперник — по общим правилам', () => {
    const result = calculateMatch(match(NOVICE, rated(400), { winnerSets: 3, loserSets: 2 }));
    expect(result.factors.kWinner).toBe(NOVICE_K_WIN);
    expect(result.factors.dWinner).toBe(1);
    expect(result.winnerDelta).toBe(10);
    // Соперник новичка: 10 × 0.3 × 0.8
    expect(result.factors.kLoser).toBe(0.3);
    expect(result.loserDelta).toBe(-2.4);
    expect(result.imbalance).toBe(7.6);
  });

  it('новичок проигрывает: k = 0.5, теряет больше, чем получает обычный соперник', () => {
    const result = calculateMatch(match(rated(400), NOVICE));
    expect(result.factors.kLoser).toBe(NOVICE_K_LOSS);
    expect(result.loserDelta).toBe(-5);
    expect(result.winnerDelta).toBe(3);
    expect(result.imbalance).toBe(-2);
  });

  it(`новичок — первые ${String(NOVICE_TOURNAMENTS)} турниров, шестой уже по общим правилам`, () => {
    expect(isNovice({ ...REGULAR, ratedTournaments: NOVICE_TOURNAMENTS - 1 })).toBe(true);
    expect(isNovice({ ...REGULAR, ratedTournaments: NOVICE_TOURNAMENTS })).toBe(false);
  });
});

describe('инвариант 1 — замкнутость, когда новичков во встрече нет', () => {
  it('winnerDelta + loserDelta === 0', () => {
    const regular = CASES.filter((c) => !hasNovice(c));
    expect(regular.length).toBeGreaterThan(100);

    for (const [index, input] of regular.entries()) {
      const { winnerDelta, loserDelta } = calculateMatch(input);
      expect(winnerDelta + loserDelta, `случай ${String(index)}: ${JSON.stringify(input)}`).toBe(0);
    }
  });

  it('imbalance при этом ровно ноль', () => {
    for (const input of CASES.filter((c) => !hasNovice(c))) {
      expect(calculateMatch(input).imbalance).toBe(0);
    }
  });
});

describe('инвариант 2 — расхождение возникает только от новичка', () => {
  it('ненулевой imbalance означает, что во встрече новичок', () => {
    for (const input of CASES) {
      if (calculateMatch(input).imbalance !== 0) {
        expect(hasNovice(input), JSON.stringify(input)).toBe(true);
      }
    }
  });

  it('imbalance — ровно сумма дельт', () => {
    for (const input of CASES) {
      const { winnerDelta, loserDelta, imbalance } = calculateMatch(input);
      expect(imbalance).toBeCloseTo(winnerDelta + loserDelta, 10);
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
  it('при разрыве 100 и более в пользу победителя обе дельты нулевые — и у новичков тоже', () => {
    const wide = CASES.filter((c) => c.winner.rating - c.loser.rating >= GAP_ZERO);
    expect(wide.length).toBeGreaterThan(100);
    expect(wide.some(hasNovice)).toBe(true);

    for (const input of wide) {
      const { winnerDelta, loserDelta } = calculateMatch(input);
      expect(winnerDelta, JSON.stringify(input)).toBe(0);
      expect(loserDelta).toBe(0);
    }
  });

  it('ровно на границе уже ноль', () => {
    expect(baseDelta(350, 250)).toBe(0);
  });

  it('на волос до границы — ещё не ноль', () => {
    expect(baseDelta(349.99, 250)).toBeGreaterThan(0);
  });
});

describe('инвариант 6 — непрерывность у границы', () => {
  it('скачка нет: подход слева даёт околонулевые значения', () => {
    for (const gap of [99, 99.9, 99.99, 99.999]) {
      const value = baseDelta(250 + gap, 250);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(0.1);
    }
  });

  it('база монотонно убывает с ростом превосходства победителя', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let gap = -300; gap <= 150; gap += 1) {
      const value = baseDelta(250 + gap, 250);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('инвариант 7 — сенсация тем дороже, чем больше разрыв', () => {
  it('выигрыш победителя растёт линейно и сверху не ограничен', () => {
    let previous = 0;
    for (let gap = 0; gap <= 800; gap += 10) {
      const { winnerDelta } = calculateMatch(match(rated(300), rated(300 + gap)));
      expect(winnerDelta).toBeGreaterThanOrEqual(previous);
      previous = winnerDelta;
    }
    // (100 + 800) / 10 × 0.3 × 1
    expect(previous).toBe(27);
  });

  it('победа фаворита стоит меньше победы аутсайдера при том же разрыве', () => {
    const favourite = calculateMatch(match(rated(350), rated(300)));
    const underdog = calculateMatch(match(rated(300), rated(350)));
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
  it('в длинной серии между обычными игроками сумма изменений ровно ноль', () => {
    let ratingA = START_RATING;
    let ratingB = START_RATING;
    const total = ratingA + ratingB;

    for (const [index, input] of CASES.slice(0, 2000).entries()) {
      const aWins = index % 2 === 0;
      const result = calculateMatch({
        ...input,
        winner: rated(aWins ? ratingA : ratingB),
        loser: rated(aWins ? ratingB : ratingA),
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
    const opponent = rated(380);

    for (const [index, input] of CASES.slice(0, 500).entries()) {
      const snapshot = { rating: incremental, ratedMatches: index, ratedTournaments: index };
      const won = index % 3 !== 0;
      const result = calculateMatch({
        ...input,
        winner: won ? snapshot : opponent,
        loser: won ? opponent : snapshot,
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
