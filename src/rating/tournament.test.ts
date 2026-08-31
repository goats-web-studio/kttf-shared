import { describe, expect, it } from 'vitest';

import { K_BASE, K_PROV_WIN, MIN_RATING, PROVISIONAL_THRESHOLD } from './constants.js';
import { calculateTournamentRating } from './tournament.js';
import type { PlayerSnapshot, RatedMatch, RatedPlayer, TournamentRatingInput } from './types.js';

/**
 * Начисление рейтинга по итогам турнира — ТЗ 7.3.
 *
 * Инварианты движка (ТС 5.5) проверены на одной встрече в invariants.test.ts.
 * Здесь проверяется то, что появляется только на уровне турнира: цепочка
 * событий, независимость итога от порядка ввода счёта и правила отбора встреч.
 */

const RATED: PlayerSnapshot = { rating: 400, ratedMatches: 30 };

function player(atStart: PlayerSnapshot, current: PlayerSnapshot = atStart): RatedPlayer {
  return { atStart, current };
}

function match(overrides: Partial<RatedMatch> = {}): RatedMatch {
  return {
    matchId: 'm1',
    winnerId: 'a',
    loserId: 'b',
    winnerSets: 3,
    loserSets: 1,
    resultType: 'NORMAL',
    ...overrides,
  };
}

function input(overrides: Partial<TournamentRatingInput> = {}): TournamentRatingInput {
  return {
    level: 'REGIONAL',
    players: new Map([
      ['a', player(RATED)],
      ['b', player(RATED)],
    ]),
    matches: [match()],
    ...overrides,
  };
}

describe('одна встреча', () => {
  it('даёт по событию каждому участнику', () => {
    const result = calculateTournamentRating(input());

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.playerId)).toEqual(['a', 'b']);
    expect(result.events.map((event) => event.opponentId)).toEqual(['b', 'a']);
    expect(result.events.every((event) => event.matchId === 'm1')).toBe(true);
  });

  it('цепочка ratingBefore → ratingAfter сходится с дельтой', () => {
    const [winner, loser] = calculateTournamentRating(input()).events;

    expect(winner?.ratingBefore).toBe(400);
    expect(winner?.ratingAfter).toBe(400 + (winner?.delta ?? 0));
    expect(loser?.ratingBefore).toBe(400);
    expect(loser?.ratingAfter).toBe(400 + (loser?.delta ?? 0));
  });

  it('множители записываются для аудита, ожидание — своё у каждого', () => {
    const [winner, loser] = calculateTournamentRating(input()).events;

    expect(winner?.tFactor).toBe(1);
    expect(winner?.mFactor).toBe(1);
    expect(winner?.kFactor).toBe(K_BASE);
    expect(loser?.kFactor).toBe(K_BASE);
    expect(winner?.gapMultiplier).toBe(1);
    // Соперники равны, поэтому обе половины по 0.5 и вместе дают единицу.
    expect((winner?.expected ?? 0) + (loser?.expected ?? 0)).toBeCloseTo(1, 12);
  });

  it('рейтинг соперника берётся из снимка на старте, а не из текущего', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(RATED, { rating: 999, ratedMatches: 30 })],
          ['b', player({ rating: 300, ratedMatches: 30 }, { rating: 111, ratedMatches: 30 })],
        ]),
      }),
    );

    expect(result.events[0]?.opponentRating).toBe(300);
    expect(result.events[1]?.opponentRating).toBe(400);
  });

  it('итог по игроку возвращается вместе со счётчиком и провизорностью', () => {
    const result = calculateTournamentRating(input());

    expect(result.players).toEqual([
      {
        playerId: 'a',
        rating: result.events[0]?.ratingAfter,
        ratedMatches: 31,
        isProvisional: false,
      },
      {
        playerId: 'b',
        rating: result.events[1]?.ratingAfter,
        ratedMatches: 31,
        isProvisional: false,
      },
    ]);
  });
});

describe('отбор встреч', () => {
  it('техническая победа и снятие не дают ни события, ни счётчика', () => {
    for (const resultType of ['WALKOVER', 'RETIRED'] as const) {
      const result = calculateTournamentRating(
        input({ matches: [match({ resultType, winnerSets: 3, loserSets: 0 })] }),
      );

      expect(result.events, resultType).toEqual([]);
      expect(result.players, resultType).toEqual([]);
      expect(result.imbalance, resultType).toBe(0);
    }
  });

  it('нулевая дельта из-за разрыва 100 очков событие даёт, а счётчик двигает', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player({ rating: 500, ratedMatches: 30 })],
          ['b', player({ rating: 300, ratedMatches: 30 })],
        ]),
      }),
    );

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.delta)).toEqual([0, 0]);
    expect(result.events.map((event) => event.gapMultiplier)).toEqual([0, 0]);
    expect(result.players.map((entry) => entry.ratedMatches)).toEqual([31, 31]);
  });

  it('игрок без снимка на старте останавливает расчёт', () => {
    expect(() =>
      calculateTournamentRating(input({ players: new Map([['a', player(RATED)]]) })),
    ).toThrow(/нет снимка на старте/);
  });

  it('незнакомым оказывается и победитель, и проигравший', () => {
    expect(() =>
      calculateTournamentRating(input({ players: new Map([['b', player(RATED)]]) })),
    ).toThrow(/игрока a/);
  });

  it('турнир без единой рейтинговой встречи не трогает никого', () => {
    const result = calculateTournamentRating(input({ matches: [] }));

    expect(result).toEqual({ events: [], players: [], imbalance: 0 });
  });
});

