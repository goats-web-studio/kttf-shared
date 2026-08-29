/** Уровень турнира. Определяет коэффициент T. */
export type TournamentLevel = 'CLUB' | 'REGIONAL' | 'NATIONAL';

/** Как завершилась встреча. Всё кроме NORMAL рейтинг не двигает. */
export type ResultType = 'NORMAL' | 'WALKOVER' | 'RETIRED';

/**
 * Состояние игрока на момент старта турнира.
 *
 * Именно на момент старта, а не текущее: иначе результат зависит от порядка
 * обработки встреч и локальный расчёт консоли разойдётся с серверным.
 * См. 03-tech-spec.md, раздел 5.4.
 */
export interface PlayerSnapshot {
  readonly rating: number;
  readonly ratedMatches: number;
}

export interface MatchInput {
  readonly winner: PlayerSnapshot;
  readonly loser: PlayerSnapshot;
  readonly winnerSets: number;
  readonly loserSets: number;
  readonly level: TournamentLevel;
  readonly resultType: ResultType;
}

/** Все множители, из которых сложился результат. Пишутся в RatingEvent для аудита. */
export interface MatchFactors {
  readonly expectedWinner: number;
  readonly gapMultiplier: number;
  readonly scoreMultiplier: number;
  readonly levelFactor: number;
  readonly kWinner: number;
  readonly kLoser: number;
}

export interface MatchOutput {
  /** Прибавка победителю. Всегда >= 0. */
  readonly winnerDelta: number;
  /** Убавка проигравшему, со знаком. Всегда <= 0. */
  readonly loserDelta: number;
  /**
   * winnerDelta + loserDelta. Ненулевой только когда K игроков различаются,
   * то есть когда победитель провизорный. Это единственный канал, по которому
   * рейтинг попадает в систему извне — он измеряется, а не прячется.
   */
  readonly imbalance: number;
  readonly factors: MatchFactors;
}

export interface AppliedDelta {
  readonly rating: number;
  /** Фактически применённая величина. Отличается от запрошенной при clamped. */
  readonly appliedDelta: number;
  /** Сработала отсечка по MIN_RATING. */
  readonly clamped: boolean;
}
