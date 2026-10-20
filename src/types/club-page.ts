import { z } from 'zod';

import { clubLimits } from './club-plan.js';

/**
 * Страница клуба — ADR-055, `docs/09`: цены, сводка живых данных и
 * статистика обращений.
 */

// ---------------------------------------------------------------- цены

export const PRICE_KINDS = [
  'TABLE_RENT',
  'HALL_RENT',
  'MEMBERSHIP',
  'TRAINING',
  'KIDS',
  'OTHER',
] as const;
export const priceKindSchema = z.enum(PRICE_KINDS);
export type PriceKind = z.infer<typeof priceKindSchema>;

/**
 * Что клуб пишет в прайс: услуги зала — аренда стола и зала, абонементы,
 * прочее. Тренировки и детские группы — отдельной сущностью «Тренировки»
 * (ADR-059, решение владельца от 20.10.2026): в прайсе они дублировались бы.
 * `TRAINING` и `KIDS` остаются в перечне ради прежних строк, но не
 * принимаются и в ответах прайса не отдаются.
 */
export const CLUB_PRICE_KINDS = ['TABLE_RENT', 'HALL_RENT', 'MEMBERSHIP', 'OTHER'] as const;
export const clubPriceKindSchema = z.enum(CLUB_PRICE_KINDS);
export type ClubPriceKind = z.infer<typeof clubPriceKindSchema>;

/** За что цена: «за час», «за занятие», «в месяц», «за курс» или без подписи. */
export const PRICE_UNITS = ['HOUR', 'VISIT', 'MONTH', 'COURSE', 'NONE'] as const;
export const priceUnitSchema = z.enum(PRICE_UNITS);
export type PriceUnit = z.infer<typeof priceUnitSchema>;

/** Строк в прайсе. Больше — это уже не прайс, а каталог, и его никто не дочитает. */
export const CLUB_PRICES_MAX = 40;

/** Десять миллионов тенге — заведомо больше любого годового абонемента. */
export const PRICE_KZT_MAX = 10_000_000;

export const clubPriceInputSchema = z.object({
  kind: clubPriceKindSchema,
  title: z.string().trim().min(1).max(100),
  /** Целые тенге: тиын в прайсе зала не бывает. */
  priceKzt: z.number().int().min(0).max(PRICE_KZT_MAX),
  unit: priceUnitSchema,
  note: z.string().trim().min(1).max(200).nullable().optional(),
});
export type ClubPriceInput = z.infer<typeof clubPriceInputSchema>;

/** Прайс целиком: порядок строк — порядок в массиве. */
export const setClubPricesSchema = z.object({
  prices: z.array(clubPriceInputSchema).max(CLUB_PRICES_MAX),
});
export type SetClubPricesInput = z.infer<typeof setClubPricesSchema>;

export const clubPriceViewSchema = z.object({
  id: z.uuid(),
  kind: priceKindSchema,
  title: z.string(),
  priceKzt: z.number().int(),
  unit: priceUnitSchema,
  note: z.string().nullable(),
});
export type ClubPriceView = z.infer<typeof clubPriceViewSchema>;

// ---------------------------------------------------------------- сводка

/** Окно «за месяц» в сводке клуба. */
export const CLUB_SUMMARY_DAYS = 30;

/** Сколько последних турниров показывают призёров. */
export const CLUB_SUMMARY_PODIUMS = 5;

export const clubPodiumPlaceSchema = z.object({
  place: z.number().int(),
  /** Делённое место — «3–4»: верхняя граница, иначе `null`. */
  placeTo: z.number().int().nullable(),
  playerId: z.uuid(),
  name: z.string(),
});
export type ClubPodiumPlace = z.infer<typeof clubPodiumPlaceSchema>;

export const clubPodiumSchema = z.object({
  tournamentId: z.uuid(),
  name: z.string(),
  startsAt: z.iso.datetime(),
  participants: z.number().int(),
  places: z.array(clubPodiumPlaceSchema),
});
export type ClubPodium = z.infer<typeof clubPodiumSchema>;

/**
 * Живые данные клуба — то, что у RTTF заполняется руками, а у нас берётся
 * из турниров (ADR-055, решение 1).
 */
export const clubSummaryViewSchema = z.object({
  /** Сыграно встреч за `CLUB_SUMMARY_DAYS` дней. */
  matchesRecent: z.number().int(),
  /** Разных игроков, сыгравших встречу в турнирах клуба за тот же срок. */
  activePlayersRecent: z.number().int(),
  /** Проведено турниров за всё время: завершённых и обсчитанных. */
  tournamentsHeld: z.number().int(),
  /** Последние завершённые турниры с призёрами, свежие первыми. */
  podiums: z.array(clubPodiumSchema),
});
export type ClubSummaryView = z.infer<typeof clubSummaryViewSchema>;

// ---------------------------------------------------------------- статистика

/**
 * Что считается: просмотр страницы и нажатия на способы связи.
 *
 * Это то, чем KTTF показывает клубу отдачу (ADR-055, решение 4).
 */
export const CLUB_EVENT_KINDS = [
  'VIEW',
  'PHONE',
  'WHATSAPP',
  'TELEGRAM',
  'INSTAGRAM',
  'WEBSITE',
  'ROUTE',
  /**
   * «Записаться» к тренеру, который проводит личную тренировку в зале клуба:
   * обращение ушло тренеру, клубу — отдельной строкой (ADR-059, решение
   * владельца от 21.10.2026).
   */
  'COACH_TRAINING',
] as const;
export const clubEventKindSchema = z.enum(CLUB_EVENT_KINDS);
export type ClubEventKind = z.infer<typeof clubEventKindSchema>;

/**
 * Откуда пришёл человек: `CAMPAIGN` — по ссылке с метками `utm_*`, то есть
 * с рекламы KTTF; остальное — `ORGANIC`.
 */
export const TRAFFIC_SOURCES = ['ORGANIC', 'CAMPAIGN'] as const;
export const trafficSourceSchema = z.enum(TRAFFIC_SOURCES);
export type TrafficSource = z.infer<typeof trafficSourceSchema>;

export const clubEventSchema = z.object({
  kind: clubEventKindSchema,
  source: trafficSourceSchema,
});
export type ClubEventInput = z.infer<typeof clubEventSchema>;

/** Глубина запроса не больше, чем позволяет план (сейчас — защитный предел). */
export const clubStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(clubLimits('PRO').statsDays).default(30),
});
export type ClubStatsQuery = z.infer<typeof clubStatsQuerySchema>;

export const clubStatsRowSchema = z.object({
  /** День по местному времени клуба, `YYYY-MM-DD`. */
  date: z.iso.date(),
  source: trafficSourceSchema,
  views: z.number().int(),
  phone: z.number().int(),
  whatsapp: z.number().int(),
  telegram: z.number().int(),
  instagram: z.number().int(),
  website: z.number().int(),
  route: z.number().int(),
  /** Записи к тренерам в зале клуба. */
  coachTraining: z.number().int(),
});
export type ClubStatsRow = z.infer<typeof clubStatsRowSchema>;

export const clubStatsViewSchema = z.object({
  /** Первый и последний день окна, включительно. */
  from: z.iso.date(),
  to: z.iso.date(),
  /** Только дни, в которые что-то было. Пустые дни клиент дорисовывает сам. */
  rows: z.array(clubStatsRowSchema),
});
export type ClubStatsView = z.infer<typeof clubStatsViewSchema>;
