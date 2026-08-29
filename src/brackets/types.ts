/** Идентификатор участника турнира. Движок не знает, что за ним стоит. */
export type ParticipantId = string;

/** Чем закончилась встреча. Влияет на очки в таблице. */
export type MatchOutcome = 'NORMAL' | 'WALKOVER' | 'RETIRED';

/** Встреча, поставленная в расписание, но ещё без результата. */
export interface ScheduledMatch {
  /** Номер тура, начиная с 1. */
  readonly round: number;
  readonly a: ParticipantId;
  readonly b: ParticipantId;
}

/** Сыгранная встреча. В расчёт таблицы попадают только такие. */
export interface PlayedMatch {
  readonly a: ParticipantId;
  readonly b: ParticipantId;
  readonly setsA: number;
  readonly setsB: number;
  /**
   * Счёт по сетам: `[[11, 9], [9, 11], [11, 7]]`.
   *
   * Нужен для разницы мячей — правила 3 и 5 разрешения равенства. Если не
   * задан, эти правила просто не сработают: разделить участников будет нечем,
   * и дело дойдёт до решения судьи.
   */
  readonly setScores?: readonly (readonly [number, number])[];
  readonly resultType: MatchOutcome;
}

/** Строка групповой таблицы. */
export interface StandingRow {
  readonly participant: ParticipantId;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly points: number;
  readonly setsWon: number;
  readonly setsLost: number;
  readonly setDiff: number;
  readonly ballsWon: number;
  readonly ballsLost: number;
  readonly ballDiff: number;
  /** Место. `null`, пока равенство не разрешено судьёй. */
  readonly place: number | null;
}

/** Участники, которых не удалось разделить правилами 1–5. */
export interface TieGroup {
  readonly participants: readonly ParticipantId[];
  /** Места, которые они делят: например `[2, 3, 4]`. */
  readonly places: readonly number[];
}

export interface Standings {
  readonly rows: readonly StandingRow[];
  /**
   * Неразрешённые равенства. Пока список не пуст, места определены не полностью
   * и турнир не может перейти в «Завершён». Разрешает судья — ADR-008.
   */
  readonly unresolved: readonly TieGroup[];
}

export interface StandingsOptions {
  /**
   * Решения судьи по равенствам: каждый элемент — участники в том порядке,
   * который выбрал судья.
   *
   * Решение приходит на вход, а не берётся изнутри: движок обязан оставаться
   * чистым и детерминированным, иначе консоль в офлайне и сервер получат
   * разные места. ADR-008.
   */
  readonly tieDecisions?: readonly (readonly ParticipantId[])[];
}
