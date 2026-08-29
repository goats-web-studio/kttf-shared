import { describe, expect, it } from 'vitest';

import { negate, round2 } from './round.js';

describe('round2', () => {
  it('округляет до двух знаков', () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(10)).toBe(10);
  });

  it('половину уводит от нуля симметрично по знаку', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-2.675)).toBe(-2.68);
  });

  it('round2(-x) всегда равен -round2(x)', () => {
    // Без этого свойства замкнутость сломалась бы на самом округлении.
    for (let value = 0; value <= 50; value += 0.017) {
      expect(round2(-value)).toBe(negate(round2(value)));
    }
  });

  it('снимает шум двоичного представления', () => {
    // 1.005 * 100 в IEEE754 даёт 100.49999999999999
    expect(round2(1.005)).not.toBe(1);
  });

  it('не возвращает минус-ноль', () => {
    expect(Object.is(round2(0), -0)).toBe(false);
    expect(Object.is(round2(-0), -0)).toBe(false);
    expect(Object.is(round2(-0.001), -0)).toBe(false);
  });

  it('отвергает нечисловые значения вместо тихого NaN в рейтинге', () => {
    expect(() => round2(Number.NaN)).toThrow(RangeError);
    expect(() => round2(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => round2(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('negate', () => {
  it('меняет знак', () => {
    expect(negate(5)).toBe(-5);
    expect(negate(-5)).toBe(5);
  });

  it('ноль оставляет положительным', () => {
    expect(Object.is(negate(0), 0)).toBe(true);
    expect(Object.is(negate(-0), 0)).toBe(true);
  });
});
