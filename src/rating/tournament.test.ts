import { describe, expect, it } from 'vitest';

import { MIN_RATING, NOVICE_K_WIN, NOVICE_TOURNAMENTS } from './constants.js';
import { calculateTournamentRating } from './tournament.js';
import type {
  PlayerSnapshot,
  RatedMatch,
  RatedPlacement,
  RatedPlayer,
  TournamentRatingInput,
} from './types.js';

/**
 * Начисление рейтинга по итогам турнира — ТЗ 7.3, формула RTTF (ADR-069).
 *
 * Инварианты движка (ТС 5.5) проверены на одной встрече в invariants.test.ts.
 * Здесь проверяется то, что появляется только на уровне турнира: цепочка
 * событий, независимость итога от порядка ввода счёта, правила отбора встреч,
 * коэффициент турнира из среднего рейтинга и бонусы призёрам.
 */

const RATED: PlayerSnapshot = { rating: 400, ratedMatches: 30, ratedTournaments: 10 };

function snap(rating: number, ratedMatches = 30, ratedTournaments = 10): PlayerSnapshot {
  return { rating, ratedMatches, ratedTournaments };
}

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
    placements: [],
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

  it('множители записываются для аудита', () => {
    const [winner, loser] = calculateTournamentRating(input()).events;

    // Средний 400 → k = 0.3; счёт 3:1 → D = 1; база при равных — 10.
    expect(winner?.tFactor).toBe(0.3);
    expect(winner?.kFactor).toBe(0.3);
    expect(winner?.mFactor).toBe(1);
    expect(loser?.kFactor).toBe(0.3);
    expect(winner?.delta).toBe(3);
    expect(loser?.delta).toBe(-3);
    expect(winner?.type).toBe('MATCH');
    expect(winner?.place).toBeNull();
    expect(winner?.bonusPercent).toBeNull();
  });

  it('рейтинг соперника берётся из снимка на старте, а не из текущего', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(RATED, snap(999))],
          ['b', player(snap(300), snap(111))],
        ]),
      }),
    );

    expect(result.events[0]?.opponentRating).toBe(300);
    expect(result.events[1]?.opponentRating).toBe(400);
  });

  it('итог по игроку возвращается вместе со счётчиками и признаком новичка', () => {
    const result = calculateTournamentRating(input());

    expect(result.players).toEqual([
      {
        playerId: 'a',
        rating: result.events[0]?.ratingAfter,
        ratedMatches: 31,
        ratedTournaments: 11,
        isProvisional: false,
      },
      {
        playerId: 'b',
        rating: result.events[1]?.ratingAfter,
        ratedMatches: 31,
        ratedTournaments: 11,
        isProvisional: false,
      },
    ]);
  });

  it('средний рейтинг и k возвращаются вместе с итогом', () => {
    const result = calculateTournamentRating(input());

    expect(result.averageRating).toBe(400);
    expect(result.tournamentFactor).toBe(0.3);
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

  it('нулевая дельта из-за разрыва 100 очков событие даёт, а счётчики двигает', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(snap(500))],
          ['b', player(snap(300))],
        ]),
      }),
    );

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.delta)).toEqual([0, 0]);
    expect(result.players.map((entry) => entry.ratedMatches)).toEqual([31, 31]);
    expect(result.players.map((entry) => entry.ratedTournaments)).toEqual([11, 11]);
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

    expect(result.events).toEqual([]);
    expect(result.players).toEqual([]);
    expect(result.imbalance).toBe(0);
  });
});

describe('несколько встреч', () => {
  const three: readonly RatedMatch[] = [
    match({ matchId: 'm1', winnerId: 'a', loserId: 'b' }),
    match({ matchId: 'm2', winnerId: 'c', loserId: 'a' }),
    match({ matchId: 'm3', winnerId: 'b', loserId: 'c' }),
  ];

  const threePlayers = new Map([
    ['a', player(snap(400, 30))],
    ['b', player(snap(380, 25))],
    ['c', player(snap(420, 40))],
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

  it('счётчик встреч растёт на число сыгранных, турниров — на один', () => {
    const result = calculateTournamentRating(input({ matches: three, players: threePlayers }));

    expect(result.players.map((entry) => entry.ratedMatches)).toEqual([32, 27, 42]);
    expect(result.players.map((entry) => entry.ratedTournaments)).toEqual([11, 11, 11]);
  });
});

describe('коэффициент турнира — из среднего рейтинга всех участников', () => {
  it('в средний входят и те, кто не сыграл ни одной рейтинговой встречи', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(snap(400))],
          ['b', player(snap(400))],
          ['c', player(snap(100))],
        ]),
      }),
    );

    expect(result.averageRating).toBe(300);
    expect(result.tournamentFactor).toBe(0.25);
    expect(result.events[0]?.delta).toBe(2.5);
  });

  it('пустой состав даёт средний ноль и нижний k', () => {
    const result = calculateTournamentRating(input({ players: new Map(), matches: [] }));

    expect(result.averageRating).toBe(0);
    expect(result.tournamentFactor).toBe(0.2);
  });
});

