import { describe, expect, it } from 'vitest';

import {
  createCitySchema,
  createCountrySchema,
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
