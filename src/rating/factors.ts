import {
  GAP_ZERO,
  K_BASE,
  K_PROV_LOSS,
  K_PROV_WIN,
  PROVISIONAL_THRESHOLD,
  SCALE,
  SCORE_MULTIPLIER,
} from './constants.js';
import type { PlayerSnapshot } from './types.js';

/**
 * Ожидаемый результат по логистической шкале Эло.
 * Возвращает вероятность победы игрока A в диапазоне (0, 1).
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / SCALE));
}

/**
 * Множитель разрыва G. Реализует правило «победа над заведомо слабым не даёт очков».
 *
 * Затухание линейное, а не отсечка: функция непрерывна, у отметки GAP_ZERO
 * нет скачка, и порога, у которого выгодно «припарковать» рейтинг, не возникает.
 * Если победил аутсайдер, разрыв отрицателен и ограничение не применяется.
 */
export function gapMultiplier(winnerRating: number, loserRating: number): number {
  const gap = Math.max(0, winnerRating - loserRating);
  return Math.max(0, 1 - gap / GAP_ZERO);
}

/** Множитель за счёт M. Разница считается в сетах. */
export function scoreMultiplier(winnerSets: number, loserSets: number): number {
  const diff = winnerSets - loserSets;
  if (diff <= 1) return SCORE_MULTIPLIER.ONE_SET;
  if (diff === 2) return SCORE_MULTIPLIER.TWO_SETS;
  return SCORE_MULTIPLIER.THREE_PLUS;
}

export function isProvisional(player: PlayerSnapshot): boolean {
  return player.ratedMatches < PROVISIONAL_THRESHOLD;
}

/** K игрока. Различается только у провизорного победителя — см. constants.ts. */
export function kFactor(player: PlayerSnapshot, won: boolean): number {
  if (!isProvisional(player)) return K_BASE;
  return won ? K_PROV_WIN : K_PROV_LOSS;
}
