import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';
import { genderSchema, playerViewSchema } from './player.js';
import { formatConfigSchema, seedingConfigSchema } from './tournament-format.js';

/**
 * Контракт турниров — ТС 7.5, состав полей — ТЗ 4.2.
 *
 * Рейтинговые планки приходят числом, а уходят строкой. Это не небрежность:
 * в базе они `Decimal(8,2)`, и наружу такие значения отдаются строкой по той
 * же причине, что и рейтинг игрока, — двоичная плавающая точка хранит не все
 * из них точно, а сравнивать их предстоит именно с рейтингом (ADR-014).
 */

export const tournamentStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'REG_OPEN',
  'REG_CLOSED',
  'RUNNING',
  'FINISHED',
  'RATED',
  'CANCELLED',
]);
export type TournamentStatus = z.infer<typeof tournamentStatusSchema>;

/** Коэффициент турнира T в формуле рейтинга — ТЗ 7.1. */
export const tournamentLevelSchema = z.enum(['CLUB', 'REGIONAL', 'NATIONAL']);
export type TournamentLevel = z.infer<typeof tournamentLevelSchema>;

export const registrationStatusSchema = z.enum([
  'REGISTERED',
  'WAITLIST',
  'CONFIRMED',
  'PLAYING',
  'WITHDRAWN',
  'NO_SHOW',
]);
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;

const currentYear = new Date().getFullYear();
const rating = z.number().min(1).max(9999.99);
const birthYear = z.number().int().min(1900).max(currentYear);

const fields = {
  clubId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  startsAt: z.iso.datetime(),
  /** По умолчанию — время начала турнира (ТЗ 4.2). */
  registrationEndsAt: z.iso.datetime().optional(),
  /** В тенге, может быть нулевым (ТЗ 4.2). */
  entryFee: z.number().int().min(0).max(10_000_000),
  maxParticipants: z.number().int().positive().max(1024).optional(),
  /** Допускаются игроки с рейтингом ниже значения (ТЗ 4.2). */
  ratingCapMax: rating.optional(),
  ratingCapMin: rating.optional(),
  birthYearFrom: birthYear.optional(),
  birthYearTo: birthYear.optional(),
  genderLimit: genderSchema.optional(),
  level: tournamentLevelSchema,
  // Турнир без столов не проводится: ноль здесь означал бы опечатку.
  tableCount: z.number().int().positive().max(200),
  formatConfig: formatConfigSchema,
  seedingConfig: seedingConfigSchema.optional(),
  description: z.string().trim().max(4000).optional(),
  prizeInfo: z.string().trim().max(2000).optional(),
};

interface Bounds {
  startsAt?: string | undefined;
  registrationEndsAt?: string | undefined;
  ratingCapMin?: number | undefined;
  ratingCapMax?: number | undefined;
  birthYearFrom?: number | undefined;
  birthYearTo?: number | undefined;
}

/**
 * Границы не должны быть вывернуты наизнанку.
 *
 * Проверяется только заданное: при частичной правке вторая половина пары
 * может лежать в базе, и там её сверит сервис.
 */
function boundsConsistent(value: Bounds): boolean {
  if (
    value.startsAt !== undefined &&
    value.registrationEndsAt !== undefined &&
    value.registrationEndsAt > value.startsAt
  ) {
    return false;
  }

  if (
    value.ratingCapMin !== undefined &&
    value.ratingCapMax !== undefined &&
    value.ratingCapMin > value.ratingCapMax
  ) {
    return false;
  }

  return !(
    value.birthYearFrom !== undefined &&
    value.birthYearTo !== undefined &&
    value.birthYearFrom > value.birthYearTo
  );
}

const BOUNDS_MESSAGE = 'Границы заданы наоборот: нижняя больше верхней';

export const createTournamentSchema = z.object(fields).refine(boundsConsistent, {
  message: BOUNDS_MESSAGE,
});
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

/** Клуб не меняется: турнир принадлежит тому клубу, в котором создан. */
export const updateTournamentSchema = z
  .object(fields)
  .omit({ clubId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' })
  .refine(boundsConsistent, { message: BOUNDS_MESSAGE });
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;

/** «Повторить прошлый» — ТЗ 4.2. Меняется только дата. */
export const duplicateTournamentSchema = z.object({
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(1).max(200).optional(),
});
export type DuplicateTournamentInput = z.infer<typeof duplicateTournamentSchema>;

export const listTournamentsSchema = pageQuerySchema.extend({
  city: z.string().trim().min(1).max(100).optional(),
  clubId: z.uuid().optional(),
  status: tournamentStatusSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type ListTournamentsQuery = z.infer<typeof listTournamentsSchema>;

/** Запись на турнир. Без `playerId` — запись самого себя (ТЗ 4.3). */
export const registerSchema = z.object({
  playerId: z.uuid().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Правка участника — ТС 7.5: статус, вне зачёта, посев.
 *
 * Переводить можно только туда, куда организатор вправе: снять, отметить
 * неявку, вернуть в состав. `PLAYING` проставляет старт турнира, а не человек.
 */
export const updateRegistrationSchema = z
  .object({
    status: z.enum(['CONFIRMED', 'WAITLIST', 'WITHDRAWN', 'NO_SHOW']).optional(),
    isRated: z.boolean().optional(),
    seed: z.number().int().positive().max(1024).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;

export const tournamentViewSchema = z.object({
  id: z.uuid(),
  clubId: z.uuid(),
  name: z.string(),
  startsAt: z.iso.datetime(),
  registrationEndsAt: z.iso.datetime().nullable(),
  status: tournamentStatusSchema,
  entryFee: z.number().int(),
  maxParticipants: z.number().int().nullable(),
  ratingCapMax: z.string().nullable(),
  ratingCapMin: z.string().nullable(),
  birthYearFrom: z.number().int().nullable(),
  birthYearTo: z.number().int().nullable(),
  genderLimit: genderSchema.nullable(),
  level: tournamentLevelSchema,
  tableCount: z.number().int(),
  formatConfig: formatConfigSchema,
  seedingConfig: seedingConfigSchema.nullable(),
  description: z.string().nullable(),
  prizeInfo: z.string().nullable(),
  /** Второй экран открывается по нему без авторизации — ТС 7.7. */
  publicToken: z.string(),
  participantCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});
export type TournamentView = z.infer<typeof tournamentViewSchema>;

export const registrationViewSchema = z.object({
  id: z.uuid(),
  tournamentId: z.uuid(),
  status: registrationStatusSchema,
  /** `false` — вне зачёта: играет, но результаты не рейтинговые (ТЗ 4.4). */
  isRated: z.boolean(),
  seed: z.number().int().nullable(),
  /** Снимок рейтинга на старте турнира, `null` до старта — ТС 5.4. */
  ratingAtStart: z.string().nullable(),
  matchesAtStart: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  player: playerViewSchema,
});
export type RegistrationView = z.infer<typeof registrationViewSchema>;
