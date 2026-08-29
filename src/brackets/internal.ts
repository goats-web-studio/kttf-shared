/**
 * Доступ к элементу, который обязан существовать.
 *
 * `noUncheckedIndexedAccess` заставляет проверять каждое обращение по индексу
 * и каждый `Map.get`, даже когда индекс вычислен строкой выше и заведомо
 * в диапазоне. Без такого помощника защитные ветки расползаются по всему коду
 * и остаются непокрытыми: попасть в них нельзя, а покрытие требует 100%.
 *
 * Здесь эта ветка одна, и она помечена. Если она всё-таки сработает, это
 * означает ошибку в самом движке, и падение с внятным сообщением лучше,
 * чем расчёт таблицы по неполным данным.
 */

export function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  /* v8 ignore next 3 -- недостижимо: индексы вычисляются внутри модуля и всегда в диапазоне */
  if (value === undefined) {
    throw new RangeError(`Индекс ${String(index)} вне диапазона длины ${String(items.length)}`);
  }
  return value;
}

export function mustGet<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  /* v8 ignore next 3 -- недостижимо: ключи берутся из того же набора, что и наполнение */
  if (value === undefined) {
    throw new Error(`Нет данных по ключу ${String(key)}`);
  }
  return value;
}
