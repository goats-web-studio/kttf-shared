/**
 * Уровень турнира. На рейтинг не влияет с ADR-069: коэффициент турнира
 * выводится из среднего рейтинга участников. Остаётся подписью турнира.
 */
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
  /** Сыграно рейтинговых турниров. Меньше NOVICE_TOURNAMENTS — новичок. */
  readonly ratedTournaments: number;
}

export interface MatchInput {
  readonly winner: PlayerSnapshot;
  readonly loser: PlayerSnapshot;
  readonly winnerSets: number;
  readonly loserSets: number;
  /** Коэффициент турнира k — `tournamentFactor` от среднего рейтинга. */
  readonly tournamentFactor: number;
  readonly resultType: ResultType;
}

/** Все множители, из которых сложился результат. Пишутся в RatingEvent для аудита. */
export interface MatchFactors {
  /** (GAP_ZERO − (Rв − Rп)) / DELTA_DIVISOR, не меньше нуля. */
  readonly base: number;
  readonly tournamentFactor: number;
  /** k победителя: коэффициент турнира или NOVICE_K_WIN. */
  readonly kWinner: number;
  /** k проигравшего: коэффициент турнира или NOVICE_K_LOSS. */
  readonly kLoser: number;
  /** D победителя: по счёту или NOVICE_SCORE_MULTIPLIER. */
  readonly dWinner: number;
  readonly dLoser: number;
}

export interface MatchOutput {
  /** Прибавка победителю. Всегда >= 0. */
  readonly winnerDelta: number;
  /** Убавка проигравшему, со знаком. Всегда <= 0. */
  readonly loserDelta: number;
  /**
   * winnerDelta + loserDelta. Ненулевой только когда во встрече есть новичок:
   * его k и D свои, а соперник считается по общим правилам. Это канал, по
   * которому рейтинг попадает в систему извне, — он измеряется, а не прячется.
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

/** Призовое место участника. Делённое место — одно и то же число у нескольких. */
export interface RatedPlacement {
  readonly playerId: string;
  readonly place: number;
}

export interface TournamentRatingInput {
  /**
   * Все участники турнира в зачёте рейтинга, по идентификатору.
   *
   * Именно все, а не только сыгравшие встречи: по ним считаются средний
   * рейтинг (коэффициент турнира), число участников и сила сильнейших
   * для бонуса. Неполный состав молча изменил бы k у всех.
   */
  readonly players: ReadonlyMap<string, RatedPlayer>;
  /**
   * Встречи в порядке применения.
   *
   * Сумма дельт от порядка не зависит — рейтинги зафиксированы на старте.
   * Порядок определяет только цепочку ratingBefore → ratingAfter в журнале,
   * поэтому он обязан быть воспроизводимым при пересчёте истории.
   */
  readonly matches: readonly RatedMatch[];
  /** Итоговые места. Нужны только для бонуса призёрам, достаточно первых трёх. */
  readonly placements: readonly RatedPlacement[];
}

/** Заготовка записи журнала рейтинга — модель `RatingEvent`, ТС 4.1. */
export interface RatingEventDraft {
  readonly playerId: string;
  /** MATCH — встреча, BONUS — бонус призёру по итогам турнира. */
  readonly type: 'MATCH' | 'BONUS';
  readonly matchId: string | null;
  readonly opponentId: string | null;
  readonly ratingBefore: number;
  /** Фактически применённая величина: при отсечке отличается от расчётной. */
  readonly delta: number;
  readonly ratingAfter: number;
  readonly clamped: boolean;
  /** Рейтинг соперника на старте турнира — против него и считалось. */
  readonly opponentRating: number | null;
  /** k этого игрока во встрече. */
  readonly kFactor: number | null;
  /** Коэффициент турнира по среднему рейтингу. */
  readonly tFactor: number;
  /** D этого игрока во встрече. */
  readonly mFactor: number | null;
  /** Место призёра — только у бонуса. */
  readonly place: number | null;
  /** Бонус в процентах от рейтинга на старте, уже делённый между делящими место. */
  readonly bonusPercent: number | null;
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
  readonly ratedTournaments: number;
  /** Новичок: сыграно меньше NOVICE_TOURNAMENTS рейтинговых турниров. */
  readonly isProvisional: boolean;
}

export interface TournamentRatingResult {
  readonly events: readonly RatingEventDraft[];
  /** Только те, чей рейтинг турнир задел. Остальным писать нечего. */
  readonly players: readonly PlayerRatingOutcome[];
  /** Средний рейтинг участников на старте. */
  readonly averageRating: number;
  /** Коэффициент турнира k. */
  readonly tournamentFactor: number;
  /** Совокупный вброс за турнир: расхождения новичков и бонусы — ТС 5.6. */
  readonly imbalance: number;
}
