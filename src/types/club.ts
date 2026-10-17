import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';

/**
 * Контракт клубов — ТС 7.4.
 *
 * Состав полей — ТЗ 3.1 и модель `Club`. Двух полей из ТЗ 3.1 в схеме базы
 * нет: расписания работы и фото зала. Здесь их тоже нет — придумывать колонки
 * самостоятельно бриф 4.1 не разрешает. Расхождение записано как ОВ-12.
 */

const optionalText = z.string().trim().min(1).max(500);

export const createClubSchema = z.object({
  name: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  shortName: optionalText.max(50).optional(),
  address: optionalText.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Клуб без столов не проводит турниры; ноль здесь означал бы опечатку.
  tableCount: z.number().int().positive().max(200).optional(),
  phone: optionalText.max(30).optional(),
  whatsapp: optionalText.max(30).optional(),
  instagram: optionalText.max(100).optional(),
  logoUrl: z.url().max(500).optional(),
  description: z.string().trim().max(2000).optional(),
});
export type CreateClubInput = z.infer<typeof createClubSchema>;

const create = createClubSchema.shape;

/**
 * Изменение клуба. Пустое тело отвергается: запрос, который ничего не меняет,
 * почти всегда означает ошибку на клиенте, а не намерение.
 *
 * `null` у необязательного поля — «стереть» (ADR-043): организатор, убравший
 * из формы старый телефон, ждёт, что его не станет и на странице клуба.
 * Название, город и столы стереть нельзя — без них клуба нет. Ограничения
 * полей берутся из схемы создания, а не повторяются.
 */
export const updateClubSchema = createClubSchema
  .extend({
    shortName: create.shortName.unwrap().nullable(),
    address: create.address.unwrap().nullable(),
    lat: create.lat.unwrap().nullable(),
    lng: create.lng.unwrap().nullable(),
    phone: create.phone.unwrap().nullable(),
    whatsapp: create.whatsapp.unwrap().nullable(),
    instagram: create.instagram.unwrap().nullable(),
    logoUrl: create.logoUrl.unwrap().nullable(),
    description: create.description.unwrap().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateClubInput = z.infer<typeof updateClubSchema>;

export const listClubsSchema = pageQuerySchema.extend({
  city: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListClubsQuery = z.infer<typeof listClubsSchema>;

export const clubRoleSchema = z.enum(['OWNER', 'ORGANIZER', 'REFEREE']);
export type ClubRole = z.infer<typeof clubRoleSchema>;

/**
 * Добавление в состав — ТЗ 1: состав организаторов ведёт владелец.
 *
 * Человек указывается тем, чем он входит, — логином или телефоном
 * (ADR-043). Внутренний идентификатор аккаунта владельцу взять негде:
 * списка пользователей платформа не отдаёт и отдавать не должна.
 */
export const addMemberSchema = z.object({
  identifier: z.string().trim().min(1).max(64),
  role: clubRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/** Клуб в ответах API. Состав полей — ТЗ 3.1 в пределах модели `Club`. */
export const clubViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  shortName: z.string().nullable(),
  city: z.string(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  tableCount: z.number().int(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  logoUrl: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ClubView = z.infer<typeof clubViewSchema>;

/** Участник состава клуба — ТЗ 3.2. */
export const clubMemberViewSchema = z.object({
  userId: z.uuid(),
  role: z.string(),
  playerId: z.uuid().nullable(),
  /** `null`, пока профиль игрока не заполнен. */
  name: z.string().nullable(),
});
export type ClubMemberView = z.infer<typeof clubMemberViewSchema>;
