import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';

/**
 * Контракт игроков — ТС 7.2.
 *
 * Состав полей — ТЗ 2.2 в пределах модели `Player`. Трёх необязательных полей
 * из ТЗ 2.2 в схеме базы нет: игровой руки, хвата и инвентаря. Здесь их тоже
 * нет — колонки самостоятельно не заводятся, бриф 4.1. Расхождение записано
 * как ОВ-12.
 *
 * Рейтинг в схемах запросов отсутствует намеренно: он проекция журнала
 * `RatingEvent` (ТС 1.4), полем его не задают. Вопрос о стартовом значении
 * открыт (ОВ-2), до его решения действует умолчание схемы.
 */

/** Верхняя граница года рождения — текущий год: игроков из будущего нет. */
const currentYear = new Date().getFullYear();

const name = z.string().trim().min(1).max(100);

/** Пол. Вынесен отдельно: его же ограничивают турниры (ТЗ 4.2). */
export const genderSchema = z.enum(['MALE', 'FEMALE']);

const profile = {
  lastName: name,
  firstName: name,
  // Отчество не обязательно — бриф, запрет №6.
  middleName: name.optional(),
  birthYear: z.number().int().min(1900).max(currentYear),
  gender: genderSchema,
  city: z.string().trim().min(1).max(100),
  photoUrl: z.url().max(500).optional(),
  clubId: z.uuid().optional(),
};

export const createPlayerSchema = z.object(profile);
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

export const updatePlayerSchema = z
  .object(profile)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

export const listPlayersSchema = pageQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  clubId: z.uuid().optional(),
  /**
   * Только игроки без кабинета — нужен регистрации (ADR-034).
   *
   * Человек, пришедший сам, выбирает себя из заведённых тренером. Игроки,
   * у которых аккаунт уже есть, в этом списке — приглашение занять чужую
   * историю, поэтому фильтр отдельный, а не «все подряд с поиском».
   */
  withoutAccount: z.stringbool().optional(),
});
export type ListPlayersQuery = z.infer<typeof listPlayersSchema>;

/** Игрок в ответах API. Состав — ТЗ 2.2 в пределах модели `Player`. */
export const playerViewSchema = z.object({
  id: z.uuid(),
  /** `null` — заведён организатором, аккаунта нет. */
  userId: z.uuid().nullable(),
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  birthYear: z.number().int(),
  gender: z.string(),
  city: z.string(),
  photoUrl: z.string().nullable(),
  clubId: z.uuid().nullable(),
  /**
   * Рейтинг строкой, а не числом.
   *
   * В базе это `Decimal(8,2)`. Число с плавающей точкой хранит не все такие
   * значения точно, и разница вылезет при сравнении локального расчёта
   * консоли с серверным — ровно то, что запрещает бриф, запрет №2.
   */
  rating: z.string(),
  ratedMatches: z.number().int(),
  isProvisional: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type PlayerView = z.infer<typeof playerViewSchema>;