describe('новички и вброс — ТС 5.5, ТС 5.6', () => {
  it('пара обычных игроков не создаёт очков', () => {
    const result = calculateTournamentRating(input());
    const sum = result.events.reduce((total, event) => total + event.delta, 0);

    expect(sum).toBe(0);
    expect(result.imbalance).toBe(0);
    expect(result.events[0]?.imbalance).toBe(0);
  });

  it('новичок-победитель даёт вброс, и он записан только победителю', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(snap(400, 0, 0))],
          ['b', player(RATED)],
        ]),
      }),
    );

    const [winner, loser] = result.events;

    expect(winner?.kFactor).toBe(NOVICE_K_WIN);
    expect(winner?.mFactor).toBe(1);
    expect(loser?.kFactor).toBe(0.3);
    expect(result.imbalance).toBe(7);
    expect(winner?.imbalance).toBe(result.imbalance);
    expect(loser?.imbalance).toBeNull();
  });

  it('вброс за турнир — сумма вбросов по встречам', () => {
    const players = new Map([
      ['a', player(snap(400, 0, 0))],
      ['b', player(RATED)],
      ['c', player(RATED)],
    ]);
    const result = calculateTournamentRating(
      input({
        players,
        matches: [
          match({ matchId: 'm1', winnerId: 'a', loserId: 'b' }),
          match({ matchId: 'm2', winnerId: 'c', loserId: 'a' }),
        ],
      }),
    );

    const perMatch = result.events
      .map((event) => event.imbalance ?? 0)
      .reduce((total, value) => total + value, 0);

    expect(result.imbalance).toBeCloseTo(perMatch, 10);
  });

  it('пятый турнир закрывает период новичка, а k берётся из снимка', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(snap(400, 12, NOVICE_TOURNAMENTS - 1))],
          ['b', player(RATED)],
        ]),
      }),
    );

    expect(result.players[0]?.ratedTournaments).toBe(NOVICE_TOURNAMENTS);
    expect(result.players[0]?.isProvisional).toBe(false);
    expect(result.events[0]?.kFactor).toBe(NOVICE_K_WIN);
  });

  it('новичок остаётся новичком, пока не сыграл пять турниров', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(snap(400, 0, 0))],
          ['b', player(RATED)],
        ]),
      }),
    );

    expect(result.players[0]?.ratedTournaments).toBe(1);
    expect(result.players[0]?.isProvisional).toBe(true);
  });
});

