import { z } from 'zod';

/**
 * Справочник стран и городов — ADR-046.
 *
 * Город раньше был свободной строкой у клуба и у игрока, и «Алматы»
 * с «алматы » расходились по фильтрам как два разных города. Теперь клуб
 * и игрок ссылаются на запись справочника, а справочник ведёт администратор
 * платформы.
 *
 * Название хранится по-русски обязательно и по-казахски по желанию:
 * Усть-Каменогорск и Өскемен — один город. Казахский интерфейс без
 * казахского названия показывает русское.
 *
 * Записи не удаляются, а скрываются: на город ссылаются клубы и игроки,
 * и удаление оставило бы их без города. Скрытый город не предлагается
 * в формах, но остаётся у тех, у кого уже указан.
 */

const placeName = z.string().trim().min(1).max(100);
const sortOrder = z.number().int().min(0).max(10_000);

/** ISO 3166-1 alpha-2: KZ, RU, UZ. */
export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

/** Город, встроенный в клуб и игрока: ровно столько, сколько нужно для подписи. */
export const cityRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  nameKk: z.string().nullable(),
});
export type CityRef = z.infer<typeof cityRefSchema>;

export const countryViewSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  nameKk: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type CountryView = z.infer<typeof countryViewSchema>;

export const cityViewSchema = z.object({
  id: z.uuid(),
  countryId: z.uuid(),
  name: z.string(),
  nameKk: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  /**
   * Центр города — ADR-093. По нему браузер находит ближайший к человеку
   * город. `null` — координаты не заведены, город в автоопределении
   * не участвует, но выбрать его руками можно.
   */
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type CityView = z.infer<typeof cityViewSchema>;

/**
 * Города для выбора. Без страны — все.
 *
 * Открытый список отдаёт только доступные: город не скрыт и страна его
 * не скрыта. Полный список со скрытыми — у администратора.
 */
export const listCitiesSchema = z.object({
  countryId: z.uuid().optional(),
});
export type ListCitiesQuery = z.infer<typeof listCitiesSchema>;

export const createCountrySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(COUNTRY_CODE_PATTERN, 'Код страны — две латинские буквы по ISO 3166-1'),
  name: placeName,
  nameKk: placeName.optional(),
  sortOrder: sortOrder.optional(),
});
export type CreateCountryInput = z.infer<typeof createCountrySchema>;

/** `nameKk: null` стирает казахское название; русское стереть нельзя. */
export const updateCountrySchema = createCountrySchema
  .extend({ nameKk: placeName.nullable(), isActive: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateCountryInput = z.infer<typeof updateCountrySchema>;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const createCitySchema = z.object({
  countryId: z.uuid(),
  name: placeName,
  nameKk: placeName.optional(),
  sortOrder: sortOrder.optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
});
export type CreateCityInput = z.infer<typeof createCitySchema>;

/**
 * Правка города. Страну сменить нельзя: город, переехавший в другую страну, —
 * это опечатка при заведении, и правится она новой записью, а не переносом
 * всех клубов и игроков вслед за ней.
 */
export const updateCitySchema = createCitySchema
  .omit({ countryId: true })
  .extend({
    nameKk: placeName.nullable(),
    isActive: z.boolean(),
    lat: latitude.nullable(),
    lng: longitude.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateCityInput = z.infer<typeof updateCitySchema>;

/**
 * Дальше этого от центра ближайшего города человек считается «не у нас» —
 * ADR-093. 150 км покрывают пригороды и область вокруг областного центра,
 * но не ставят Алматы человеку из Бишкека.
 */
export const NEAREST_CITY_MAX_KM = 150;

const EARTH_RADIUS_KM = 6371;

/** Расстояние по дуге большого круга, км. */
export function distanceKm(
  from: { readonly lat: number; readonly lng: number },
  to: { readonly lat: number; readonly lng: number },
): number {
  const rad = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Ближайший к точке город справочника — ADR-093.
 *
 * Города без координат пропускаются. `undefined` — ближайший дальше
 * `maxKm` или сравнивать не с чем: человеку предлагают выбрать самому.
 */
export function nearestCity<T extends Pick<CityView, 'lat' | 'lng'>>(
  cities: readonly T[],
  point: { readonly lat: number; readonly lng: number },
  maxKm: number = NEAREST_CITY_MAX_KM,
): T | undefined {
  let best: T | undefined;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const city of cities) {
    if (city.lat === null || city.lng === null) continue;
    const km = distanceKm(point, { lat: city.lat, lng: city.lng });
    if (km < bestKm) {
      best = city;
      bestKm = km;
    }
  }
  return bestKm <= maxKm ? best : undefined;
}
