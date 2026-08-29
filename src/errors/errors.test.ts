import { describe, expect, it } from 'vitest';

import { AppError, ERROR_CODES, isAppError, isErrorCode } from './index.js';

describe('коды ошибок', () => {
  it('ключ совпадает со значением: код в ответе читается без обратного словаря', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value, `${key} расходится со своим значением`).toBe(key);
    }
  });

  it('значения уникальны — иначе два разных отказа локализуются одинаково', () => {
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  it('isErrorCode пропускает известные коды', () => {
    expect(isErrorCode('NOT_FOUND')).toBe(true);
  });

  it('isErrorCode отсеивает чужое', () => {
    // Код приходит из JSON: строка может быть любой, а может и не быть строкой.
    expect(isErrorCode('WHATEVER')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
    // Наследованное от Object не является кодом, хотя `in` сказал бы обратное.
    expect(isErrorCode('toString')).toBe(false);
  });
});

describe('AppError', () => {
  it('несёт код и сведения', () => {
    const error = new AppError(ERROR_CODES.NOT_FOUND, 'player not found', { id: 'x' });

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('player not found');
    expect(error.details).toEqual({ id: 'x' });
  });

  it('сведения необязательны', () => {
    expect(new AppError(ERROR_CODES.FORBIDDEN, 'nope').details).toBeUndefined();
  });

  it('остаётся ошибкой: instanceof и name работают', () => {
    const error = new AppError(ERROR_CODES.INTERNAL_ERROR, 'boom');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(isAppError(error)).toBe(true);
  });

  it('isAppError отсеивает обычные ошибки и не-ошибки', () => {
    expect(isAppError(new Error('boom'))).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
