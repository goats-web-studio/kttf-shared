import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';
import { playerViewSchema } from './player.js';
import { resultTypeSchema } from './stage.js';
import { tournamentLevelSchema, tournamentStatusSchema } from './tournament.js';

/**
 * Публичный профиль игрока в структуре RTTF — ADR-048, ТЗ 9.3.
 *
 * Профиль отвечает на вопросы, которые задают о игроке в зале: какое у него
 * место в стране, сколько он играет, кого обыгрывал и что брал. Ответы
 * считает сервер: по странице встреч они были бы неверными, а пересчитывать
 * их на клиенте значит тянуть всю историю ради пяти чисел.
 *
 * Десятичные — строкой, как вся история (ADR-014).
 */

/** Период общей статистики: как вкладки «за квартал / полгода / год / всё время» у RTTF. */
export const PLAYER_STATS_PERIODS = ['QUARTER', 'HALF', 'YEAR', 'ALL'] as const;
export const playerStatsPeriodSchema = z.enum(PLAYER_STATS_PERIODS);
export type PlayerStatsPeriod = z.infer<typeof playerStatsPeriodSchema>;

export const playerSummaryQuerySchema = z.object({
  period: playerStatsPeriodSchema.default('ALL'),
});
export type PlayerSummaryQuery = z.infer<typeof playerSummaryQuerySchema>;

/** Турнир, на который ссылается строка профиля. */
export const tournamentRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  startsAt: z.iso.datetime(),
});
export type TournamentRef = z.infer<typeof tournamentRefSchema>;

/** Клуб, на который ссылается строка профиля. */
export const clubRefSchema = z.object({ id: z.uuid(), name: z.string() });
export type ClubRef = z.infer<typeof clubRefSchema>;

/**
 * Длительность встречи в минутах — от вызова к столу до счёта (ADR-050).
 *
 * `null` — встречу внесли, не вызывая к столу (`startedAt` пуст), или счёт
 * ещё не введён. Ноль бы врал: такая встреча не длилась ноль минут.
 */
const durationMinutesSchema = z.number().int().nonnegative().nullable();

/**
 * Лучшая победа — над самым сильным соперником.
 *
 * Сила соперника — его рейтинг на момент встречи из журнала, а не нынешний:
 * победа над тем, кто тогда был сильнее, и остаётся сильнейшей. Победы вне
 * зачёта сюда не попадают — рейтинга соперника для них в журнале нет.
 *
 * Свой рейтинг — тоже на момент встречи (`RatingEvent.ratingBefore`): как
 * у RTTF, победа читается разницей двух чисел одного дня.
 */
export const playerBestWinSchema = z.object({
  matchId: z.uuid(),
  tournament: tournamentRefSchema,
  /** Вызов к столу; `null` — встречу внесли без вызова. */
  startedAt: z.iso.datetime().nullable(),
  playedAt: z.iso.datetime().nullable(),
  ratingBefore: z.string(),
  opponent: playerViewSchema,
  opponentRating: z.string(),
  setsFor: z.number().int().nonnegative(),
  setsAgainst: z.number().int().nonnegative(),
  delta: z.string(),
  durationMinutes: durationMinutesSchema,
});
export type PlayerBestWinView = z.infer<typeof playerBestWinSchema>;

/**
 * Лучшие победы — отдельным запросом со своим периодом (ADR-050): у блока
 * свои вкладки, и гонять ради них всю сводку незачем.
 */
export const playerBestWinsQuerySchema = playerSummaryQuerySchema;
export type PlayerBestWinsQuery = z.infer<typeof playerBestWinsQuerySchema>;

export const playerBestWinsSchema = z.object({
  period: playerStatsPeriodSchema,
  /** До пяти побед над самыми сильными соперниками, сильнейший сверху. */
  items: z.array(playerBestWinSchema),
});
export type PlayerBestWinsView = z.infer<typeof playerBestWinsSchema>;

/** Призовое место: 1–3. Делённое третье место тоже награда. */
export const playerAwardSchema = z.object({
  tournament: tournamentRefSchema,
  /** Клуб турнира: награды показываются строкой на клуб, как у RTTF (ADR-050). */
  club: clubRefSchema,
  place: z.number().int().min(1).max(3),
});
export type PlayerAwardView = z.infer<typeof playerAwardSchema>;

