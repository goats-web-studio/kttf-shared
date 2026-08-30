import { describe, expect, it } from 'vitest';

import { calculateStandings } from '../brackets/standings.js';
import { applyWithdrawals } from '../brackets/withdrawals.js';

import { standingRowSchema, tieGroupSchema } from './standings.js';

/**
 * Схема ответа обязана принимать то, что выдаёт движок.
 *
 * Это два независимых описания одной и той же таблицы: движок считает,
 * схема отдаёт наружу. Разойдутся — консоль в офлайне покажет одно,
 * а сервер другое, и виноватого будет не найти.
 */
describe('схема таблицы и движок', () => {
  it('строки движка проходят схему ответа', () => {
    const standings = calculateStandings(
      ['a', 'b', 'c'],
      [
        { a: 'a', b: 'b', setsA: 3, setsB: 1, resultType: 'NORMAL' },
        { a: 'b', b: 'c', setsA: 3, setsB: 0, resultType: 'NORMAL' },
        { a: 'a', b: 'c', setsA: 3, setsB: 2, resultType: 'NORMAL' },
      ],
    );

    for (const row of standings.rows) {
      expect(standingRowSchema.safeParse(row).success, row.participant).toBe(true);
    }
  });

  it('неразрешённые равенства проходят схему ответа', () => {
    // Круг из трёх побед: правила 1–5 не разделяют, дело за судьёй.
    const standings = calculateStandings(
      ['a', 'b', 'c'],
      [
        { a: 'a', b: 'b', setsA: 3, setsB: 2, resultType: 'NORMAL' },
        { a: 'b', b: 'c', setsA: 3, setsB: 2, resultType: 'NORMAL' },
        { a: 'c', b: 'a', setsA: 3, setsB: 2, resultType: 'NORMAL' },
      ],
    );

    expect(standings.unresolved.length).toBeGreaterThan(0);

    for (const tie of standings.unresolved) {
      expect(tieGroupSchema.safeParse(tie).success).toBe(true);
    }
  });

  it('техническая победа снявшемуся тоже проходит схему', () => {
    const walkovers = applyWithdrawals([{ a: 'a', b: 'b' }], ['b'], 3);
    const standings = calculateStandings(['a', 'b'], walkovers);

    for (const row of standings.rows) {
      expect(standingRowSchema.safeParse(row).success, row.participant).toBe(true);
    }
  });
});
