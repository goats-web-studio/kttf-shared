import { describe, expect, it } from 'vitest';

import {
  playerSummaryQuerySchema,
  playerTournamentSchema,
  playerTournamentsQuerySchema,
} from './player-profile.js';

const TOURNAMENT = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Кубок зала',
  startsAt: '2026-10-18T10:00:00.000Z',
  status: 'RATED',
  club: { id: '00000000-0000-4000-8000-000000000002', name: 'Спин' },
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
});
