/**
 * Округление до 2 знаков, half-up по модулю (0.5 уходит от нуля).
 *
 * Симметрично относительно знака: round2(-x) === -round2(x). Это существенно —
 * дельта победителя и проигравшего обязаны округляться одинаково, иначе
 * замкнутость сломается на самом округлении.
 *
 * toFixed(6) снимает накопленный шум двоичного представления: без него
 * 1.005 * 100 даёт 100.49999999999999 и Math.round вернёт 100 вместо 101.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`round2: ожидалось конечное число, получено ${String(value)}`);
  }
  const scaled = Number((Math.abs(value) * 100).toFixed(6));
  const rounded = Math.round(scaled) / 100;
  return value < 0 ? negate(rounded) : rounded;
}

/**
 * Смена знака без появления минус-нуля.
 *
 * `-0` в JavaScript не равен `0` по Object.is, и такой ноль, утёкший в дельту,
 * всплывает потом в сравнениях, сериализации и колонке Decimal. Дельта
 * проигравшего получается отрицанием модуля, поэтому точка появления `-0`
 * ровно одна и закрывается здесь.
 */
export function negate(value: number): number {
  return value === 0 ? 0 : -value;
}
