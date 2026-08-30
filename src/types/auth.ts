import { z } from 'zod';

/**
 * Контракт аутентификации — ТС 7.1.
 *
 * Живёт в общем коде: обе стороны обязаны понимать формат телефона и состав
 * ответа одинаково. Серверное здесь не появляется — время жизни кода, токена
 * и сессии остаётся в приложении, клиенту знать его незачем.
 */

/** Длина одноразового кода. Шесть цифр — практика рынка, в документах не задана. */
export const CODE_LENGTH = 6;

/**
 * Телефон в E.164, казахстанский формат.
 *
 * Формат задан комментарием к полю `User.phone` в схеме: `+7XXXXXXXXXX`.
 * Единственный формат хранения — иначе один и тот же человек заводит два
 * аккаунта, написав номер по-разному, а ТЗ 2.1 требует «один телефон = один
 * аккаунт».
 */
export const PHONE_PATTERN = /^\+7\d{10}$/;

const phone = z.string().trim().regex(PHONE_PATTERN, 'Телефон ожидается в формате +7XXXXXXXXXX');

export const requestCodeSchema = z.object({ phone });
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

export const verifyCodeSchema = z.object({
  phone,
  code: z.string().trim().length(CODE_LENGTH).regex(/^\d+$/, 'Код состоит только из цифр'),
});
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshInput = z.infer<typeof refreshSchema>;

/** Роль в клубе, как она лежит в `ClubMember`. */
export const clubRoleViewSchema = z.object({
  clubId: z.uuid(),
  role: z.string(),
});
export type ClubRoleView = z.infer<typeof clubRoleViewSchema>;

/**
 * Пользователь в ответах аутентификации.
 *
 * Состав ТС 7.1 не задаёт, поэтому здесь только то, что нужно клиенту сразу
 * после входа: кто вошёл, есть ли у него профиль игрока и что он может делать
 * в клубах. Рейтинг и остальной профиль берутся отдельным запросом к 7.2 —
 * они меняются независимо от сессии, и класть их сюда значило бы отдавать
 * устаревшие данные при каждом обновлении токена.
 */
export const authUserViewSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  email: z.email().nullable(),
  locale: z.string(),
  createdAt: z.iso.datetime(),
  /** `null`, пока профиль игрока не заведён — ТЗ 2.2 заполняется отдельно. */
  playerId: z.uuid().nullable(),
  clubRoles: z.array(clubRoleViewSchema),
});
export type AuthUserView = z.infer<typeof authUserViewSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const authSessionSchema = tokenPairSchema.extend({ user: authUserViewSchema });
export type AuthSession = z.infer<typeof authSessionSchema>;
