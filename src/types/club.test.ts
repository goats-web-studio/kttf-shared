import { describe, expect, it } from 'vitest';

import { addMemberSchema, clubViewSchema, createClubSchema, updateClubSchema } from './club.js';

const CLUB_ID = '00000000-0000-4000-8000-000000000001';

describe('создание клуба', () => {
  it('название и город обязательны, остальное нет', () => {
    expect(createClubSchema.safeParse({ name: 'Ракетка', city: 'Алматы' }).success).toBe(true);
    expect(createClubSchema.safeParse({ name: 'Ракетка' }).success).toBe(false);
  });

  it('клуб без столов не заводится', () => {
    // Ноль столов означал бы опечатку: турниры такому клубу проводить негде.
    expect(createClubSchema.safeParse({ name: 'Р', city: 'А', tableCount: 0 }).success).toBe(false);
    expect(createClubSchema.safeParse({ name: 'Р', city: 'А', tableCount: 4 }).success).toBe(true);
  });

  it('координаты за пределами земного шара не принимаются', () => {
    expect(createClubSchema.safeParse({ name: 'Р', city: 'А', lat: 91 }).success).toBe(false);
    expect(createClubSchema.safeParse({ name: 'Р', city: 'А', lng: -181 }).success).toBe(false);
  });
});

describe('изменение клуба', () => {
  it('пустое тело отвергается', () => {
    // Запрос, который ничего не меняет, почти всегда означает ошибку на
    // клиенте, а не намерение.
    expect(updateClubSchema.safeParse({}).success).toBe(false);
  });

  it('одного поля достаточно', () => {
    expect(updateClubSchema.safeParse({ city: 'Астана' }).success).toBe(true);
  });
});

describe('состав клуба', () => {
  it('роль берётся из перечня, а не из строки', () => {
    expect(addMemberSchema.safeParse({ userId: CLUB_ID, role: 'OWNER' }).success).toBe(true);
    expect(addMemberSchema.safeParse({ userId: CLUB_ID, role: 'ADMIN' }).success).toBe(false);
  });
});

describe('клуб в ответе', () => {
  it('необязательные поля приходят null, а не отсутствуют', () => {
    const club = {
      id: CLUB_ID,
      name: 'Ракетка',
      shortName: null,
      city: 'Алматы',
      address: null,
      lat: null,
      lng: null,
      tableCount: 4,
      phone: null,
      whatsapp: null,
      instagram: null,
      logoUrl: null,
      description: null,
      createdAt: '2026-08-30T00:00:00.000Z',
    };

    expect(clubViewSchema.parse(club)).toEqual(club);
  });
});
