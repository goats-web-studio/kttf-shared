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

export const createCitySchema = z.object({
  countryId: z.uuid(),
  name: placeName,
  nameKk: placeName.optional(),
  sortOrder: sortOrder.optional(),
});
export type CreateCityInput = z.infer<typeof createCitySchema>;

/**
 * Правка города. Страну сменить нельзя: город, переехавший в другую страну, —
 * это опечатка при заведении, и правится она новой записью, а не переносом
 * всех клубов и игроков вслед за ней.
 */
export const updateCitySchema = createCitySchema
  .omit({ countryId: true })
  .extend({ nameKk: placeName.nullable(), isActive: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateCityInput = z.infer<typeof updateCitySchema>;
