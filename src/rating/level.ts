/**
 * Уровень игры 1–10 по рейтингу, по образцу уровней FACEIT — ADR-070.
 *
 * Пороги выведены из распределения рейтинга RTTF (сыгравшие хотя бы один
 * турнир) и из соответствия рейтинга RTTF спортивным разрядам:
 * III разряд 300–400, II 400–550, I 550–700, КМС 700–850, МС 850+.
 * Разбор и цифры — docs/research/rating-levels.md.
 *
 * Уровень — производная рейтинга, а не отдельное состояние: хранить его
 * негде и незачем, он считается на лету одной функцией и на сервере,
 * и в браузере.
 */

export type RatingLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Нижняя граница каждого уровня. */
export const RATING_LEVEL_FLOORS: Readonly<Record<RatingLevel, number>> = {
  1: 0, // новичок
  2: 100, // начинающий
  3: 200, // любитель
  4: 300, // уверенный любитель, III разряд
  5: 400, // продвинутый, II разряд
  6: 475, // сильный любитель, II разряд
  7: 550, // сильный, I разряд
  8: 700, // эксперт, КМС
  9: 850, // мастер, МС
  10: 1000, // элита
};

/** Уровни по возрастанию. */
export const RATING_LEVELS: readonly RatingLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Уровень по рейтингу. Граница принадлежит верхнему уровню: 300 — это 4. */
export function ratingLevel(rating: number): RatingLevel {
  let level: RatingLevel = 1;

  for (const candidate of RATING_LEVELS) {
    if (rating >= RATING_LEVEL_FLOORS[candidate]) level = candidate;
  }

  return level;
}

/** Диапазон уровня: `to` — первая точка следующего уровня, у десятого его нет. */
export function ratingLevelRange(level: RatingLevel): {
  readonly from: number;
  readonly to: number | null;
} {
  return {
    from: RATING_LEVEL_FLOORS[level],
    to: level === 10 ? null : RATING_LEVEL_FLOORS[(level + 1) as RatingLevel],
  };
}
