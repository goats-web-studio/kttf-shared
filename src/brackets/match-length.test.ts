import { describe, expect, it } from 'vitest';

import { buildKnockout } from './knockout.js';
import { playoffRoundOf, playoffRoundsFor, playoffSetsToWin } from './match-length.js';

/** Сетка на 16: четыре круга, финал — четвёртый. */
const ROUNDS_16 = 4;

describe('круг сетки по позиции встречи', () => {
  it('финал и встреча за третье место — последний круг, разные позиции', () => {
    expect(playoffRoundOf({ round: 4, slot: 0 }, ROUNDS_16)).toBe('final');
    expect(playoffRoundOf({ round: 4, slot: 1 }, ROUNDS_16)).toBe('thirdPlace');
  });

  it('круги считаются от финала', () => {
    expect(playoffRoundOf({ round: 3, slot: 1 }, ROUNDS_16)).toBe('semifinal');
    expect(playoffRoundOf({ round: 2, slot: 3 }, ROUNDS_16)).toBe('quarterfinal');
    expect(playoffRoundOf({ round: 1, slot: 7 }, ROUNDS_16)).toBe('roundOf16');
  });

  it('круг раньше 1/64 отдельной длины не имеет', () => {
    // Сетка на 512: девять кругов. Именованных от финала шесть — с девятого
    // по четвёртый; третий круг — это 1/128.
    expect(playoffRoundOf({ round: 3, slot: 0 }, 9)).toBeNull();
    expect(playoffRoundOf({ round: 4, slot: 0 }, 9)).toBe('roundOf64');
  });

  it('позиции совпадают с тем, как сетку строит движок', () => {
    // Правило опирается на расстановку buildKnockout: если она изменится,
    // финал и встреча за третье место не должны поменяться местами молча.
    const bracket = buildKnockout(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], { thirdPlace: true });
    const third = bracket.matches.find((match) => match.kind === 'THIRD_PLACE');
    const final = bracket.matches.find(
      (match) => match.kind === 'MAIN' && match.round === bracket.rounds,
    );

    expect(third && playoffRoundOf(third, bracket.rounds)).toBe('thirdPlace');
    expect(final && playoffRoundOf(final, bracket.rounds)).toBe('final');
  });
});

describe('длина встречи плей-офф', () => {
  const lengths = { final: 4, thirdPlace: 2, quarterfinal: 2 };

  it('заданный круг играется своей длиной', () => {
    expect(playoffSetsToWin(3, lengths, { round: 4, slot: 0 }, ROUNDS_16)).toBe(4);
    expect(playoffSetsToWin(3, lengths, { round: 4, slot: 1 }, ROUNDS_16)).toBe(2);
    expect(playoffSetsToWin(3, lengths, { round: 2, slot: 0 }, ROUNDS_16)).toBe(2);
  });

  it('не заданный — общей длиной плей-офф', () => {
    expect(playoffSetsToWin(3, lengths, { round: 3, slot: 0 }, ROUNDS_16)).toBe(3);
    expect(playoffSetsToWin(3, undefined, { round: 4, slot: 0 }, ROUNDS_16)).toBe(3);
    expect(playoffSetsToWin(3, lengths, { round: 1, slot: 0 }, 8)).toBe(3);
  });
});

describe('круги для формы', () => {
  it('предлагаются только те, что будут в сетке', () => {
    expect(playoffRoundsFor(16, true)).toEqual([
      'final',
      'thirdPlace',
      'semifinal',
      'quarterfinal',
      'roundOf16',
    ]);
    expect(playoffRoundsFor(8, false)).toEqual(['final', 'semifinal', 'quarterfinal']);
  });

  it('без полуфиналов встречи за третье место нет', () => {
    expect(playoffRoundsFor(2, true)).toEqual(['final']);
    expect(playoffRoundsFor(0, true)).toEqual([]);
  });

  it('сетка больше 128 настраивается до 1/64', () => {
    expect(playoffRoundsFor(512, false)).toHaveLength(6);
  });
});