describe('бонус призёрам — первоисточник, п. 5', () => {
  /** Призёры p1–p3 и ещё `extra` участников по 400. */
  function field(
    ratings: { p1?: number; p2?: number; p3?: number } = {},
    extra = 13,
  ): Map<string, RatedPlayer> {
    const players = new Map<string, RatedPlayer>([
      ['p1', player(snap(ratings.p1 ?? 400))],
      ['p2', player(snap(ratings.p2 ?? 400))],
      ['p3', player(snap(ratings.p3 ?? 400))],
    ]);
    for (let index = 0; index < extra; index += 1) {
      players.set('x' + String(index), player(snap(400)));
    }
    return players;
  }

  const podium: readonly RatedPlacement[] = [
    { playerId: 'p1', place: 1 },
    { playerId: 'p2', place: 2 },
    { playerId: 'p3', place: 3 },
  ];

  function bonuses(players: Map<string, RatedPlayer>, placements = podium) {
    return calculateTournamentRating({ players, matches: [], placements }).events;
  }

  it('16 участников, призёры вровень с сильнейшими: 2.5 / 1.5 / 1 %', () => {
    const events = bonuses(field());

    expect(events.map((event) => [event.playerId, event.delta])).toEqual([
      ['p1', 10],
      ['p2', 6],
      ['p3', 4],
    ]);
    expect(events.every((event) => event.type === 'BONUS' && event.matchId === null)).toBe(true);
    expect(events.map((event) => event.place)).toEqual([1, 2, 3]);
    expect(events.map((event) => event.bonusPercent)).toEqual([2.5, 1.5, 1]);
  });

  it('пятнадцать участников — бонуса нет', () => {
    expect(bonuses(field({}, 12))).toEqual([]);
  });

  it('призёр сильнее топ-12 больше чем на 200 — бонуса нет, остальным есть', () => {
    // Топ-12: один 700 и одиннадцать по 400 → 425. 700 − 425 = 275.
    const events = bonuses(field({ p1: 700 }));

    expect(events.map((event) => event.playerId)).toEqual(['p2', 'p3']);
  });

  it('превосходство 150–200 — нижняя строка таблицы, третьему ноль', () => {
    // Топ-12: три по 600 и девять по 400 → 450. 600 − 450 = 150.
    const events = bonuses(field({ p1: 600, p2: 600, p3: 600 }));

    expect(events.map((event) => [event.playerId, event.bonusPercent, event.delta])).toEqual([
      ['p1', 1, 6],
      ['p2', 0.5, 3],
    ]);
  });

  it('делённое место делит бонус: два третьих — по половине каждому', () => {
    const events = bonuses(field(), [...podium, { playerId: 'x0', place: 3 }]);

    const third = events.filter((event) => event.place === 3);
    expect(third.map((event) => [event.playerId, event.bonusPercent, event.delta])).toEqual([
      ['p3', 0.5, 2],
      ['x0', 0.5, 2],
    ]);
  });

  it('призёр вне зачёта бонуса не получает, делящий с ним место — только свою долю', () => {
    const events = bonuses(field(), [...podium, { playerId: 'outsider', place: 3 }]);

    expect(events.filter((event) => event.place === 3).map((event) => event.delta)).toEqual([2]);
  });

  it('бонус меньше сотой не пишется вовсе', () => {
    // Третье место на двоих: 1 % / 2 = 0.5 %. От 0.5 это 0.0025 → 0.
    const players = field({ p3: 0.5 });
    players.set('x0', player(snap(0.5)));
    const events = bonuses(players, [...podium, { playerId: 'x0', place: 3 }]);

    expect(events.filter((event) => event.place === 3)).toEqual([]);
  });

  it('бонус идёт после встреч и продолжает цепочку, вброс учитывает его', () => {
    const result = calculateTournamentRating({
      players: field(),
      matches: [match({ winnerId: 'p1', loserId: 'p2' })],
      placements: podium,
    });

    const ofP1 = result.events.filter((event) => event.playerId === 'p1');
    expect(ofP1.map((event) => event.type)).toEqual(['MATCH', 'BONUS']);
    expect(ofP1[1]?.ratingBefore).toBe(ofP1[0]?.ratingAfter);
    // Бонус — от рейтинга на старте, а не от набежавшего: 400 × 2.5 %.
    expect(ofP1[1]?.delta).toBe(10);
    // Встреча замкнута, вброс — только бонусы: 10 + 6 + 4.
    expect(result.imbalance).toBe(20);
    expect(result.players.find((entry) => entry.playerId === 'p1')?.rating).toBe(413);
  });

  it('призёр без сыгранных встреч получает бонус, но турнир ему не засчитан', () => {
    const result = calculateTournamentRating({ players: field(), matches: [], placements: podium });

    expect(result.players.find((entry) => entry.playerId === 'p1')).toMatchObject({
      rating: 410,
      ratedTournaments: 10,
      ratedMatches: 30,
    });
  });

  it('места ниже третьего бонуса не дают', () => {
    expect(bonuses(field(), [{ playerId: 'p1', place: 4 }])).toEqual([]);
  });
});

describe('отсечка по MIN_RATING', () => {
  it('рейтинг не уходит ниже единицы, а расхождение видно в событии', () => {
    const result = calculateTournamentRating(
      input({
        players: new Map([
          ['a', player(snap(400))],
          ['b', player(snap(380), snap(1.5))],
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
