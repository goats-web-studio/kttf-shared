import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';

/**
 * Заявка клуба — ADR-047.
 *
 * Зал, который хочет проводить турниры в KTTF, оставляет заявку на сайте,
 * администратор платформы видит её в кабинете и связывается с клубом сам.
 * Поля — как у заявки на добавление клуба в RTTF: клубы к ней привыкли.
 *
 * Отправить может кто угодно, в том числе без входа: представитель зала
 * ещё не пользователь. Отсюда ловушка для ботов и лимит на адрес.
 *
 * Город — строкой, а не ссылкой на справочник ADR-046: заявку присылают
 * в том числе из городов, которых в справочнике ещё нет, и именно ради
 * таких заявок справочник и пополняют.
 */

const short = z.string().trim().min(1).max(120);
const long = z.string().trim().max(2000);

/** Пустая строка в необязательном поле — то же, что поле не заполнено. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );
}

export const createClubApplicationSchema = z.object({
  /** Как обращаться к представителю. */
  name: short,
  /** Телефон или email — формат не проверяется: пишут как удобно. */
  contact: z.string().trim().min(5).max(120),
  clubName: short,
  city: short,
  address: optional(z.string().trim().max(200)),
  tableCount: optional(z.coerce.number().int().min(1).max(200)),
  /** «Проходят ли у вас турниры»: какие, как часто, сколько участников. */
  tournaments: optional(long),
  message: optional(long),
  /**
   * Ловушка для ботов: поле скрыто от человека, бот заполняет все поля
   * подряд. Заполненная ловушка — заявка молча не сохраняется.
   */
  website: optional(z.string().max(200)),
});
export type CreateClubApplicationInput = z.infer<typeof createClubApplicationSchema>;

export const CLUB_APPLICATION_STATUSES = ['NEW', 'DONE'] as const;
export const clubApplicationStatusSchema = z.enum(CLUB_APPLICATION_STATUSES);
export type ClubApplicationStatus = z.infer<typeof clubApplicationStatusSchema>;

export const clubApplicationViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  contact: z.string(),
  clubName: z.string(),
  city: z.string(),
  address: z.string().nullable(),
  tableCount: z.number().int().nullable(),
  tournaments: z.string().nullable(),
  message: z.string().nullable(),
  status: clubApplicationStatusSchema,
  /** Заявку оставил вошедший пользователь — по нему проще найти человека. */
  userId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  handledAt: z.iso.datetime().nullable(),
});
export type ClubApplicationView = z.infer<typeof clubApplicationViewSchema>;

/**
 * Список у администратора, свежие сверху. Фильтр по статусу — новые
 * отдельно; `total` новых — счётчик на карточке администратора в кабинете.
 */
export const listClubApplicationsSchema = pageQuerySchema.extend({
  status: clubApplicationStatusSchema.optional(),
});
export type ListClubApplicationsQuery = z.infer<typeof listClubApplicationsSchema>;

/** Обработано или снова новая — если взяли в работу по ошибке. */
export const updateClubApplicationSchema = z.object({
  status: clubApplicationStatusSchema,
});
export type UpdateClubApplicationInput = z.infer<typeof updateClubApplicationSchema>;
