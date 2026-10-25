import { z } from 'zod';

/**
 * Подписки — ADR-073.
 *
 * Подписаться можно на клуб, тренера и игрока: их новости, акции, турниры
 * и события приходят во вкладку ленты «Подписки». Число подписчиков видно
 * на странице — оно же говорит клубу, что страница работает (ADR-055).
 */

export const FOLLOW_TARGETS = ['CLUB', 'COACH', 'PLAYER'] as const;
export const followTargetSchema = z.enum(FOLLOW_TARGETS);
export type FollowTarget = z.infer<typeof followTargetSchema>;

/** Подписка в адресе: `/follows/CLUB/:id`. */
export const followParamsSchema = z.object({
  type: followTargetSchema,
  id: z.uuid(),
});
export type FollowParams = z.infer<typeof followParamsSchema>;

/** Подписчиков у страницы и подписан ли вошедший. Гостю — всегда `false`. */
export const followStateSchema = z.object({
  followers: z.number().int().nonnegative(),
  following: z.boolean(),
});
export type FollowState = z.infer<typeof followStateSchema>;

/** Почему предложили подписаться — подпись под строкой рекомендации. */
export const FOLLOW_REASONS = ['CITY', 'PLAYED', 'OPPONENT', 'POPULAR'] as const;
export const followReasonSchema = z.enum(FOLLOW_REASONS);
export type FollowReason = z.infer<typeof followReasonSchema>;

/** Сколько рекомендаций отдаёт сервер за раз. */
export const FOLLOW_SUGGESTIONS_MAX = 10;

export const followSuggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(FOLLOW_SUGGESTIONS_MAX).default(5),
});
export type FollowSuggestionsQuery = z.infer<typeof followSuggestionsQuerySchema>;

export const followSuggestionSchema = z.object({
  type: followTargetSchema,
  id: z.uuid(),
  name: z.string(),
  /** Логотип клуба, фото тренера или игрока. */
  imageUrl: z.string().nullable(),
  /** Адрес страницы тренера; у клуба и игрока — `null`, адрес по `id`. */
  slug: z.string().nullable(),
  /** Город — подпись под именем. */
  city: z.string().nullable(),
  /** Рейтинг игрока строкой (ADR-014); у клуба и тренера — `null`. */
  rating: z.string().nullable(),
  followers: z.number().int().nonnegative(),
  reason: followReasonSchema,
});
export type FollowSuggestion = z.infer<typeof followSuggestionSchema>;