describe('несколько встреч', () => {
  const three: readonly RatedMatch[] = [
    match({ matchId: 'm1', winnerId: 'a', loserId: 'b' }),
    match({ matchId: 'm2', winnerId: 'c', loserId: 'a' }),
    match({ matchId: 'm3', winnerId: 'b', loserId: 'c' }),
  ];

  const threePlayers = new Map([
    ['a', player({ rating: 400, ratedMatches: 30 })],
    ['b', player({ rating: 380, ratedMatches: 25 })],
    ['c', player({ rating: 420, ratedMatches: 40 })],
  ]);

  it('второе событие игрока продолжает первое, а не начинает заново', () => {
    const result = calculateTournamentRating(input({ matches: three, players: threePlayers }));

    const ofA = result.events.filter((event) => event.playerId === 'a');

    expect(ofA).toHaveLength(2);
    expect(ofA[0]?.ratingBefore).toBe(400);
    expect(ofA[1]?.ratingBefore).toBe(ofA[0]?.ratingAfter);
    expect(result.players.find((entry) => entry.playerId === 'a')?.rating).toBe(
      ofA[1]?.ratingAfter,
    );
  });

  it('дельты считаются против снимка, а не против набежавшего рейтинга', () => {
    const result = calculateTournamentRating(input({ matches: three, players: threePlayers }));

    // Во второй встрече соперник A — игрок C. Его рейтинг обязан прийти
    // из снимка (420), хотя к тому моменту C уже сыграл первую встречу.
    const second = result.events.find((event) => event.matchId === 'm2' && event.playerId === 'a');

    expect(second?.opponentRating).toBe(420);
    expect(second?.ratingBefore).not.toBe(400);
  });

  it('итог не зависит от порядка ввода счёта — ТС 5.4', () => {
    const straight = calculateTournamentRating(input({ matches: three, players: threePlayers }));
    const reversed = calculateTournamentRating(
      input({ matches: [...three].reverse(), players: threePlayers }),
    );

    const ratings = (result: typeof straight): Record<string, number> =>
      Object.fromEntries(result.players.map((entry) => [entry.playerId, entry.rating]));

    expect(ratings(reversed)).toEqual(ratings(straight));
    expect(reversed.imbalance).toBe(straight.imbalance);
  });

  it('счётчик рейтинговых встреч растёт на число сыгранных', () => {
    const result = calculateTournamentRating(input({ matches: three, players: threePlayers }));

    expect(result.players.map((entry) => entry.ratedMatches)).toEqual([32, 27, 42]);
  });
});

describe('замкнутость и вброс — ТС 5.5, ТС 5.6', () => {
  it('пара рейтинговых игроков не создаёт очков', () => {
    const result = calculateTournamentRating(input());
    const sum = result.events.reduce((total, event) => total + event.delta, 0);

    expect(sum).toBe(0);
    expect(result.imbalance).toBe(0);
    expect(result.events[0]?.imbalance).toBe(0);
  });

  it('провизорный победитель даёт вброс, и он записан только победителю', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player({ rating: 250, ratedMatches: 0 })],
          ['b', player(RATED)],
        ]),
      }),
    );

    const [winner, loser] = result.events;

    expect(winner?.kFactor).toBe(K_PROV_WIN);
    expect(loser?.kFactor).toBe(K_BASE);
    expect(result.imbalance).toBeGreaterThan(0);
    expect(winner?.imbalance).toBe(result.imbalance);
    expect(loser?.imbalance).toBeNull();
  });

  it('вброс за турнир — сумма вбросов по встречам', () => {
    const players = new Map([
      ['a', player({ rating: 250, ratedMatches: 0 })],
      ['b', player(RATED)],
      ['c', player(RATED)],
    ]);
    const result = calculateTournamentRating(
      input({
        players,
        matches: [
          match({ matchId: 'm1', winnerId: 'a', loserId: 'b' }),
          match({ matchId: 'm2', winnerId: 'a', loserId: 'c' }),
        ],
      }),
    );

    const perMatch = result.events
      .map((event) => event.imbalance ?? 0)
      .reduce((total, value) => total + value, 0);

    expect(result.imbalance).toBeCloseTo(perMatch, 10);
  });

  it('провизорный проигравший вброса не создаёт — K_PROV_LOSS равен K_BASE', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(RATED)],
          ['b', player({ rating: 250, ratedMatches: 0 })],
        ]),
      }),
    );

    expect(result.imbalance).toBe(0);
  });

  it('двадцатая встреча закрывает провизорный период', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player({ rating: 250, ratedMatches: PROVISIONAL_THRESHOLD - 1 })],
          ['b', player(RATED)],
        ]),
      }),
    );

    expect(result.players[0]?.ratedMatches).toBe(PROVISIONAL_THRESHOLD);
    expect(result.players[0]?.isProvisional).toBe(false);
    // K берётся из снимка: на момент турнира игрок ещё был провизорным.
    expect(result.events[0]?.kFactor).toBe(K_PROV_WIN);
  });
});

describe('отсечка по MIN_RATING', () => {
  it('рейтинг не уходит ниже единицы, а расхождение видно в событии', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player({ rating: 400, ratedMatches: 30 })],
          ['b', player({ rating: 380, ratedMatches: 30 }, { rating: 1.5, ratedMatches: 30 })],
        ]),
      }),
    );

    const loser = result.events[1];

    expect(loser?.clamped).toBe(true);
    expect(loser?.ratingAfter).toBe(MIN_RATING);
    expect(loser?.delta).toBe(MIN_RATING - 1.5);
    expect(result.players[1]?.rating).toBe(MIN_RATING);
  });

  it('без срабатывания отсечки признак остаётся снятым', () => {
    expect(calculateTournamentRating(input()).events.every((event) => !event.clamped)).toBe(true);
  });
});
