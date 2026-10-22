import { describe, expect, it } from 'vitest';

import { calculateStandings } from './standings.js';
import { applyWithdrawals, bracketWalkover, isDecidedByWithdrawal } from './withdrawals.js';

describe('несыгранные встречи снявшегося', () => {
  it('уходят сопернику технической победой', () => {
    // ТЗ 4.4: несыгранные засчитываются сопернику как техническая победа.
    expect(applyWithdrawals([{ a: 'x', b: 'y' }], ['y'], 3)).toEqual([
      { a: 'x', b: 'y', setsA: 3, setsB: 0, resultType: 'WALKOVER' },
    ]);
  });

  it('сторона снявшегося не важна', () => {
    expect(applyWithdrawals([{ a: 'x', b: 'y' }], ['x'], 3)).toEqual([
      { a: 'x', b: 'y', setsA: 0, setsB: 3, resultType: 'WALKOVER' },
    ]);
  });

  it('встречи между оставшимися не трогаются', () => {
    expect(applyWithdrawals([{ a: 'x', b: 'y' }], ['z'], 3)).toEqual([]);
  });

  it('если снялись оба, засчитывать некому', () => {
    // Техническая победа существует ради соперника, а соперника здесь нет.
    expect(applyWithdrawals([{ a: 'x', b: 'y' }], ['x', 'y'], 3)).toEqual([]);
  });

  it('счёт соответствует схеме встречи', () => {
    for (const setsToWin of [2, 3, 4]) {
      expect(applyWithdrawals([{ a: 'x', b: 'y' }], ['y'], setsToWin)[0]?.setsA).toBe(setsToWin);
    }
  });

  it('бессмысленное число сетов отвергается', () => {
    expect(() => applyWithdrawals([], [], 0)).toThrow(/setsToWin/);
  });
});

describe('вместе с таблицей', () => {
  it('снявшийся остаётся в таблице, но очков за неявку не получает', () => {
    // ADR-009: снявшийся из таблицы не исчезает, иначе места остальных
    // пересчитываются задним числом.
    const played = [{ a: 'x', b: 'y', setsA: 3, setsB: 1, resultType: 'NORMAL' as const }];
    const walkovers = applyWithdrawals([{ a: 'y', b: 'z' }], ['y'], 3);

    const standings = calculateStandings(['x', 'y', 'z'], [...played, ...walkovers]);
    const rows = new Map(standings.rows.map((row) => [row.participant, row]));

    expect(rows.get('z')?.wins).toBe(1);
    // За обычное поражение даётся очко, за неявку — ноль.
    expect(rows.get('y')?.points).toBe(1);
    expect(rows.get('y')?.played).toBe(2);
  });
});

describe('встреча, решённая снятием, — ADR-061', () => {
  const out = new Set(['y']);

  it('решена, если оба известны и кто-то снялся', () => {
    expect(isDecidedByWithdrawal({ a: 'x', b: 'y' }, out)).toBe(true);
    expect(isDecidedByWithdrawal({ a: 'y', b: 'x' }, out)).toBe(true);
  });

  it('не решена, если снявшихся в ней нет', () => {
    expect(isDecidedByWithdrawal({ a: 'x', b: 'z' }, out)).toBe(false);
  });

  it('не решена, пока соперник в сетке не определён', () => {
    // Слот пуст до конца предыдущего круга: исход появится вместе с ним.
    expect(isDecidedByWithdrawal({ a: 'y', b: null }, out)).toBe(false);
    expect(isDecidedByWithdrawal({ a: null, b: 'y' }, out)).toBe(false);
  });
});

describe('техническая победа в сетке за снявшегося — ADR-061', () => {
  it('соперник снявшегося проходит дальше', () => {
    expect(bracketWalkover({ a: 'x', b: 'y' }, new Set(['y']), 3)).toEqual({ setsA: 3, setsB: 0 });
    expect(bracketWalkover({ a: 'y', b: 'x' }, new Set(['y']), 2)).toEqual({ setsA: 0, setsB: 2 });
  });

  it('снялись оба — проходит первый, чтобы сетка не встала', () => {
    expect(bracketWalkover({ a: 'x', b: 'y' }, new Set(['x', 'y']), 3)).toEqual({
      setsA: 3,
      setsB: 0,
    });
  });

  it('без снявшихся исхода нет', () => {
    expect(bracketWalkover({ a: 'x', b: 'z' }, new Set(['y']), 3)).toBeNull();
    expect(bracketWalkover({ a: 'y', b: null }, new Set(['y']), 3)).toBeNull();
  });
});
