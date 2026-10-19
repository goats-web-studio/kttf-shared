import { describe, expect, it } from 'vitest';

import {
  addMemberSchema,
  clubViewSchema,
  createClubSchema,
  listClubsSchema,
  setClubTablesSchema,
  updateClubSchema,
} from './club.js';

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
      coverUrl: null,
      website: null,
      telegram: null,
      twoGisUrl: null,
      amenities: [],
      tableBrand: null,
      floorType: null,
      ceilingHeightCm: null,
      hoursNote: null,
      primaryContact: null,
      hours: [],
      prices: [],
      tables: [],
      profileReviewedAt: null,
      hidden: false,
      createdAt: '2026-08-30T00:00:00.000Z',
    };

    expect(clubViewSchema.parse(club)).toEqual(club);
  });
});

describe('страница клуба', () => {
  const CITY = '00000000-0000-4000-8000-0000000000c1';
  const IMAGE = '/api/v1/files/clubs/11111111-1111-4111-8111-111111111111.webp';
  const base = { name: 'Ракетка', cityId: CITY };

  it('логотип — своя картинка или внешняя ссылка, обложка — только своя', () => {
    expect(createClubSchema.safeParse({ ...base, logoUrl: IMAGE }).success).toBe(true);
    expect(createClubSchema.safeParse({ ...base, logoUrl: 'https://x.kz/logo.png' }).success).toBe(
      true,
    );
    expect(createClubSchema.safeParse({ ...base, coverUrl: IMAGE }).success).toBe(true);
    expect(createClubSchema.safeParse({ ...base, coverUrl: 'https://x.kz/c.jpg' }).success).toBe(
      false,
    );
  });

  it('сайт — только http или https', () => {
    expect(createClubSchema.safeParse({ ...base, website: 'https://club.kz' }).success).toBe(true);
    expect(createClubSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });

  it('Telegram — имя без собаки', () => {
    expect(createClubSchema.safeParse({ ...base, telegram: 'kttf_club' }).success).toBe(true);
    expect(createClubSchema.safeParse({ ...base, telegram: '@kttf_club' }).success).toBe(false);
  });

  it('карта — только ссылка 2GIS', () => {
    expect(
      createClubSchema.safeParse({ ...base, twoGisUrl: 'https://2gis.kz/almaty/firm/701' }).success,
    ).toBe(true);
    expect(
      createClubSchema.safeParse({ ...base, twoGisUrl: 'https://go.2gis.com/abc12' }).success,
    ).toBe(true);
    expect(
      createClubSchema.safeParse({ ...base, twoGisUrl: 'https://maps.google.com/x' }).success,
    ).toBe(false);
  });

  it('удобство не повторяется', () => {
    expect(createClubSchema.safeParse({ ...base, amenities: ['WIFI', 'KIDS'] }).success).toBe(true);
    expect(createClubSchema.safeParse({ ...base, amenities: ['WIFI', 'WIFI'] }).success).toBe(
      false,
    );
  });

  it('поля страницы стираются null', () => {
    expect(
      updateClubSchema.safeParse({ coverUrl: null, telegram: null, ceilingHeightCm: null }).success,
    ).toBe(true);
  });
});

describe('список клубов', () => {
  it('города и удобства — через запятую', () => {
    const query = listClubsSchema.parse({
      cityId: '00000000-0000-4000-8000-0000000000c1, 00000000-0000-4000-8000-0000000000c2',
      amenities: 'KIDS,WIFI',
      upcoming: 'true',
    });

    expect(query.cityId).toHaveLength(2);
    expect(query.amenities).toEqual(['KIDS', 'WIFI']);
    expect(query.upcoming).toBe(true);
  });

  it('неизвестное удобство — отказ, а не молчаливый пропуск', () => {
    expect(listClubsSchema.safeParse({ amenities: 'POOL' }).success).toBe(false);
  });
});

describe('столы клуба — ADR-058', () => {
  const PRODUCT = '00000000-0000-4000-8000-0000000000f1';

  it('модели с числом столов, без повторов', () => {
    expect(
      setClubTablesSchema.safeParse({ tables: [{ productId: PRODUCT, count: 8 }] }).success,
    ).toBe(true);
    expect(
      setClubTablesSchema.safeParse({
        tables: [
          { productId: PRODUCT, count: 2 },
          { productId: PRODUCT, count: 3 },
        ],
      }).success,
    ).toBe(false);
    expect(
      setClubTablesSchema.safeParse({ tables: [{ productId: PRODUCT, count: 0 }] }).success,
    ).toBe(false);
    expect(setClubTablesSchema.safeParse({ tables: [] }).success).toBe(true);
  });
});