export const playerSummarySchema = z.object({
  playerId: z.uuid(),
  /**
   * Место в общем рейтинге страны — то же, что в списке рейтинга: игроки
   * с тем же рейтингом делят место.
   */
  rank: z.number().int().positive(),
  rankedPlayers: z.number().int().nonnegative(),
  /** Максимальный рейтинг за всю историю, включая нынешний. */
  maxRating: z.string(),
  /**
   * Когда максимум достигнут — момент записи в журнал. `null` — журнала нет,
   * и максимум равен стартовому рейтингу.
   */
  maxRatingAt: z.iso.datetime().nullable(),
  /** Период, за который посчитаны поля ниже. Место, максимум и первый турнир — за всё время. */
  period: playerStatsPeriodSchema,
  tournaments: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  firstTournament: tournamentRefSchema.nullable(),
  /** «Чаще всего в»: клуб, где игрок сыграл больше всего турниров. */
  favoriteClub: clubRefSchema.extend({ tournaments: z.number().int().positive() }).nullable(),
  /** Все призовые места, свежие сверху. Не зависят от периода. */
  awards: z.array(playerAwardSchema),
});
export type PlayerSummaryView = z.infer<typeof playerSummarySchema>;

/**
 * Встреча внутри турнира в «Результатах».
 *
 * Круг сетки — расстоянием до финала (`0` — финал), а не номером: клиент
 * называет его «Финал», «Полуфинал», «1/8 финала» без знания всей сетки.
 * У групповой встречи круга нет, есть группа.
 */
export const playerTournamentMatchSchema = z.object({
  matchId: z.uuid(),
  stageName: z.string(),
  groupLabel: z.string().nullable(),
  roundFromFinal: z.number().int().nonnegative().nullable(),
  /** Встреча за места — например, за 3-е. */
  placement: z.boolean(),
  /** Вызов к столу; `null` — встречу внесли без вызова. */
  startedAt: z.iso.datetime().nullable(),
  playedAt: z.iso.datetime().nullable(),
  opponent: playerViewSchema.nullable(),
  /**
   * Рейтинг соперника на момент встречи. Из журнала, а пока турнир не
   * обсчитан — его рейтинг на старте турнира. `null` — соперника нет.
   */
  opponentRating: z.string().nullable(),
  /** Свой рейтинг перед встречей; `null` — встреча рейтинг не двигала. */
  ratingBefore: z.string().nullable(),
  setsFor: z.number().int().nonnegative(),
  setsAgainst: z.number().int().nonnegative(),
  won: z.boolean(),
  resultType: resultTypeSchema.nullable(),
  delta: z.string().nullable(),
  durationMinutes: durationMinutesSchema,
});
export type PlayerTournamentMatchView = z.infer<typeof playerTournamentMatchSchema>;

/**
 * Турнир игрока в «Результатах»: место, изменение рейтинга и встречи.
 *
 * Место — итоговое, записанное при завершении турнира. Делённое место —
 * диапазоном `place`–`placeTo` («5–8»). У идущего турнира места ещё нет.
 */
export const playerTournamentSchema = z.object({
  tournament: tournamentRefSchema.extend({
    status: tournamentStatusSchema,
    level: tournamentLevelSchema,
    club: clubRefSchema,
  }),
  place: z.number().int().positive().nullable(),
  placeTo: z.number().int().positive().nullable(),
  participants: z.number().int().nonnegative(),
  ratingBefore: z.string().nullable(),
  /** Сумма изменений за турнир; `null` — рейтинг по турниру не начислен. */
  delta: z.string().nullable(),
  ratingAfter: z.string().nullable(),
  matches: z.array(playerTournamentMatchSchema),
});
export type PlayerTournamentView = z.infer<typeof playerTournamentSchema>;

/** Турниры игрока, свежие сверху. */
export const playerTournamentsQuerySchema = pageQuerySchema;
export type PlayerTournamentsQuery = z.infer<typeof playerTournamentsQuerySchema>;
