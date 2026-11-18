import { describe, expect, it } from 'vitest';

import {
  createCitySchema,
  createCountrySchema,
  distanceKm,
  nearestCity,
  updateCitySchema,
  updateCountrySchema,
} from './place.js';

const COUNTRY_ID = '00000000-0000-4000-8000-000000000001';

describe('страна', () => {
  it('код — две латинские буквы, регистр приводится', () => {
    expect(createCountrySchema.parse({ code: 'kz', name: 'Казахстан' }).code).toBe('KZ');
    expect(createCountrySchema.safeParse({ code: 'KAZ', name: 'Казахстан' }).success).toBe(false);
    expect(createCountrySchema.safeParse({ code: 'К1', name: 'Казахстан' }).success).toBe(false);
  });

  it('русское название обязательно, казахское нет', () => {
    expect(createCountrySchema.safeParse({ code: 'KZ' }).success).toBe(false);
    expect(createCountrySchema.safeParse({ code: 'KZ', name: '  ' }).success).toBe(false);
    expect(
      createCountrySchema.safeParse({ code: 'KZ', name: 'Казахстан', nameKk: 'Қазақстан' }).success,
    ).toBe(true);
  });

  it('правка: пустое тело отвергается, казахское название стирается', () => {
    expect(updateCountrySchema.safeParse({}).success).toBe(false);
    expect(updateCountrySchema.safeParse({ nameKk: null }).success).toBe(true);
    expect(updateCountrySchema.safeParse({ name: null }).success).toBe(false);
    expect(updateCountrySchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe('город', () => {
  it('принадлежит стране', () => {
    expect(createCitySchema.safeParse({ name: 'Алматы' }).success).toBe(false);
    expect(createCitySchema.safeParse({ countryId: COUNTRY_ID, name: 'Алматы' }).success).toBe(
      true,
    );
  });

  it('порядок в списке — неотрицательное целое', () => {
    const base = { countryId: COUNTRY_ID, name: 'Алматы' };
    expect(createCitySchema.safeParse({ ...base, sortOrder: -1 }).success).toBe(false);
    expect(createCitySchema.safeParse({ ...base, sortOrder: 1.5 }).success).toBe(false);
    expect(createCitySchema.safeParse({ ...base, sortOrder: 10 }).success).toBe(true);
  });

  it('правка не переносит город в другую страну', () => {
    // Лишнее поле отбрасывается схемой, а не применяется.
    expect(updateCitySchema.parse({ countryId: COUNTRY_ID, name: 'Алматы' })).toEqual({
      name: 'Алматы',
    });
    expect(updateCitySchema.safeParse({ countryId: COUNTRY_ID }).success).toBe(false);
  });

  it('скрыть можно, удалить через правку нельзя', () => {
    expect(updateCitySchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateCitySchema.safeParse({ name: null }).success).toBe(false);
  });
});

describe('ближайший город — ADR-093', () => {
  const almaty = { id: 'a', lat: 43.2389, lng: 76.8897 };
  const astana = { id: 'b', lat: 51.1694, lng: 71.4491 };
  const noCoords = { id: 'c', lat: null, lng: null };

  it('Алматы — Астана около 970 км', () => {
    expect(Math.round(distanceKm(almaty, astana) / 10)).toBe(97);
  });

  it('точка в пригороде достаётся своему городу', () => {
    // Каскелен — 25 км от центра Алматы.
    expect(nearestCity([astana, noCoords, almaty], { lat: 43.2, lng: 76.62 })?.id).toBe('a');
  });

  it('дальше 150 км — города нет', () => {
    // Бишкек: до Алматы около 200 км.
    expect(nearestCity([almaty, astana], { lat: 42.87, lng: 74.59 })).toBeUndefined();
  });

  it('без координат сравнивать не с чем', () => {
    expect(nearestCity([noCoords], { lat: 43.2, lng: 76.9 })).toBeUndefined();
  });

  it('координаты города — в пределах шара', () => {
    expect(createCitySchema.safeParse({ countryId: COUNTRY_ID, name: 'X', lat: 91 }).success).toBe(
      false,
    );
    expect(updateCitySchema.safeParse({ lat: null, lng: null }).success).toBe(true);
  });
});
