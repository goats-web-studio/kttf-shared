import {
  BONUS_PERCENT,
  DELTA_DIVISOR,
  GAP_ZERO,
  NOVICE_K_LOSS,
  NOVICE_K_WIN,
  NOVICE_SCORE_MULTIPLIER,
  NOVICE_TOURNAMENTS,
  SCORE_MULTIPLIER,
  TOURNAMENT_FACTOR,
  TOURNAMENT_FACTOR_TOP,
} from './constants.js';
import type { PlayerSnapshot } from './types.js';

/**
 * Базовая дельта встречи до коэффициентов: (100 − (Rв − Rп)) / 10.
 *
 * Линейна по разрыву, поэтому непрерывна: у отметки GAP_ZERO нет скачка.
 * Победа фаворита с перевесом 100 и больше даёт ноль. Победа аутсайдера
 * сверху не ограничена — сенсация стоит тем дороже, чем больше разрыв.
 */
export function baseDelta(winnerRating: number, loserRating: number): number {
  return Math.max(0, (GAP_ZERO - (winnerRating - loserRating)) / DELTA_DIVISOR);
}

/** Коэффициент счёта D. Разница считается в сетах. */
export function scoreMultiplier(winnerSets: number, loserSets: number): number {
  const diff = winnerSets - loserSets;
  if (diff <= 1) return SCORE_MULTIPLIER.ONE_SET;
  if (diff === 2) return SCORE_MULTIPLIER.TWO_SETS;
  return SCORE_MULTIPLIER.THREE_PLUS;
}

/**
 * Коэффициент турнира k по среднему рейтингу участников на старте.
 *
 * Объявить его руками нельзя — в этом смысл: клуб не может разогнать
 * рейтинг своих игроков, назвав турнир «национальным» (ОВ-1, ADR-069).
 */
export function tournamentFactor(averageRating: number): number {
  for (const step of TOURNAMENT_FACTOR) {
    if (averageRating < step.below) return step.k;
  }
  return TOURNAMENT_FACTOR_TOP;
}

/** Среднее арифметическое. Пустой состав даёт ноль, а не NaN. */
export function averageOf(ratings: readonly number[]): number {
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

/** Новичок: первые NOVICE_TOURNAMENTS рейтинговых турниров. */
export function isNovice(player: PlayerSnapshot): boolean {
  return player.ratedTournaments < NOVICE_TOURNAMENTS;
}

/**
 * k и D игрока во встрече.
 *
 * Новичок считается по своим коэффициентам, соперник новичка — по общим:
 * «изменение рейтинга обычных игроков не зависит от того, играют они
 * с новичком или с другим обычным игроком» (первоисточник, п. 4).
 */
export function playerFactors(
  player: PlayerSnapshot,
  won: boolean,
  factor: number,
  score: number,
): { readonly k: number; readonly d: number } {
  if (!isNovice(player)) return { k: factor, d: score };
  return { k: won ? NOVICE_K_WIN : NOVICE_K_LOSS, d: NOVICE_SCORE_MULTIPLIER };
}

/**
 * Бонус призёру в процентах от его рейтинга на старте, ещё не делённый.
 *
 * `lead` — превосходство призёра над средним рейтингом сильнейших:
 * меньше 100, от 100 до 150, от 150 до 200 включительно. Больше 200 — ноль.
 * Отрицательное превосходство (призёр слабее сильнейших) — первая строка.
 */
export function bonusPercent(place: PrizePlace, lead: number): number {
  const last = BONUS_PERCENT.length - 1;

  for (const [row, step] of BONUS_PERCENT.entries()) {
    const fits = row === last ? lead <= step.upTo : lead < step.upTo;
    if (fits) return step.places[PLACE_INDEX[place]];
  }

  return 0;
}

/** Призовые места, за которые положен бонус. */
export type PrizePlace = 1 | 2 | 3;

const PLACE_INDEX = { 1: 0, 2: 1, 3: 2 } as const;
