import { z } from 'zod';

/**
 * Контракт аутентификации — ТС 7.1.
 *
 * Живёт в общем коде: обе стороны обязаны понимать формат телефона, правила
 * логина и пароля одинаково — иначе форма примет то, что сервер отвергнет.
 * Серверное здесь не появляется: время жизни токена и сессии остаётся в
 * приложении, клиенту знать его незачем.
 *
 * Вход по одноразовому коду отменён 03.09.2026 — ADR-034.
 */

/**
 * Логин: латиница, цифры, точка, дефис, подчёркивание.
 *
 * Кириллица запрещена намеренно: логин набирают в спешке в зале, и «а»
 * латинская против «а» кириллической — это отказ во входе, причину которого
 * человек не увидит глазами.
 */
export const LOGIN_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

/** Минимальная длина пароля. */
export const PASSWORD_MIN_LENGTH = 8;

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

const login = z
  .string()
  .trim()
  .regex(LOGIN_PATTERN, 'Логин: 3–32 знака, латиница, цифры, точка, дефис или подчёркивание');

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Пароль короче ${String(PASSWORD_MIN_LENGTH)} знаков`)
  .max(200);

/**
 * Вход — логином или телефоном.
 *
 * Одно поле на оба: человек вводит то, что помнит, а разбирает сервер. Два
 * поля означали бы выбор способа входа до того, как человек начал вводить.
 */
export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(64),
  // Длина пароля здесь не проверяется: правило действует при заведении,
  // а на входе короткий пароль — это просто неверный пароль.
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Регистрация аккаунта.
 *
 * Имя `signUp`, а не `register`: «регистрация» в этом продукте уже занята
 * записью на турнир (`registerSchema` в `tournament.ts`), и две одинаково
 * названные схемы в одном контракте — верный способ прислать не то.
 *
 * Игроков заводит тренер, а человек, придя сам, выбирает себя из тех, у кого
 * ещё нет кабинета, и привязывается к своей истории. Без выбора аккаунт тоже
 * заводится: у судьи и организатора профиля игрока может не быть вовсе.
 */
export const signUpSchema = z.object({
  login,
  password,
  phone,
  /** Игрок, которым человек себя назвал. `undefined` — привязки нет. */
  playerId: z.uuid().optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

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
  /** `null` — аккаунт заведён до перехода на пароль (ADR-034). */
  login: z.string().nullable(),
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
