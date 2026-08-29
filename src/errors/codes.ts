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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Известен ли код. Нужен на границе: коды приходят из JSON и от чужого кода. */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}
