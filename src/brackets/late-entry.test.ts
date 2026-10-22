import { describe, expect, it } from 'vitest';

import { chooseLateGroup, scheduleLateEntry } from './late-entry.js';

/**
 * Поздняя запись в групповой этап — ADR-062.
 *
 * Опоздавший встаёт в группу, которая уже играет: сыгранное остаётся, ему
 * создаются встречи со всеми в группе.
 */

describe('выбор группы для опоздавшего', () => {
  it('в самую малую группу: там встреч меньше всего', () => {
    const key = chooseLateGroup([
      { key: 'A', ratings: [400, 300, 200, 100] },
      { key: 'B', ratings: [400, 300, 200] },
    ]);

    expect(key).toBe('B');
  });

  it('из равных по размеру — в самую слабую по сумме рейтингов', () => {
    const key = chooseLateGroup([
      { key: 'A', ratings: [500, 300, 200] },
      { key: 'B', ratings: [400, 300, 200] },
      { key: 'C', ratings: [450, 300, 200] },
    ]);

    expect(key).toBe('B');
  });

  it('при полном равенстве — первая по порядку', () => {
    expect(
      chooseLateGroup([
        { key: 'A', ratings: [300, 200] },
        { key: 'B', ratings: [200, 300] },
      ]),
    ).toBe('A');
  });

  it('групп нет — выбирать не из чего', () => {
    expect(chooseLateGroup([])).toBeNull();
  });
});

describe('встречи опоздавшего', () => {
  it('со всеми в группе, после последнего тура', () => {
    expect(scheduleLateEntry(['a', 'b', 'c'], 'z', 1, 3)).toEqual([
      { round: 4, a: 'z', b: 'a' },
      { round: 5, a: 'z', b: 'b' },
      { round: 6, a: 'z', b: 'c' },
    ]);
  });

  it('в два круга — второй со сменой сторон', () => {
    expect(scheduleLateEntry(['a', 'b'], 'z', 2, 4)).toEqual([
      { round: 5, a: 'z', b: 'a' },
      { round: 6, a: 'z', b: 'b' },
      { round: 7, a: 'a', b: 'z' },
      { round: 8, a: 'b', b: 'z' },
    ]);
  });

  it('в пустую группу — встреч нет', () => {
    expect(scheduleLateEntry([], 'z', 1, 0)).toEqual([]);
  });

  it('уже стоящий в группе второй раз не добавляется', () => {
    expect(() => scheduleLateEntry(['a', 'z'], 'z', 1, 1)).toThrow(/уже в группе/);
  });
});
