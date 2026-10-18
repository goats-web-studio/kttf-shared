import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';
import { playerViewSchema } from './player.js';
import { resultTypeSchema } from './stage.js';
import { tournamentStatusSchema } from './tournament.js';

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

/**
 * Лучшая победа — над самым сильным соперником.
 *
 * Сила соперника — его рейтинг на момент встречи из журнала, а не нынешний:
 * победа над тем, кто тогда был сильнее, и остаётся сильнейшей. Победы вне
 * зачёта сюда не попадают — рейтинга соперника для них в журнале нет.
 */
export const playerBestWinSchema = z.object({
  matchId: z.uuid(),
  tournament: tournamentRefSchema,
  playedAt: z.iso.datetime().nullable(),
  opponent: playerViewSchema,
  opponentRating: z.string(),
  setsFor: z.number().int().nonnegative(),
  setsAgainst: z.number().int().nonnegative(),
  delta: z.string(),
});
export type PlayerBestWinView = z.infer<typeof playerBestWinSchema>;

/** Призовое место: 1–3. Делённое третье место тоже награда. */
export const playerAwardSchema = z.object({
  tournament: tournamentRefSchema,
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
  /** Период, за который посчитаны поля ниже. Место, максимум и первый турнир — за всё время. */
  period: playerStatsPeriodSchema,
  tournaments: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  firstTournament: tournamentRefSchema.nullable(),
  /** «Чаще всего в»: клуб, где игрок сыграл больше всего турниров. */
  favoriteClub: z
    .object({
      id: z.uuid(),
      name: z.string(),
      tournaments: z.number().int().positive(),
    })
    .nullable(),
  /** До пяти побед над самыми сильными соперниками. */
  bestWins: z.array(playerBestWinSchema),
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
  playedAt: z.iso.datetime().nullable(),
  opponent: playerViewSchema.nullable(),
  setsFor: z.number().int().nonnegative(),
  setsAgainst: z.number().int().nonnegative(),
  won: z.boolean(),
  resultType: resultTypeSchema.nullable(),
  delta: z.string().nullable(),
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
    club: z.object({ id: z.uuid(), name: z.string() }),
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
