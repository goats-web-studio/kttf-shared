import { describe, expect, it } from 'vitest';

import { addMemberSchema, clubViewSchema, createClubSchema, updateClubSchema } from './club.js';

const CLUB_ID = '00000000-0000-4000-8000-000000000001';

describe('создание клуба', () => {
  it('название и город обязательны, остальное нет', () => {
    expect(
      createClubSchema.safeParse({
        name: 'Ракетка',
        cityId: '00000000-0000-4000-8000-0000000000c1',
      }).success,
    ).toBe(true);
    expect(createClubSchema.safeParse({ name: 'Ракетка' }).success).toBe(false);
  });

  it('клуб без столов не заводится', () => {
    // Ноль столов означал бы опечатку: турниры такому клубу проводить негде.
    expect(
      createClubSchema.safeParse({
        name: 'Р',
        cityId: '00000000-0000-4000-8000-0000000000c1',
        tableCount: 0,
      }).success,
    ).toBe(false);
    expect(
      createClubSchema.safeParse({
        name: 'Р',
        cityId: '00000000-0000-4000-8000-0000000000c1',
        tableCount: 4,
      }).success,
    ).toBe(true);
  });

  it('координаты за пределами земного шара не принимаются', () => {
    expect(
      createClubSchema.safeParse({
        name: 'Р',
        cityId: '00000000-0000-4000-8000-0000000000c1',
        lat: 91,
      }).success,
    ).toBe(false);
    expect(
      createClubSchema.safeParse({
        name: 'Р',
        cityId: '00000000-0000-4000-8000-0000000000c1',
        lng: -181,
      }).success,
    ).toBe(false);
  });
});

describe('изменение клуба', () => {
  it('пустое тело отвергается', () => {
    // Запрос, который ничего не меняет, почти всегда означает ошибку на
    // клиенте, а не намерение.
    expect(updateClubSchema.safeParse({}).success).toBe(false);
  });

  it('одного поля достаточно', () => {
    expect(
      updateClubSchema.safeParse({ cityId: '00000000-0000-4000-8000-0000000000c1' }).success,
    ).toBe(true);
  });

  it('необязательное поле можно стереть, обязательное — нет', () => {
    // Старый телефон, убранный из формы, обязан исчезнуть и со страницы
    // клуба (ADR-043). Клуб без названия или города — уже не клуб.
    expect(updateClubSchema.safeParse({ phone: null, description: null }).success).toBe(true);
    expect(updateClubSchema.safeParse({ name: null }).success).toBe(false);
    expect(updateClubSchema.safeParse({ cityId: null }).success).toBe(false);
    expect(updateClubSchema.safeParse({ tableCount: null }).success).toBe(false);
  });

  it('ограничения полей те же, что при создании', () => {
    expect(updateClubSchema.safeParse({ lat: 91 }).success).toBe(false);
    expect(updateClubSchema.safeParse({ phone: 'x'.repeat(31) }).success).toBe(false);
  });
});

describe('состав клуба', () => {
  it('человек указывается логином или телефоном', () => {
    expect(addMemberSchema.safeParse({ identifier: 'organizer', role: 'ORGANIZER' }).success).toBe(
      true,
    );
    expect(addMemberSchema.safeParse({ identifier: '+77011234567', role: 'OWNER' }).success).toBe(
      true,
    );
    expect(addMemberSchema.safeParse({ identifier: '  ', role: 'ORGANIZER' }).success).toBe(false);
  });

  it('роль берётся из перечня, а не из строки', () => {
    expect(addMemberSchema.safeParse({ identifier: 'organizer', role: 'ADMIN' }).success).toBe(
      false,
    );
  });
});

describe('клуб в ответе', () => {
  it('необязательные поля приходят null, а не отсутствуют', () => {
    const club = {
      id: CLUB_ID,
      name: 'Ракетка',
      shortName: null,
      city: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Алматы', nameKk: null },
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
