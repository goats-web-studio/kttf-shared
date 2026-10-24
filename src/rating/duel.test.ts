import { describe, expect, it } from 'vitest';

import { calculateMatch } from './calculate-match.js';
import { calculateDuelRating, DUEL_WEIGHT, duelRatingBlock, type RatedDuelRecord } from './duel.js';
import { tournamentFactor } from './factors.js';

const DAY = 86_400_000;
const at = new Date('2026-11-10T14:00:00Z');
const shift = (days: number): Date => new Date(at.getTime() + days * DAY);

const regular = { rating: 300, ratedMatches: 50, ratedTournaments: 20 };

describe('calculateDuelRating', () => {
  const duel = (winner = regular, loser = regular) =>
    calculateDuelRating({
      duelId: 'duel',
      winnerId: 'a',
      loserId: 'b',
      winner,
      loser,
      winnerSets: 3,
      loserSets: 1,
    });
  const tournament = (winner = regular) =>
    calculateMatch({
      winner,
      loser: regular,
      winnerSets: 3,
      loserSets: 1,
      tournamentFactor: tournamentFactor(300),
      resultType: 'NORMAL',
    });

  it('два события MATCH, matchId — дуэль', () => {
    const result = duel();

    expect(result.events).toHaveLength(2);
    expect(result.events.every((event) => event.type === 'MATCH' && event.matchId === 'duel')).toBe(
      true,
    );
  });

  it('вдвое меньше такой же турнирной встречи', () => {
    const result = duel();

    expect(result.events[0]?.delta).toBe(tournament().winnerDelta * DUEL_WEIGHT);
    expect(result.events[1]?.delta).toBe(tournament().loserDelta * DUEL_WEIGHT);
  });

  it('вес и у новичка: его k от коэффициента турнира не зависит', () => {
    const novice = { rating: 300, ratedMatches: 2, ratedTournaments: 1 };

    expect(duel(novice).events[0]?.delta).toBe(tournament(novice).winnerDelta * DUEL_WEIGHT);
  });

  it('встреча, а не турнир: ratedMatches растёт, ratedTournaments — нет', () => {
    const [winner] = duel().players;

    expect(winner?.ratedMatches).toBe(51);
    expect(winner?.ratedTournaments).toBe(20);
  });

  it('база × k × D в журнале сходится с записанной дельтой', () => {
    const [event] = duel().events;
    // Равные рейтинги: база (100 − 0) / 10.
    const base = 10;

    expect((event?.kFactor ?? 0) * (event?.mFactor ?? 0) * base).toBeCloseTo(event?.delta ?? 0, 2);
  });
});

describe('duelRatingBlock', () => {
  const pair = (days: number, a = 'a', b = 'b'): RatedDuelRecord => ({
    playerAId: a,
    playerBId: b,
    at: shift(days),
  });

  it('свободно — null', () => {
    expect(duelRatingBlock([], 'a', 'b', at)).toBeNull();
  });

  it('та же пара ближе 7 дней — PAIR, в любую сторону и в любом порядке', () => {
    expect(duelRatingBlock([pair(-6)], 'a', 'b', at)?.kind).toBe('PAIR');
    expect(duelRatingBlock([pair(6, 'b', 'a')], 'a', 'b', at)?.kind).toBe('PAIR');
  });

  it('та же пара через 7 дней — можно', () => {
    expect(duelRatingBlock([pair(-7), pair(7)], 'a', 'b', at)).toBeNull();
  });

  it('четвёртая рейтинговая дуэль игрока за 7 дней — PLAYER', () => {
    const records = [pair(-1, 'a', 'c'), pair(-2, 'a', 'd'), pair(-3, 'a', 'e')];

    expect(duelRatingBlock(records, 'a', 'b', at)).toEqual({ kind: 'PLAYER', playerId: 'a' });
    expect(duelRatingBlock(records, 'b', 'a', at)).toEqual({ kind: 'PLAYER', playerId: 'a' });
  });

  it('три в неделю, если окна не пересекаются, — можно', () => {
    const records = [pair(-6, 'a', 'c'), pair(-5, 'a', 'd'), pair(4, 'a', 'e')];

    expect(duelRatingBlock(records, 'a', 'b', at)).toBeNull();
  });
});
