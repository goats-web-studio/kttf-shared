import { describe, expect, it } from 'vitest';

import { validateMatchResult, type MatchResultInput } from './result.js';

function result(over: Partial<MatchResultInput> = {}): MatchResultInput {
  return { setsA: 3, setsB: 1, resultType: 'NORMAL', ...over };
}

describe('validateMatchResult', () => {
  describe('обычная встреча', () => {
    it('принимает счёт, где победитель взял ровно нужное число сетов', () => {
      const scores: [number, number][] = [
        [3, 0],
        [3, 1],
        [3, 2],
        [0, 3],
        [2, 3],
      ];

      for (const [setsA, setsB] of scores) {
        expect(validateMatchResult(result({ setsA, setsB }), 3), `${String(setsA)}:${String(setsB)}`).toBeNull();
      }
    });

    it('отвергает недобранный и перебранный счёт', () => {
      expect(validateMatchResult(result({ setsA: 2, setsB: 1 }), 3)).toBe('SETS_MISMATCH');
      expect(validateMatchResult(result({ setsA: 4, setsB: 1 }), 3)).toBe('SETS_MISMATCH');
    });

    it('до двух сетов — своя планка', () => {
      expect(validateMatchResult(result({ setsA: 2, setsB: 1 }), 2)).toBeNull();
      expect(validateMatchResult(result({ setsA: 3, setsB: 1 }), 2)).toBe('SETS_MISMATCH');
    });

    it('ничьей во встрече не бывает', () => {
      expect(validateMatchResult(result({ setsA: 2, setsB: 2 }), 3)).toBe('SETS_TIE');
      expect(validateMatchResult(result({ setsA: 0, setsB: 0 }), 3)).toBe('SETS_TIE');
    });

    it('сеты обязаны быть целыми и неотрицательными', () => {
      expect(validateMatchResult(result({ setsA: -1, setsB: 3 }), 3)).toBe('SETS_INVALID');
      expect(validateMatchResult(result({ setsA: 3, setsB: 1.5 }), 3)).toBe('SETS_INVALID');
    });
  });

  describe('техническая победа', () => {
    it('принимает счёт до нуля', () => {
      expect(validateMatchResult(result({ setsA: 3, setsB: 0, resultType: 'WALKOVER' }), 3)).toBe(
        null,
      );
      expect(validateMatchResult(result({ setsA: 0, setsB: 3, resultType: 'WALKOVER' }), 3)).toBe(
        null,
      );
    });

    it('отвергает счёт, в котором сыграны сеты', () => {
      expect(validateMatchResult(result({ setsA: 3, setsB: 1, resultType: 'WALKOVER' }), 3)).toBe(
        'WALKOVER_SETS',
      );
      expect(validateMatchResult(result({ setsA: 2, setsB: 0, resultType: 'WALKOVER' }), 3)).toBe(
        'WALKOVER_SETS',
      );
    });

    it('счёта по сетам не бывает: сетов не играли', () => {
      const walkover = result({
        setsA: 3,
        setsB: 0,
        resultType: 'WALKOVER',
        setScores: [[11, 9]],
      });

      expect(validateMatchResult(walkover, 3)).toBe('SET_SCORES_NOT_ALLOWED');
    });
  });

  describe('снятие по ходу', () => {
    it('принимает недоигранный счёт', () => {
      expect(validateMatchResult(result({ setsA: 1, setsB: 0, resultType: 'RETIRED' }), 3)).toBe(
        null,
      );
      expect(validateMatchResult(result({ setsA: 0, setsB: 2, resultType: 'RETIRED' }), 3)).toBe(
        null,
      );
    });

    it('принимает и полный счёт: снялись после последнего сета', () => {
      expect(validateMatchResult(result({ setsA: 3, setsB: 2, resultType: 'RETIRED' }), 3)).toBe(
        null,
      );
    });

    it('отвергает счёт сверх победного', () => {
      expect(validateMatchResult(result({ setsA: 4, setsB: 0, resultType: 'RETIRED' }), 3)).toBe(
        'RETIRED_SETS',
      );
    });
  });

  describe('счёт по сетам', () => {
    it('без него результат принимается: это опция, а не обязанность', () => {
      expect(validateMatchResult(result({ setScores: undefined }), 3)).toBeNull();
      expect(validateMatchResult(result({ setScores: [] }), 3)).toBeNull();
    });

    it('сходится с числом выигранных сетов', () => {
      const scores = result({
        setsA: 3,
        setsB: 1,
        setScores: [
          [11, 9],
          [9, 11],
          [11, 7],
          [11, 5],
        ],
      });

      expect(validateMatchResult(scores, 3)).toBeNull();
    });

    it('отвергает лишний или недостающий сет', () => {
      const short = result({ setsA: 3, setsB: 1, setScores: [[11, 9]] });

      expect(validateMatchResult(short, 3)).toBe('SET_SCORES_MISMATCH');
    });

    it('отвергает раскладку, где сеты выиграл не тот', () => {
      const wrong = result({
        setsA: 3,
        setsB: 1,
        setScores: [
          [9, 11],
          [9, 11],
          [9, 11],
          [11, 5],
        ],
      });

      expect(validateMatchResult(wrong, 3)).toBe('SET_SCORES_MISMATCH');
    });

    it('отвергает сет без победителя', () => {
      const tied = result({
        setsA: 3,
        setsB: 1,
        setScores: [
          [11, 11],
          [9, 11],
          [11, 7],
          [11, 5],
        ],
      });

      expect(validateMatchResult(tied, 3)).toBe('SET_SCORES_TIE');
    });

    it('мячи обязаны быть целыми и неотрицательными', () => {
      const broken = result({
        setsA: 3,
        setsB: 1,
        setScores: [
          [11, -9],
          [9, 11],
          [11, 7],
          [11, 5],
        ],
      });

      expect(validateMatchResult(broken, 3)).toBe('SETS_INVALID');
    });

    it('счёт внутри сета не проверяется: ТЗ его не задаёт', () => {
      const unusual = result({
        setsA: 3,
        setsB: 0,
        setScores: [
          [11, 0],
          [15, 13],
          [11, 10],
        ],
      });

      expect(validateMatchResult(unusual, 3)).toBeNull();
    });
  });

  it('планка сетов обязана быть целой положительной', () => {
    expect(() => validateMatchResult(result(), 0)).toThrow(/setsToWin/);
    expect(() => validateMatchResult(result(), 2.5)).toThrow(/setsToWin/);
  });
});
