import { MIN_RATING } from './constants.js';
import { baseDelta, playerFactors, scoreMultiplier } from './factors.js';
import { negate, round2 } from './round.js';
import type { AppliedDelta, MatchInput, MatchOutput } from './types.js';

/**
 * Расчёт изменения рейтинга по одной встрече. Формула 3.0 — формула RTTF, ADR-069.
 *
 *   base        = max(0, (100 − (Rв − Rп)) / 10)
 *   winnerDelta =  round2(base × k_победителя  × D_победителя)
 *   loserDelta  = −round2(base × k_проигравшего × D_проигравшего)
 *
 * k и D у обычного игрока — коэффициент турнира и коэффициент счёта,
 * у новичка свои (factors.ts, `playerFactors`). Когда новичков во встрече нет,
 * множители совпадают и дельты в точности противоположны — замкнутость
 * обеспечена конструкцией, а не отдельной проверкой.
 */
export function calculateMatch(input: MatchInput): MatchOutput {
  const { winner, loser, winnerSets, loserSets, tournamentFactor, resultType } = input;

  const base = baseDelta(winner.rating, loser.rating);

  // Техническая победа и снятие рейтинг не двигают: обнуляется вся база.
  const played = resultType === 'NORMAL';
  const score = scoreMultiplier(winnerSets, loserSets);
  const won = playerFactors(winner, true, tournamentFactor, score);
  const lost = playerFactors(loser, false, tournamentFactor, score);

  const winnerDelta = played ? round2(base * won.k * won.d) : 0;
  const loserDelta = played ? negate(round2(base * lost.k * lost.d)) : 0;

  return {
    winnerDelta,
    loserDelta,
    imbalance: round2(winnerDelta + loserDelta),
    factors: {
      base,
      tournamentFactor,
      kWinner: won.k,
      kLoser: lost.k,
      dWinner: won.d,
      dLoser: lost.d,
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
