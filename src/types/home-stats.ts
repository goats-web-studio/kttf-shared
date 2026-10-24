import { z } from 'zod';

import { clubPodiumPlaceSchema } from './club-page.js';
import { clubRefSchema, tournamentRefSchema } from './player-profile.js';
import { tournamentLevelSchema } from './tournament.js';

/**
 * Живые блоки главной — ADR-071, как у RTTF: «последние результаты
 * турниров», «статистика» и «лучшие победы» по всей платформе.
 *
 * Всё считается из того, что турниры действительно записывают: места из
 * заявок (ADR-048), счёт по партиям встречи и журнал рейтинга (ADR-069).
 * Счёта по сетам здесь нет — клубы его не ведут (ADR-063).
 */

/** Период статистики главной: вкладки «неделя / месяц / год», как у RTTF. */
export const HOME_STATS_PERIODS = ['WEEK', 'MONTH', 'YEAR'] as const;
export const homeStatsPeriodSchema = z.enum(HOME_STATS_PERIODS);
export type HomeStatsPeriod = z.infer<typeof homeStatsPeriodSchema>;

/** Длина периода в днях — скользящее окно до текущего момента. */
export const HOME_STATS_PERIOD_DAYS: Readonly<Record<HomeStatsPeriod, number>> = {
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

/** Строк в каждой таблице статистики. */
export const HOME_STATS_TOP = 5;

/** Турниров с призёрами в блоке результатов. */
export const HOME_PODIUMS = 8;

export const homeStatsQuerySchema = z.object({
  period: homeStatsPeriodSchema.default('MONTH'),
});
export type HomeStatsQuery = z.infer<typeof homeStatsQuerySchema>;

// ---------------------------------------------------------------- результаты

/**
 * Завершённый турнир с призёрами. Планка и уровень — для метки «250» /
 * «отк» в строке, как у RTTF; клуб — где играли.
 */
export const homePodiumSchema = z.object({
  tournamentId: z.uuid(),
  name: z.string(),
  startsAt: z.iso.datetime(),
  level: tournamentLevelSchema,
  /** Верхняя планка рейтинга строкой (ADR-014); `null` — открытый турнир. */
  ratingCapMax: z.string().nullable(),
  /** Нижняя планка — «150+»; `null` — без нижней границы. */
  ratingCapMin: z.string().nullable(),
  club: clubRefSchema,
  participants: z.number().int(),
  /** Места 1–3, делённые — с `placeTo`. */
  places: z.array(clubPodiumPlaceSchema),
});
export type HomePodium = z.infer<typeof homePodiumSchema>;

export const homePodiumsSchema = z.object({
  /** Свежие сверху: по дате начала турнира. */
  items: z.array(homePodiumSchema),
});
export type HomePodiums = z.infer<typeof homePodiumsSchema>;

// ---------------------------------------------------------------- статистика

/** Игрок в строке статистики — без лишнего: имя, фото, рейтинг сейчас. */
export const homeStatsPlayerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  rating: z.string(),
});
export type HomeStatsPlayer = z.infer<typeof homeStatsPlayerSchema>;

export const homeLeaderSchema = z.object({
  player: homeStatsPlayerSchema,
  count: z.number().int().positive(),
});
export type HomeLeader = z.infer<typeof homeLeaderSchema>;

/**
 * Две таблицы одним запросом: у них общие вкладки периода, и по отдельности
 * переключение дёргало бы два запроса ради одного клика.
 */
export const homeLeadersSchema = z.object({
  period: homeStatsPeriodSchema,
  /** Больше всех сыграл турниров: начавшихся в периоде, где была встреча. */
  tournaments: z.array(homeLeaderSchema),
  /** Больше всех выиграл встреч в периоде — неявки не в счёт. */
  wins: z.array(homeLeaderSchema),
});
export type HomeLeaders = z.infer<typeof homeLeadersSchema>;

// ---------------------------------------------------------------- лучшие победы

/**
 * Победа над тем, у кого рейтинг был выше, — «лучшие победы» RTTF.
 *
 * Рейтинги — на момент встречи из журнала (ADR-069): победа читается
 * разницей двух чисел того дня. Поэтому в блок попадают только встречи
 * обсчитанных турниров — у остальных журнала ещё нет.
 */
export const homeUpsetSchema = z.object({
  matchId: z.uuid(),
  tournament: tournamentRefSchema,
  club: clubRefSchema,
  playedAt: z.iso.datetime().nullable(),
  winner: homeStatsPlayerSchema.omit({ rating: true, photoUrl: true }),
  winnerRating: z.string(),
  winnerDelta: z.string(),
  loser: homeStatsPlayerSchema.omit({ rating: true, photoUrl: true }),
  loserRating: z.string(),
  loserDelta: z.string(),
  setsWinner: z.number().int().nonnegative(),
  setsLoser: z.number().int().nonnegative(),
});
export type HomeUpset = z.infer<typeof homeUpsetSchema>;

export const homeUpsetsSchema = z.object({
  period: homeStatsPeriodSchema,
  /** Сильнейший разрыв рейтингов сверху. */
  items: z.array(homeUpsetSchema),
});
export type HomeUpsets = z.infer<typeof homeUpsetsSchema>;
