import { z } from 'zod';

import { clubPodiumPlaceSchema } from './club-page.js';
import { forumImageSchema } from './forum.js';
import { clubRefSchema, tournamentRefSchema } from './player-profile.js';
import { tournamentStatusSchema } from './tournament.js';

/**
 * Лента главной — ADR-073.
 *
 * Собирается из того, что в системе уже есть: новости и акции клубов и
 * тренеров, новости KTTF (раздел форума), объявленные турниры, итоги,
 * события игроков (медаль, новый уровень) и записи игроков — темы раздела
 * форума «Записи игроков». Обсуждение, «нравится», просмотры и модерация —
 * форумные (ADR-064, ADR-067).
 *
 * Порядок — время с поправкой на вес источника: клубы, тренеры и новости
 * KTTF держатся наверху дольше, записи игроков в общих вкладках — только
 * самые читаемые.
 */

export const FEED_TABS = ['FOR_YOU', 'FOLLOWING', 'ALL'] as const;
export const feedTabSchema = z.enum(FEED_TABS);
export type FeedTab = z.infer<typeof feedTabSchema>;

/** Окно ленты: старше — не лента, а архив разделов. */
export const FEED_WINDOW_DAYS = 60;

/** Записей игроков в общих вкладках — сколько самых читаемых за неделю. */
export const FEED_POPULAR_POSTS_PER_WEEK = 5;

/** Длина текста записи в карточке — дальше «Читать полностью». */
export const FEED_EXCERPT_MAX = 400;

export const FEED_PAGE_MAX = 30;

export const feedQuerySchema = z.object({
  tab: feedTabSchema.default('ALL'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(FEED_PAGE_MAX).default(10),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Чьё это — шапка карточки. `KTTF` — сам портал. */
export const FEED_SOURCE_KINDS = ['CLUB', 'COACH', 'PLAYER', 'KTTF'] as const;
export const feedSourceSchema = z.object({
  kind: z.enum(FEED_SOURCE_KINDS),
  /** Клуб, страница тренера или игрок; у KTTF — `null`. */
  id: z.uuid().nullable(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  /** Адрес страницы тренера; у остальных адрес строится по `id`. */
  slug: z.string().nullable(),
});
export type FeedSource = z.infer<typeof feedSourceSchema>;

/** Счётчики обсуждения на форуме. */
export const feedDiscussionSchema = z.object({
  topicId: z.uuid(),
  /** Ответов — без первого сообщения. */
  comments: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  views: z.number().int().nonnegative(),
});
export type FeedDiscussion = z.infer<typeof feedDiscussionSchema>;

const base = {
  /** Ключ карточки: тип и идентификатор источника. */
  id: z.string(),
  at: z.iso.datetime(),
  source: feedSourceSchema,
  discussion: feedDiscussionSchema.nullable(),
};

/** Новость или акция клуба и тренера (ADR-055, ADR-059). */
export const feedPostItemSchema = z.object({
  ...base,
  type: z.literal('POST'),
  kind: z.enum(['NEWS', 'PROMO']),
  title: z.string(),
  excerpt: z.string(),
  imageUrl: z.string().nullable(),
  /** Последний день акции. */
  validUntil: z.iso.date().nullable(),
});

/** Новость KTTF или запись игрока — тема форума, текст и фото первого сообщения. */
export const feedTopicItemSchema = z.object({
  ...base,
  type: z.enum(['PORTAL', 'PLAYER_POST']),
  title: z.string(),
  excerpt: z.string(),
  images: z.array(forumImageSchema),
});

/** Объявлен турнир — запись открыта или скоро. */
export const feedTournamentItemSchema = z.object({
  ...base,
  type: z.literal('TOURNAMENT'),
  tournament: tournamentRefSchema.extend({
    status: tournamentStatusSchema,
    club: clubRefSchema,
    ratingCapMin: z.string().nullable(),
    ratingCapMax: z.string().nullable(),
    participants: z.number().int().nonnegative(),
    maxParticipants: z.number().int().positive().nullable(),
  }),
});

/** Итоги турнира — тройка призёров. */
export const feedResultItemSchema = z.object({
  ...base,
  type: z.literal('RESULT'),
  tournament: tournamentRefSchema.extend({ club: clubRefSchema }),
  participants: z.number().int().nonnegative(),
  places: z.array(clubPodiumPlaceSchema),
});

/** Событие игрока: медаль турнира или новый уровень (ADR-070). */
export const feedAchievementItemSchema = z.object({
  ...base,
  type: z.literal('ACHIEVEMENT'),
  achievement: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('MEDAL'),
      place: z.number().int().min(1).max(3),
      tournament: tournamentRefSchema,
    }),
    z.object({
      kind: z.literal('LEVEL_UP'),
      level: z.number().int().min(1).max(10),
      rating: z.string(),
      tournament: tournamentRefSchema.nullable(),
    }),
  ]),
});

export const feedItemSchema = z.union([
  feedPostItemSchema,
  feedTopicItemSchema,
  feedTournamentItemSchema,
  feedResultItemSchema,
  feedAchievementItemSchema,
]);
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedPostItem = z.infer<typeof feedPostItemSchema>;
export type FeedTopicItem = z.infer<typeof feedTopicItemSchema>;
export type FeedTournamentItem = z.infer<typeof feedTournamentItemSchema>;
export type FeedResultItem = z.infer<typeof feedResultItemSchema>;
export type FeedAchievementItem = z.infer<typeof feedAchievementItemSchema>;

export const feedPageSchema = z.object({
  tab: feedTabSchema,
  items: z.array(feedItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type FeedPage = z.infer<typeof feedPageSchema>;

/**
 * Разделы форума, на которых стоит лента: записи игроков пишет любой с
 * профилем, новости KTTF — только администратор (раздел без тем руками).
 */
export const FEED_POSTS_SECTION = 'posts';
export const FEED_PORTAL_SECTION = 'kttf';
