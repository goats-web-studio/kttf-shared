import { type ErrorCode } from './codes.js';

/** Дополнительные сведения об ошибке. Уезжают в поле `details` ответа. */
export type ErrorDetails = Readonly<Record<string, unknown>>;

/**
 * Ошибка домена — бриф 3.5: типизированное исключение с кодом из общего кода.
 *
 * Сообщение внутри предназначено разработчику и в логи; пользователь видит
 * текст, который клиент подобрал по `code`. Поэтому оно английское и не
 * локализуется.
 *
 * Класс живёт здесь, а не в приложении, потому что офлайн-консоль исполняет
 * ту же доменную логику и обязана падать теми же ошибками, что и сервер.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails | undefined;

  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

/** Сужение на границе: `catch` отдаёт `unknown`, а `instanceof` требует значения. */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
