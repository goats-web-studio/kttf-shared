import { describe, expect, it } from 'vitest';

import { calculatePlacement, type PlacementReason as EnginePlacementReason } from '../brackets/index.js';
import { calculateStandings } from '../brackets/standings.js';

import {
  participantRatingSchema,
  placementReasonSchema,
  ratingEventViewSchema,
  resultParticipantSchema,
} from './results.js';
import { tieGroupSchema } from './standings.js';

/**
 * Схема результатов обязана принимать то, что выдаёт движок мест.
 *
 * Это два независимых описания одного и того же: движок считает места,
 * схема отдаёт их наружу. Разойдутся — публичная страница покажет не то,
 * что судья видел в зале.
 */

/**
 * Перечень причин, объявленный через `Record` по типу движка.
 *
 * Появится новая причина в движке — этот файл перестанет компилироваться.
 * Список, переписанный литералами, такой проверки не даёт: он молча отстанет.
 */
const ENGINE_REASONS: Record<EnginePlacementReason, true> = {
  TABLE: true,
  BRACKET: true,
  SHARED: true,
  GROUP_EXIT: true,
  UNDECIDED: true,
};

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

describe('причины места', () => {
  it('перечень в контракте совпадает с перечнем движка', () => {
    expect([...placementReasonSchema.options].sort()).toEqual(Object.keys(ENGINE_REASONS).sort());
  });
});

describe('места движка проходят схему ответа', () => {
  const standings = calculateStandings(
    ['a', 'b', 'c'],
    [
      { a: 'a', b: 'b', setsA: 2, setsB: 0, resultType: 'NORMAL' },
      { a: 'a', b: 'c', setsA: 2, setsB: 0, resultType: 'NORMAL' },
      { a: 'b', b: 'c', setsA: 2, setsB: 0, resultType: 'NORMAL' },
    ],
  );

  it('строка участника собирается из строки движка', () => {
    const placement = calculatePlacement('ROUND_ROBIN', {
      groups: [{ order: 0, standings }],
      finalGroups: [],
      bracket: [],
    });

    for (const row of placement.rows) {
      const parsed = resultParticipantSchema.safeParse({
        player,
        place: row.place,
        reason: row.reason,
        status: 'PLAYING',
        isRated: true,
        seed: null,
      });

      expect(parsed.success, row.participant).toBe(true);
    }
  });

  it('делёж мест из сетки проходит схему равенства', () => {
    const placement = calculatePlacement('KNOCKOUT', {
      groups: [],
      finalGroups: [],
      bracket: [
        { round: 1, kind: 'MAIN', winner: 'a', loser: 'c' },
        { round: 1, kind: 'MAIN', winner: 'b', loser: 'd' },
        { round: 2, kind: 'MAIN', winner: 'a', loser: 'b' },
      ],
    });

    expect(placement.shared).toHaveLength(1);

    for (const tie of placement.shared) {
      expect(tieGroupSchema.safeParse(tie).success).toBe(true);
    }
  });
});

describe('изменение рейтинга', () => {
  it('событие журнала проходит схему', () => {
    const parsed = ratingEventViewSchema.safeParse({
      matchId: '22222222-2222-4222-8222-222222222222',
      ratingBefore: '250.00',
      delta: '16.00',
      ratingAfter: '266.00',
    });

    expect(parsed.success).toBe(true);
  });

  it('десятичные передаются строкой, число схему не проходит', () => {
    // ADR-014: рейтинг ходит строкой, иначе двоичная плавающая точка
    // теряет копейку на пути к клиенту.
    const parsed = ratingEventViewSchema.safeParse({
      matchId: null,
      ratingBefore: 250,
      delta: 16,
      ratingAfter: 266,
    });

    expect(parsed.success).toBe(false);
  });

  it('участник без начисленного рейтинга описывается пустыми значениями', () => {
    const parsed = participantRatingSchema.safeParse({
      playerId: player.id,
      ratingAtStart: '250.00',
      ratingAfter: null,
      totalDelta: '0.00',
      events: [],
    });

    expect(parsed.success).toBe(true);
  });
});
