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

/**
 * Встреча турнира на входе расчёта по итогам.
 *
 * Победитель и проигравший уже определены: ничьей во встрече не бывает.
 * `resultType` остаётся, потому что правило «техническая победа и снятие
 * рейтинг не двигают» принадлежит движку, а не приложению.
 */
export interface RatedMatch {
  readonly matchId: string;
  readonly winnerId: string;
  readonly loserId: string;
  readonly winnerSets: number;
  readonly loserSets: number;
  readonly resultType: ResultType;
}

/** Игрок на входе расчёта по турниру. Два состояния, и они разные. */
export interface RatedPlayer {
  /** Снимок на момент старта: против него считается дельта — ТС 5.4. */
  readonly atStart: PlayerSnapshot;
  /**
   * Текущее состояние проекции: к нему дельта применяется.
   *
   * Совпадает со снимком в обычном случае и расходится, если игрок успел
   * сыграть другой турнир, обсчитанный раньше этого. Журнал событий —
   * источник истины, и цепочка ratingBefore → ratingAfter обязана быть
   * непрерывной именно по нему.
   */
  readonly current: PlayerSnapshot;
}

export interface TournamentRatingInput {
  readonly level: TournamentLevel;
  /** Участники по идентификатору. Достаточно тех, кто встречается в `matches`. */
  readonly players: ReadonlyMap<string, RatedPlayer>;
  /**
   * Встречи в порядке применения.
   *
   * Сумма дельт от порядка не зависит — рейтинги зафиксированы на старте.
   * Порядок определяет только цепочку ratingBefore → ratingAfter в журнале,
   * поэтому он обязан быть воспроизводимым при пересчёте истории.
   */
  readonly matches: readonly RatedMatch[];
}

/** Заготовка записи журнала рейтинга — модель `RatingEvent`, ТС 4.1. */
export interface RatingEventDraft {
  readonly playerId: string;
  readonly matchId: string;
  readonly opponentId: string;
  readonly ratingBefore: number;
  /** Фактически применённая величина: при отсечке отличается от расчётной. */
  readonly delta: number;
  readonly ratingAfter: number;
  readonly clamped: boolean;
  /** Рейтинг соперника на старте турнира — против него и считалось. */
  readonly opponentRating: number;
  readonly kFactor: number;
  readonly tFactor: number;
  readonly mFactor: number;
  /** Ожидаемый результат этого игрока, не победителя. */
  readonly expected: number;
  readonly gapMultiplier: number;
  /**
   * Расхождение дельт встречи. Записывается только победителю: на обеих
   * сторонах оно удвоило бы совокупный вброс при суммировании (ТС 5.6).
   */
  readonly imbalance: number | null;
}

/** Итоговое состояние проекции игрока — `Player.rating` и соседние поля. */
export interface PlayerRatingOutcome {
  readonly playerId: string;
  readonly rating: number;
  readonly ratedMatches: number;
  readonly isProvisional: boolean;
}

export interface TournamentRatingResult {
  readonly events: readonly RatingEventDraft[];
  /** Только те, чей рейтинг турнир задел. Остальным писать нечего. */
  readonly players: readonly PlayerRatingOutcome[];
  /** Совокупный вброс за турнир — метрика инфляции, ТС 5.6. */
  readonly imbalance: number;
}
