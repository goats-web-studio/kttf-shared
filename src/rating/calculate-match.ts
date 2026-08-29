import { LEVEL_FACTOR, MIN_RATING } from './constants.js';
import { expectedScore, gapMultiplier, kFactor, scoreMultiplier } from './factors.js';
import { negate, round2 } from './round.js';
import type { AppliedDelta, MatchInput, MatchOutput } from './types.js';

/**
 * Расчёт изменения рейтинга по одной встрече. Формула 2.0, ADR-003.
 *
 *   base = T × M × G × (1 − E_победителя)
 *   winnerDelta =  round2(K_победителя  × base)
 *   loserDelta  = −round2(K_проигравшего × base)
 *
 * Базовая величина считается ОДИН раз, K применяется к ней отдельно для каждого
 * игрока. Когда оба игрока рейтинговые, K совпадает и дельты в точности
 * противоположны — замкнутость обеспечена конструкцией, а не отдельной проверкой.
 */
export function calculateMatch(input: MatchInput): MatchOutput {
  const { winner, loser, winnerSets, loserSets, level, resultType } = input;

  const expectedWinner = expectedScore(winner.rating, loser.rating);
  const gap = gapMultiplier(winner.rating, loser.rating);
  const levelFactor = LEVEL_FACTOR[level];
  const kWinner = kFactor(winner, true);
  const kLoser = kFactor(loser, false);

  // Техническая победа и снятие рейтинг не двигают: M = 0 обнуляет всю базу.
  const score = resultType === 'NORMAL' ? scoreMultiplier(winnerSets, loserSets) : 0;

  const base = levelFactor * score * gap * (1 - expectedWinner);

  const winnerDelta = round2(kWinner * base);
  const loserDelta = negate(round2(kLoser * base));

  return {
    winnerDelta,
    loserDelta,
    imbalance: round2(winnerDelta + loserDelta),
    factors: {
      expectedWinner,
      gapMultiplier: gap,
      scoreMultiplier: score,
      levelFactor,
      kWinner,
      kLoser,
    },
  };
}

/**
 * Применение дельты к рейтингу с отсечкой по MIN_RATING.
 *
 * Отсечка — единственное место, где замкнутость может нарушиться механически.
 * Поэтому фактически применённая величина возвращается отдельно: расхождение
 * должно быть видно в аудите, а не раствориться молча.
 */
export function applyDelta(rating: number, delta: number): AppliedDelta {
  const target = round2(rating + delta);

  if (target < MIN_RATING) {
    return {
      rating: MIN_RATING,
      appliedDelta: round2(MIN_RATING - rating),
      clamped: true,
    };
  }

  return { rating: target, appliedDelta: delta, clamped: false };
}
