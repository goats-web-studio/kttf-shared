/**
 * Коды ошибок API.
 *
 * Живут в общем коде, потому что их знают обе стороны: сервер кладёт код в
 * ответ, клиент подбирает по нему локализованный текст. Английские строки
 * пользователю не показываются никогда — бриф 3.4. Формат ответа — ТС 7.8.
 *
 * Здесь только транспортный уровень: то, что может произойти в любом
 * эндпоинте. Доменные коды вроде `TOURNAMENT_ALREADY_STARTED` добавляются
 * вместе с той функцией, которая их порождает, — придумывать их заранее
 * означает изобретать бизнес-правила, чего бриф 4.2 не разрешает.
 */
export const ERROR_CODES = {
  /** Тело или параметры запроса не прошли схему. `details` — список полей. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Запрошенный объект не существует или недоступен этому пользователю. */
  NOT_FOUND: 'NOT_FOUND',
  /** Нет токена, истёк или отозван. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Токен есть, прав на действие нет. */
  FORBIDDEN: 'FORBIDDEN',
  /** Превышен лимит запросов — ТС 8.3. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Необработанный отказ. Наружу не выносит ничего, кроме кода. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // ---------- встречи: ТС 7.6 ----------

  /** Турнир не идёт: счёт вводится только по ходу турнира. */
  TOURNAMENT_NOT_RUNNING: 'TOURNAMENT_NOT_RUNNING',
  /** Участник встречи ещё не определён — предыдущий круг не сыгран (ADR-019). */
  MATCH_NOT_READY: 'MATCH_NOT_READY',
  /** Результат уже введён: изменение идёт отдельным маршрутом (ТЗ 6.3). */
  MATCH_ALREADY_FINISHED: 'MATCH_ALREADY_FINISHED',
  /** Изменять нечего: результата у встречи нет. */
  MATCH_HAS_NO_RESULT: 'MATCH_HAS_NO_RESULT',
  /** Счёт не соответствует схеме встречи. `details.problem` — чем именно. */
  INVALID_SCORE: 'INVALID_SCORE',
  /**
   * Правка отменила бы уже сыгранное ниже по сетке. Откатывать чужие
   * результаты молча нельзя: сначала снимается нижняя встреча.
   */
  DOWNSTREAM_MATCH_PLAYED: 'DOWNSTREAM_MATCH_PLAYED',
  /** Решение судьи не соответствует ни одному неразрешённому равенству. */
  TIE_DECISION_INVALID: 'TIE_DECISION_INVALID',
  /**
   * Игрока нет в расстановке: он не участвует в жеребьёвке или снят.
   * Меняться местами такому не с кем — ТЗ 5.3.
   */
  DRAW_POSITION_NOT_FOUND: 'DRAW_POSITION_NOT_FOUND',

  // ---------- завершение турнира: ТС 7.5 ----------

  /**
   * Не все встречи сыграны — турнир завершать рано (ТЗ 4.1).
   * `details.matchIds` — чего именно не хватает.
   */
  TOURNAMENT_NOT_COMPLETE: 'TOURNAMENT_NOT_COMPLETE',
  /**
   * В таблице осталось равенство, которое судья не разрешил (ADR-008).
   * Пока места не определены, турнир не завершается. `details.groups` — где.
   */
  TIES_UNRESOLVED: 'TIES_UNRESOLVED',
  /**
   * У участника сыгранной встречи нет рейтинга, зафиксированного на старте.
   * Считать по текущему вместо снимка нельзя — это тихо нарушило бы ТС 5.4.
   */
  RATING_SNAPSHOT_MISSING: 'RATING_SNAPSHOT_MISSING',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Известен ли код. Нужен на границе: коды приходят из JSON и от чужого кода. */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}
