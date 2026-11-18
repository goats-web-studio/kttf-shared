import { z } from 'zod';

import { LOGIN_PATTERN, PASSWORD_MIN_LENGTH } from './auth.js';

/**
 * Контракт настроек аккаунта — ТЗ 2.1.
 *
 * Отдельно от профиля игрока намеренно (ADR-035). Аккаунт — это чем человек
 * входит и как с ним связаться: логин, почта, язык, пароль, Telegram. Профиль
 * — то, что о нём знает спорт: разряд руки, хват, инвентарь, клуб. Сущности
 * разные и живут порознь: у судьи есть аккаунт без профиля, у игрока,
 * заведённого тренером, — профиль без аккаунта.
 *
 * Телефон здесь не меняется. По ТЗ 2.1 «один телефон — один аккаунт», и смена
 * номера означает перенос входа на другой номер: это подтверждение владения
 * новым номером, которого без провайдера SMS взять неоткуда (ОВ-9 закрыт
 * отказом от SMS, ADR-034). Смена номера остаётся задачей поддержки.
 */

/**
 * Язык интерфейса — ТЗ 11.
 *
 * Три значения, как в перечислении `Locale` схемы: английский заполняется
 * последним, но местом в модели он уже располагает.
 */
export const localeSchema = z.enum(['RU', 'KK', 'EN']);
export type AccountLocale = z.infer<typeof localeSchema>;

/**
 * Идентификатор Telegram — число, а не `@имя`.
 *
 * Бот отправляет сообщение по числовому `chat_id`; по `@имени` он писать не
 * может. Просить `@имя` значило бы собирать то, чем воспользоваться нельзя.
 * Уведомления сами по себе — V2 (ТЗ 10), поле заводится заранее, потому что
 * собирается оно годами, а понадобится сразу.
 */
export const TELEGRAM_ID_PATTERN = /^\d{5,20}$/;

const telegramId = z
  .string()
  .trim()
  .regex(TELEGRAM_ID_PATTERN, 'Telegram ID — это число, его выдаёт бот @userinfobot');

/**
 * Изменение настроек аккаунта.
 *
 * `null` в поле означает «очистить», отсутствие поля — «не трогать». Разница
 * существенна: без неё нельзя убрать однажды указанную почту, а PATCH,
 * который умеет только заполнять, — это ловушка.
 *
 * Логин здесь меняется, потому что им входят: аккаунты, заведённые до
 * перехода на пароль, живут вовсе без логина (ADR-034), и другого места
 * задать его нет.
 */
export const updateAccountSchema = z
  .object({
    login: z
      .string()
      .trim()
      .regex(LOGIN_PATTERN, 'Логин: 3–32 знака, латиница, цифры, точка, дефис или подчёркивание'),
    email: z.email().max(200).nullable(),
    locale: localeSchema,
    telegramId: telegramId.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/**
 * Смена пароля.
 *
 * Текущий пароль обязателен, даже когда человек уже вошёл: доступ к открытой
 * вкладке не должен означать возможность сменить пароль и тем самым отобрать
 * аккаунт у владельца. Совпадение нового со старым отвергается — иначе форма
 * молча делает вид, что сработала.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Пароль короче ${String(PASSWORD_MIN_LENGTH)} знаков`)
      .max(200),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Новый пароль совпадает с текущим',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Заявка на удаление аккаунта — `POST /account/deletion-request`, ADR-095.
 *
 * Сам человек аккаунт не удаляет: он просит, решает администратор. Пароль —
 * повторная проверка личности: открытая на чужом телефоне вкладка не должна
 * отправлять заявку одним нажатием. Причина — по желанию, для администратора.
 */
export const requestAccountDeletionSchema = z.object({
  password: z.string().min(1).max(200),
  reason: z.string().trim().max(500).optional(),
});
export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;

/**
 * Заявка на восстановление архивного профиля — `POST /account/restore-request`,
 * ADR-095.
 *
 * По номеру телефона нового аккаунта нашёлся профиль, ушедший в архив. Номер
 * без SMS не подтверждён (ADR-034), поэтому историю не привязывают сами:
 * решает администратор. Имя нужно, когда личные данные архива уже стёрты
 * (через 30 дней): иначе профиль вернулся бы безымянным.
 */
export const requestAccountRestoreSchema = z.object({
  lastName: z.string().trim().min(1).max(100),
  firstName: z.string().trim().min(1).max(100),
  comment: z.string().trim().max(500).optional(),
});
export type RequestAccountRestoreInput = z.infer<typeof requestAccountRestoreSchema>;

export const ACCOUNT_REQUEST_KINDS = ['DELETE', 'RESTORE'] as const;
export const accountRequestKindSchema = z.enum(ACCOUNT_REQUEST_KINDS);
export type AccountRequestKind = z.infer<typeof accountRequestKindSchema>;

export const ACCOUNT_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export const accountRequestStatusSchema = z.enum(ACCOUNT_REQUEST_STATUSES);
export type AccountRequestStatus = z.infer<typeof accountRequestStatusSchema>;

/** Своя заявка — для настроек и кабинета. */
export const accountRequestViewSchema = z.object({
  id: z.uuid(),
  kind: accountRequestKindSchema,
  status: accountRequestStatusSchema,
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  /** Ответ администратора при отказе. */
  answer: z.string().nullable(),
});
export type AccountRequestView = z.infer<typeof accountRequestViewSchema>;

/**
 * Что знает о себе вошедший — `GET /account/requests`, ADR-095.
 *
 * `restorable` — по телефону аккаунта есть профиль в архиве, и восстановить
 * его можно заявкой. `restorableWithData` — личные данные архива ещё не
 * стёрты (первые 30 дней): вернутся имя и фото, а не только история.
 */
export const accountStatusViewSchema = z.object({
  deletion: accountRequestViewSchema.nullable(),
  restore: accountRequestViewSchema.nullable(),
  restorable: z.boolean(),
  restorableWithData: z.boolean(),
});
export type AccountStatusView = z.infer<typeof accountStatusViewSchema>;

/** Заявка в списке администратора. */
export const adminAccountRequestViewSchema = accountRequestViewSchema.extend({
  reason: z.string().nullable(),
  /** Аккаунт — пока он есть. После архива заявки на удаление — `null`. */
  user: z.object({ id: z.uuid(), login: z.string().nullable(), phone: z.string() }).nullable(),
  /** Профиль игрока: у удаления — свой, у восстановления — архивный. */
  player: z
    .object({
      id: z.uuid(),
      lastName: z.string(),
      firstName: z.string(),
      birthYear: z.number().int(),
      rating: z.string(),
      tournaments: z.number().int().nonnegative(),
    })
    .nullable(),
  /** Имя, которое назвал просящий восстановление. */
  claimedName: z.string().nullable(),
});
export type AdminAccountRequestView = z.infer<typeof adminAccountRequestViewSchema>;

export const listAccountRequestsSchema = z.object({
  status: accountRequestStatusSchema.optional(),
});
export type ListAccountRequestsQuery = z.infer<typeof listAccountRequestsSchema>;

/** Отказ — с ответом человеку: он увидит его в настройках. */
export const rejectAccountRequestSchema = z.object({
  answer: z.string().trim().min(1).max(500),
});
export type RejectAccountRequestInput = z.infer<typeof rejectAccountRequestSchema>;

/** Сколько архив хранит личные данные, прежде чем их стереть — ADR-095. */
export const ARCHIVE_PERSONAL_DATA_DAYS = 30;
