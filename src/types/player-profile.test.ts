import { describe, expect, it } from 'vitest';

import {
  playerAwardSchema,
  playerBestWinSchema,
  playerBestWinsQuerySchema,
  playerSummarySchema,
  playerSummaryQuerySchema,
  playerTournamentMatchSchema,
  playerTournamentSchema,
  playerTournamentsQuerySchema,
} from './player-profile.js';

const TOURNAMENT = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Кубок зала',
  startsAt: '2026-10-18T10:00:00.000Z',
  status: 'RATED',
  level: 'CLUB',
  club: { id: '00000000-0000-4000-8000-000000000002', name: 'Спин' },
};

const REF = { id: TOURNAMENT.id, name: TOURNAMENT.name, startsAt: TOURNAMENT.startsAt };

const OPPONENT = {
  id: '00000000-0000-4000-8000-000000000003',
  userId: null,
  lastName: 'Сериков',
  firstName: 'Тимур',
  middleName: null,
  birthYear: 1999,
  gender: 'MALE',
  city: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Алматы', nameKk: null },
  photoUrl: null,
  clubId: null,
  rating: '480.00',
  ratedMatches: 40,
  isProvisional: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MATCH = {
  matchId: '00000000-0000-4000-8000-000000000004',
  stageName: 'Группы',
  groupLabel: 'А',
  roundFromFinal: null,
  placement: false,
  startedAt: '2026-10-18T10:05:00.000Z',
  playedAt: '2026-10-18T10:27:00.000Z',
  opponent: OPPONENT,
  opponentRating: '470.10',
  ratingBefore: '421.22',
  setsFor: 3,
  setsAgainst: 1,
  won: true,
  resultType: 'NORMAL',
  delta: '4.10',
  durationMinutes: 22,
};

describe('профиль игрока', () => {
  it('период статистики по умолчанию — всё время', () => {
    expect(playerSummaryQuerySchema.parse({})).toEqual({ period: 'ALL' });
    expect(playerSummaryQuerySchema.parse({ period: 'YEAR' }).period).toBe('YEAR');
    expect(playerSummaryQuerySchema.safeParse({ period: 'WEEK' }).success).toBe(false);
  });

  it('турниры постранично, как остальные списки', () => {
    expect(playerTournamentsQuerySchema.parse({ page: '2', limit: '10' })).toEqual({
      page: 2,
      limit: 10,
    });
  });

  it('делённое место — диапазоном, у идущего турнира места нет', () => {
    const base = {
      tournament: TOURNAMENT,
      participants: 16,
      ratingBefore: '400.00',
      delta: '12.50',
      ratingAfter: '412.50',
      matches: [],
    };

    expect(playerTournamentSchema.safeParse({ ...base, place: 5, placeTo: 8 }).success).toBe(true);
    expect(
      playerTournamentSchema.safeParse({
        ...base,
        tournament: { ...TOURNAMENT, status: 'RUNNING' },
        place: null,
        placeTo: null,
        delta: null,
        ratingAfter: null,
      }).success,
    ).toBe(true);
    expect(playerTournamentSchema.safeParse({ ...base, place: 0, placeTo: null }).success).toBe(
      false,
    );
  });

  it('лучшие победы — со своим периодом, по умолчанию за всё время', () => {
    expect(playerBestWinsQuerySchema.parse({})).toEqual({ period: 'ALL' });
    expect(playerBestWinsQuerySchema.parse({ period: 'QUARTER' }).period).toBe('QUARTER');
  });

  it('лучшая победа несёт оба рейтинга на момент встречи и длительность', () => {
    const win = {
      matchId: MATCH.matchId,
      tournament: REF,
      startedAt: MATCH.startedAt,
      playedAt: MATCH.playedAt,
      ratingBefore: '421.22',
      opponent: OPPONENT,
      opponentRating: '470.10',
      setsFor: 3,
      setsAgainst: 2,
      delta: '6.40',
      durationMinutes: 22,
    };

    expect(playerBestWinSchema.parse(win)).toEqual(win);
    // Встреча, внесённая без вызова к столу, длительности не имеет — это не ноль.
    expect(
      playerBestWinSchema.safeParse({ ...win, startedAt: null, durationMinutes: null }).success,
    ).toBe(true);
    expect(playerBestWinSchema.safeParse({ ...win, durationMinutes: -1 }).success).toBe(false);
  });

  it('встреча в результатах — время, рейтинг соперника и длительность', () => {
    expect(playerTournamentMatchSchema.parse(MATCH)).toEqual(MATCH);
    expect(
      playerTournamentMatchSchema.safeParse({
        ...MATCH,
        opponent: null,
        opponentRating: null,
        ratingBefore: null,
        delta: null,
        startedAt: null,
        durationMinutes: null,
      }).success,
    ).toBe(true);
  });

  it('турнир в результатах — с уровнем', () => {
    const base = {
      tournament: TOURNAMENT,
      place: 1,
      placeTo: null,
      participants: 8,
      ratingBefore: '400.00',
      delta: '12.50',
      ratingAfter: '412.50',
      matches: [MATCH],
    };

    expect(playerTournamentSchema.safeParse(base).success).toBe(true);
    expect(
      playerTournamentSchema.safeParse({ ...base, tournament: { ...TOURNAMENT, level: 'CITY' } })
        .success,
    ).toBe(false);
  });

  it('награда знает клуб: строка медалей — на клуб', () => {
    const award = { tournament: REF, club: TOURNAMENT.club, place: 2 };

    expect(playerAwardSchema.parse(award)).toEqual(award);
    expect(playerAwardSchema.safeParse({ tournament: REF, place: 2 }).success).toBe(false);
    expect(playerAwardSchema.safeParse({ ...award, place: 4 }).success).toBe(false);
  });

  it('сводка — с датой максимума, лучшие победы в ней больше не живут', () => {
    const summary = {
      playerId: OPPONENT.id,
      rank: 3,
      rankedPlayers: 120,
      maxRating: '480.00',
      maxRatingAt: '2026-09-01T12:00:00.000Z',
      period: 'ALL',
      tournaments: 4,
      wins: 10,
      losses: 5,
      firstTournament: REF,
      favoriteClub: { ...TOURNAMENT.club, tournaments: 4 },
      awards: [],
    };

    expect(playerSummarySchema.parse(summary)).toEqual(summary);
    expect(playerSummarySchema.shape).not.toHaveProperty('bestWins');
    expect(playerSummarySchema.safeParse({ ...summary, maxRatingAt: null }).success).toBe(true);
  });
});
