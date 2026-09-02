import { describe, expect, it } from 'vitest';

import { headToHeadSchema, playerMatchSchema, ratingHistorySchema } from './player-history.js';

/**
 * История игрока — ТЗ 9.3.
 *
 * Схемы описывают то, что игрок видит о себе. Проверяется главное: рейтинг
 * и его изменения уходят строками, а не числами, и ручная корректировка
 * из кривой не выпадает.
 */

const PLAYER_ID = '00000000-0000-4000-8000-000000000001';
const TOURNAMENT_ID = '00000000-0000-4000-8000-000000000002';
const MATCH_ID = '00000000-0000-4000-8000-000000000003';

const player = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: null,
  lastName: 'Ахметов',
  firstName: 'Данияр',
  middleName: null,
  birthYear: 1995,
  gender: 'MALE',
  city: 'Алматы',
  photoUrl: null,
  clubId: null,
  rating: '294.80',
  ratedMatches: 3,
  isProvisional: true,
  createdAt: '2026-09-01T08:20:00.000Z',
};

const point = {
  tournamentId: TOURNAMENT_ID,
  tournamentName: 'Кубок клуба',
  playedAt: '2026-09-02T10:00:00.000Z',
  ratingBefore: '250.00',
  ratingAfter: '265.25',
  delta: '15.25',
  matches: 3,
};

const match = {
  matchId: MATCH_ID,
  tournamentId: TOURNAMENT_ID,
  tournamentName: 'Кубок клуба',
  stageName: 'Круговая',
  playedAt: '2026-09-02T10:25:00.000Z',
  opponent: player,
  setsFor: 3,
  setsAgainst: 1,
  won: true,
  resultType: 'NORMAL',
  delta: '5.25',
};

describe('история рейтинга', () => {
  it('принимает кривую по турнирам', () => {
    const parsed = ratingHistorySchema.parse({
      playerId: PLAYER_ID,
      current: '265.25',
      points: [point],
    });

    // Сотые обязаны дожить до графика: Decimal(8,2) через число с плавающей
    // точкой их теряет (ADR-014).
    expect(parsed.points[0]?.ratingAfter).toBe('265.25');
  });

  it('ручная корректировка остаётся точкой кривой без турнира', () => {
    // Выкинуть её нельзя: рейтинг после неё другой, и кривая без неё
    // прыгнула бы без объяснения (ТЗ 12).
    expect(
      ratingHistorySchema.safeParse({
        playerId: PLAYER_ID,
        current: '265.25',
        points: [{ ...point, tournamentId: null, tournamentName: null }],
      }).success,
    ).toBe(true);
  });

  it('рейтинг числом не принимается', () => {
    expect(
      ratingHistorySchema.safeParse({ playerId: PLAYER_ID, current: 265.25, points: [] }).success,
    ).toBe(false);
  });
});

describe('встречи игрока', () => {
  it('счёт развёрнут на свои и чужие сеты', () => {
    const parsed = playerMatchSchema.parse(match);

    expect(parsed.setsFor).toBe(3);
    expect(parsed.won).toBe(true);
  });

  it('соперника может не быть: техническая победа над снявшимся', () => {
    expect(playerMatchSchema.safeParse({ ...match, opponent: null }).success).toBe(true);
  });

  it('необсчитанный турнир не даёт дельты', () => {
    // Рейтинг начисляется при завершении турнира (ТЗ 7.3), а встречи видны
    // раньше. Ноль здесь врал бы: изменение ещё не посчитано.
    expect(playerMatchSchema.safeParse({ ...match, delta: null }).success).toBe(true);
  });
});

describe('личный счёт', () => {
  it('итог считает сервер, а не страница встреч', () => {
    const parsed = headToHeadSchema.parse({
      playerId: PLAYER_ID,
      opponent: player,
      wins: 3,
      losses: 1,
      setsWon: 11,
      setsLost: 6,
      matches: [match],
    });

    expect(parsed.wins + parsed.losses).toBe(4);
    // Встреч в ответе меньше, чем сыграно: итог по ним не пересчитывается.
    expect(parsed.matches).toHaveLength(1);
  });
});
