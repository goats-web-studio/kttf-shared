import { describe, expect, it } from 'vitest';

import { createDuelSchema, respondDuelSchema, setsToWin, type CreateDuelInput } from './duel.js';

const CLUB = '7f1d3c1e-2b0a-4c43-9f3b-1a2b3c4d5e6f';
const CITY = '0b9a8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d';
const SLOT = { startsAt: '2026-11-10T13:00:00.000Z', endsAt: '2026-11-10T15:00:00.000Z' };

const duel: CreateDuelInput = { kind: 'DUEL', rated: true, bestOf: 5, clubId: CLUB, slots: [SLOT] };

describe('createDuelSchema', () => {
  it('дуэль в клубе KTTF с одним вариантом времени', () => {
    expect(createDuelSchema.safeParse(duel).success).toBe(true);
  });

  it('дуэль без рейтинга — нельзя', () => {
    expect(createDuelSchema.safeParse({ ...duel, rated: false, bestOf: undefined }).success).toBe(
      false,
    );
  });

  it('нерейтинговый спарринг — без формата, в своём зале с адресом и городом', () => {
    const sparring = {
      kind: 'SPARRING',
      rated: false,
      venueName: 'Школа №12',
      venueAddress: 'ул. Абая, 1',
      cityId: CITY,
      slots: [SLOT],
    };

    expect(createDuelSchema.safeParse(sparring).success).toBe(true);
    expect(createDuelSchema.safeParse({ ...sparring, bestOf: 5 }).success).toBe(false);
    expect(createDuelSchema.safeParse({ ...sparring, cityId: undefined }).success).toBe(false);
  });

  it('рейтинговый спарринг — с форматом', () => {
    const sparring = { ...duel, kind: 'SPARRING' };

    expect(createDuelSchema.safeParse(sparring).success).toBe(true);
    expect(createDuelSchema.safeParse({ ...sparring, bestOf: undefined }).success).toBe(false);
  });

  it('клуб и свой зал разом — нельзя; ни того ни другого — тоже', () => {
    expect(
      createDuelSchema.safeParse({ ...duel, venueName: 'Зал', venueAddress: 'Адрес' }).success,
    ).toBe(false);
    expect(createDuelSchema.safeParse({ ...duel, clubId: undefined }).success).toBe(false);
  });

  it('не больше трёх вариантов времени, каждый от 30 минут до 6 часов', () => {
    expect(createDuelSchema.safeParse({ ...duel, slots: [SLOT, SLOT, SLOT, SLOT] }).success).toBe(
      false,
    );
    expect(
      createDuelSchema.safeParse({
        ...duel,
        slots: [{ startsAt: SLOT.startsAt, endsAt: '2026-11-10T13:15:00.000Z' }],
      }).success,
    ).toBe(false);
    expect(
      createDuelSchema.safeParse({
        ...duel,
        slots: [{ startsAt: SLOT.startsAt, endsAt: '2026-11-10T20:00:00.000Z' }],
      }).success,
    ).toBe(false);
  });
});

describe('respondDuelSchema', () => {
  it('вариант автора или своё время — ровно одно', () => {
    expect(respondDuelSchema.safeParse({ slotId: CLUB }).success).toBe(true);
    expect(respondDuelSchema.safeParse({ proposed: SLOT }).success).toBe(true);
    expect(respondDuelSchema.safeParse({}).success).toBe(false);
    expect(respondDuelSchema.safeParse({ slotId: CLUB, proposed: SLOT }).success).toBe(false);
  });
});

describe('setsToWin', () => {
  it('до 2, 3, 4 побед', () => {
    expect([setsToWin(3), setsToWin(5), setsToWin(7)]).toEqual([2, 3, 4]);
  });
});
