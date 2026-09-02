import { describe, expect, it } from 'vitest';

import { calculateStandings } from '../brackets/standings.js';

import { screenPingSchema, screenViewSchema, SCREEN_EVENTS } from './screen.js';

/**
 * Экран зала открывается по токену без авторизации, поэтому состав ответа
 * здесь — вопрос не удобства, а того, что уходит наружу вместе со ссылкой,
 * висящей на стене.
 */

const TOURNAMENT_ID = '00000000-0000-4000-8000-000000000001';
const STAGE_ID = '00000000-0000-4000-8000-000000000002';
const GROUP_ID = '00000000-0000-4000-8000-000000000003';
const MATCH_ID = '00000000-0000-4000-8000-000000000004';
const PLAYER_A = '11111111-1111-4111-8111-111111111111';
const PLAYER_B = '22222222-2222-4222-8222-222222222222';

const player = {
  id: PLAYER_A,
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

const tournament = {
  id: TOURNAMENT_ID,
  clubId: '44444444-4444-4444-8444-444444444444',
  name: 'Кубок клуба',
  startsAt: '2026-09-02T10:00:00.000Z',
  registrationEndsAt: null,
  status: 'RUNNING',
  entryFee: 0,
  maxParticipants: null,
  ratingCapMax: null,
  ratingCapMin: null,
  birthYearFrom: null,
  birthYearTo: null,
  genderLimit: null,
  level: 'CLUB',
  tableCount: 4,
  formatConfig: { type: 'ROUND_ROBIN', rounds: 1, setsToWin: 3 },
  seedingConfig: null,
  description: null,
  prizeInfo: null,
  publicToken: 'FDgV6mQ1xKq8yZ2pW7nR4tL0sB3cH5jE',
  participantCount: 2,
  createdAt: '2026-09-01T08:00:00.000Z',
  startedAt: '2026-09-02T10:00:00.000Z',
  finishedAt: null,
  ratedAt: null,
};

const stage = {
  id: STAGE_ID,
  order: 1,
  type: 'ROUND_ROBIN',
  name: 'Круговая',
  groups: [{ id: GROUP_ID, label: 'A', order: 1, participants: [PLAYER_A, PLAYER_B] }],
  matches: [
    {
      id: MATCH_ID,
      stageId: STAGE_ID,
      groupId: GROUP_ID,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
      sourceA: null,
      sourceB: null,
      status: 'PLAYING',
      tableNumber: 2,
      setsA: null,
      setsB: null,
      resultType: null,
      bracketRound: 1,
      bracketSlot: 1,
      startedAt: '2026-09-02T10:05:00.000Z',
      finishedAt: null,
    },
  ],
};

const standings = calculateStandings(
  [PLAYER_A, PLAYER_B],
  [{ a: PLAYER_A, b: PLAYER_B, setsA: 3, setsB: 1, resultType: 'NORMAL' }],
);

const view = {
  tournament,
  players: [player, { ...player, id: PLAYER_B, lastName: 'Сериков' }],
  standings: {
    tournamentId: TOURNAMENT_ID,
    groups: [
      {
        stageId: STAGE_ID,
        groupId: GROUP_ID,
        label: 'A',
        rows: standings.rows,
        unresolved: standings.unresolved,
      },
    ],
  },
  stages: [stage],
  updatedAt: '2026-09-02T10:06:00.000Z',
};

describe('состояние второго экрана', () => {
  it('таблица движка проходит схему ответа', () => {
    expect(screenViewSchema.safeParse(view).success).toBe(true);
  });

  it('очередь и столы в ответе не приходят', () => {
    // Их выводит клиент из `stages` теми же функциями, что и консоль судьи.
    // Готовая очередь в ответе означала бы второе правило вызова пар — на
    // сервере, где его никто не проверяет против того, что видит судья.
    expect(Object.keys(screenViewSchema.shape).sort()).toEqual([
      'players',
      'stages',
      'standings',
      'tournament',
      'updatedAt',
    ]);
  });

  it('журнала рейтинга в ответе нет', () => {
    const parsed = screenViewSchema.parse({ ...view, ratings: [{ playerId: PLAYER_A }] });

    // Ссылка на экран висит на стене и открывается кому угодно. Кто сколько
    // очков потерял — не то, что зритель в зале обязан видеть.
    expect(parsed).not.toHaveProperty('ratings');
  });

  it('без момента сборки состояние не принимается', () => {
    const withoutTime = { ...view, updatedAt: undefined };

    // При обрыве связи стена показывает последнее состояние, и без времени
    // зритель не отличит счёт минутной давности от вчерашнего.
    expect(screenViewSchema.safeParse(withoutTime).success).toBe(false);
  });
});

describe('события потока', () => {
  it('имена событий совпадают с теми, что слушает экран', () => {
    expect(SCREEN_EVENTS).toEqual({ state: 'state', ping: 'ping' });
  });

  it('ping несёт только время', () => {
    expect(screenPingSchema.safeParse({ at: '2026-09-02T10:06:00.000Z' }).success).toBe(true);
  });
});
