import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';

/**
 * Форум — ADR-064, `docs/12`. Разделы → темы → сообщения. Автор —
 * пользователь с профилем игрока; текст простой, как у записей клубов
 * (ADR-055 §8): ссылки делает кликабельными клиент. Реакция одна —
 * «нравится». Модерация — администратор и жалобы, скрытое остаётся
 * заглушкой с причиной.
 */

// ---------------------------------------------------------------- пределы

export const FORUM_TOPIC_TITLE_MAX = 150;
export const FORUM_POST_BODY_MAX = 10_000;
/** Цитата — фрагмент, а не пересказ всего сообщения. */
export const FORUM_QUOTE_MAX = 1000;
export const FORUM_POST_IMAGES_MAX = 4;
/** Сообщений темы на странице. Номер сообщения → страница: `forumPostPage`. */
export const FORUM_POSTS_PAGE_SIZE = 20;

/** Новых тем от человека за сутки. */
export const FORUM_TOPICS_PER_DAY = 5;
/** Сообщений от человека за час: живой разговор укладывается, флуд — нет. */
export const FORUM_POSTS_PER_HOUR = 30;
/** Жалоб от человека за сутки. */
export const FORUM_REPORTS_PER_DAY = 20;

/** Кто говорит за обсуждаемую сторону — метка у сообщения (ADR-067). */
export const FORUM_POST_ROLES = ['ORGANIZER', 'CLUB', 'COACH'] as const;
export type ForumPostRole = (typeof FORUM_POST_ROLES)[number];

// ---------------------------------------------------------------- предмет темы

/**
 * Тема с предметом (F2): турнир, клуб, тренер, товар. Одна тема на предмет;
 * она же — обсуждение или отзывы на странице предмета. Новость или акция
 * клуба и тренера (`CLUB_POST`, `COACH_POST`) — тоже тема: публикуется на
 * форуме сама, и под ней обсуждают (ADR-067).
 */
export const FORUM_SUBJECT_TYPES = [
  'TOURNAMENT',
  'CLUB',
  'COACH',
  'PRODUCT',
  'CLUB_POST',
  'COACH_POST',
] as const;
export const forumSubjectTypeSchema = z.enum(FORUM_SUBJECT_TYPES);
export type ForumSubjectType = z.infer<typeof forumSubjectTypeSchema>;

/**
 * Предмет темы для ссылки: у тренера и товара адрес по `slug`, у остальных —
 * по `id`. У новости — чья она: клуб или тренер (`owner`), ведёт на их страницу.
 */
export const forumSubjectSchema = z.object({
  type: forumSubjectTypeSchema,
  id: z.uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  owner: z
    .object({
      kind: z.enum(['CLUB', 'COACH']),
      id: z.uuid(),
      slug: z.string().nullable(),
      name: z.string(),
      logoUrl: z.string().nullable(),
    })
    .nullable(),
  /**
   * У новости — её картинка, вид и срок акции: статья темы показывает запись
   * так же, как страница клуба или тренера. У остальных предметов — `null`.
   */
  news: z
    .object({
      kind: z.enum(['NEWS', 'PROMO']),
      imageUrl: z.string().nullable(),
      validUntil: z.iso.date().nullable(),
    })
    .nullable(),
});
export type ForumSubject = z.infer<typeof forumSubjectSchema>;

// ---------------------------------------------------------------- разделы

export const FORUM_SECTION_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;

export const forumSectionInputSchema = z.object({
  slug: z.string().regex(FORUM_SECTION_SLUG_PATTERN),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  position: z.number().int().min(0).max(1000).optional(),
  /** Куда попадают темы с предметом этих типов. Один раздел на тип. */
  subjectTypes: z.array(forumSubjectTypeSchema).max(FORUM_SUBJECT_TYPES.length).optional(),
  /**
   * Можно ли завести тему руками. В «Новостях клубов и тренеров» — нет:
   * тема там — сама новость (ADR-067).
   */
  manualTopics: z.boolean().optional(),
});
export type ForumSectionInput = z.infer<typeof forumSectionInputSchema>;

export const updateForumSectionSchema = forumSectionInputSchema
  .extend({ archived: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateForumSectionInput = z.infer<typeof updateForumSectionSchema>;

/** Последняя активность — для строки раздела. */
const lastActivitySchema = z.object({
  topicId: z.uuid(),
  topicTitle: z.string(),
  at: z.iso.datetime(),
  authorName: z.string().nullable(),
});

export const forumSectionViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  subjectTypes: z.array(forumSubjectTypeSchema),
  manualTopics: z.boolean(),
  /** В архиве — не принимает новых тем; видна только администратору. */
  archived: z.boolean(),
  topicsCount: z.number().int().nonnegative(),
  postsCount: z.number().int().nonnegative(),
  last: lastActivitySchema.nullable(),
});
export type ForumSectionView = z.infer<typeof forumSectionViewSchema>;

// ---------------------------------------------------------------- автор

/**
 * Автор — из профиля игрока на момент чтения: сменил клуб — у старых
 * сообщений тоже новый. `null` у сообщения — аккаунта больше нет.
 */
export const forumAuthorSchema = z.object({
  userId: z.uuid(),
  playerId: z.uuid().nullable(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  rating: z.number().nullable(),
  club: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  /** Администратор KTTF — метка «Модератор». */
  moderator: z.boolean(),
  /** Опубликованная страница тренера — метка «Тренер» ссылкой (ADR-067). */
  coachSlug: z.string().nullable(),
  /** Был на сайте последние `ONLINE_WINDOW_MS` — точка «в сети». */
  online: z.boolean(),
});
export type ForumAuthor = z.infer<typeof forumAuthorSchema>;

// ---------------------------------------------------------------- темы

export const forumTopicItemSchema = z.object({
  id: z.uuid(),
  section: z.object({ id: z.uuid(), slug: z.string(), title: z.string() }),
  title: z.string(),
  author: forumAuthorSchema.nullable(),
  subject: forumSubjectSchema.nullable(),
  createdAt: z.iso.datetime(),
  /** Всего сообщений, первое тоже. Ответов — на одно меньше. */
  postsCount: z.number().int().nonnegative(),
  lastPostAt: z.iso.datetime(),
  lastAuthorName: z.string().nullable(),
  pinned: z.boolean(),
  locked: z.boolean(),
  /** Скрыта модератором: в списках её нет, по ссылке — автору и администратору. */
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
  /** Просмотры — как у RTTF, приблизительно: повтор того же человека за полчаса не считается. */
  viewsCount: z.number().int().nonnegative(),
  /**
   * Новых сообщений с прошлого захода этого человека; `null` — не вошёл или
   * тему ещё не открывал (тогда она не «новая», а просто непрочитанная).
   */
  unread: z.number().int().nonnegative().nullable(),
  /** Номер первого непрочитанного — ссылка «к новым». */
  firstUnread: z.number().int().positive().nullable(),
});
export type ForumTopicItem = z.infer<typeof forumTopicItemSchema>;

export const FORUM_TOPIC_SORTS = ['ACTIVE', 'NEW'] as const;

/**
 * `GET /forum/topics` — один список на все случаи: раздел, поиск по
 * заголовку, темы игрока. Закреплённые идут первыми только внутри раздела.
 */
export const listForumTopicsSchema = pageQuerySchema.extend({
  section: z.string().regex(FORUM_SECTION_SLUG_PATTERN).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  authorPlayerId: z.uuid().optional(),
  /** Только темы предметов этого типа: «Обсуждение турниров» на главной форума. */
  subjectType: forumSubjectTypeSchema.optional(),
  sort: z.enum(FORUM_TOPIC_SORTS).default('ACTIVE'),
});
export type ListForumTopicsQuery = z.infer<typeof listForumTopicsSchema>;

/** Цитата — снимок выделенного фрагмента и ссылка на сообщение. */
export const forumQuoteInputSchema = z.object({
  postId: z.uuid(),
  text: z.string().trim().min(1).max(FORUM_QUOTE_MAX),
});
export type ForumQuoteInput = z.infer<typeof forumQuoteInputSchema>;

/** Путь фото форума — загружается `POST /files/forum`. */
export const FORUM_IMAGE_PATH_PATTERN = /^\/api\/v1\/files\/forum\/[0-9a-f-]{36}\.webp$/;

export const forumImageSchema = z.object({
  url: z.string().regex(FORUM_IMAGE_PATH_PATTERN),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type ForumImage = z.infer<typeof forumImageSchema>;

const postBody = z.string().trim().min(1).max(FORUM_POST_BODY_MAX);
const images = z.array(forumImageSchema).max(FORUM_POST_IMAGES_MAX);

export const createForumPostSchema = z.object({
  body: postBody,
  quote: forumQuoteInputSchema.optional(),
  images: images.optional(),
});
export type CreateForumPostInput = z.infer<typeof createForumPostSchema>;

export const createForumTopicSchema = z.object({
  sectionId: z.uuid(),
  title: z.string().trim().min(3).max(FORUM_TOPIC_TITLE_MAX),
  body: postBody,
  images: images.optional(),
});
export type CreateForumTopicInput = z.infer<typeof createForumTopicSchema>;

/** Автор правит текст и фото; цитата остаётся как была. */
export const updateForumPostSchema = z.object({
  body: postBody,
  images: images.optional(),
});
export type UpdateForumPostInput = z.infer<typeof updateForumPostSchema>;

export const renameForumTopicSchema = z.object({
  title: z.string().trim().min(3).max(FORUM_TOPIC_TITLE_MAX),
});
export type RenameForumTopicInput = z.infer<typeof renameForumTopicSchema>;

// ---------------------------------------------------------------- сообщения

export const forumPostViewSchema = z.object({
  id: z.uuid(),
  topicId: z.uuid(),
  /** Порядковый в теме, с единицы: ссылка «#12» и страница. */
  number: z.number().int().positive(),
  author: forumAuthorSchema.nullable(),
  /**
   * Текст. У удалённого автором — пустой для всех; у скрытого модератором —
   * пустой для всех, кроме автора и администратора.
   */
  body: z.string(),
  quote: z
    .object({
      postId: z.uuid().nullable(),
      number: z.number().int().positive().nullable(),
      authorName: z.string().nullable(),
      text: z.string(),
    })
    .nullable(),
  images: z.array(forumImageSchema),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  deleted: z.boolean(),
  hidden: z.boolean(),
  /** Причина видна всем: модерация на виду (ADR-064 §5). */
  hiddenReason: z.string().nullable(),
  likes: z.number().int().nonnegative(),
  liked: z.boolean(),
  mine: z.boolean(),
  /**
   * Автор говорит за ту сторону, которую обсуждают (ADR-067): организатор
   * турнира (состав клуба-хозяина), клуб в его отзывах и новостях, тренер в
   * своих. `null` — обычный участник.
   */
  role: z.enum(FORUM_POST_ROLES).nullable(),
});
export type ForumPostView = z.infer<typeof forumPostViewSchema>;

/** Тема целиком: то же, первое сообщение отдельно и что может вошедший. */
export const forumTopicViewSchema = forumTopicItemSchema.extend({
  /**
   * Первое сообщение — «статья» над ответами, как у RTTF (ADR-067). Ответы —
   * `GET …/posts?replies=true` со своей сортировкой.
   */
  firstPost: forumPostViewSchema.nullable(),
  subscribed: z.boolean(),
  /**
   * Может ли этот человек ответить. Почему нет — видно из `locked` и
   * `GET /forum/me`: не вошёл, нет профиля, запрет.
   */
  canReply: z.boolean(),
  canRename: z.boolean(),
});
export type ForumTopicView = z.infer<typeof forumTopicViewSchema>;

/** Порядок ответов в теме: по порядку, новые сверху, лучшие — по «нравится». */
export const FORUM_POST_SORTS = ['OLD', 'NEW', 'TOP'] as const;
export const forumPostSortSchema = z.enum(FORUM_POST_SORTS);
export type ForumPostSort = z.infer<typeof forumPostSortSchema>;

/**
 * `GET /forum/topics/:id/posts`. `replies=true` — без первого сообщения:
 * оно стоит отдельно (`ForumTopicView.firstPost`).
 */
export const listForumPostsSchema = pageQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(100).default(FORUM_POSTS_PAGE_SIZE),
  sort: forumPostSortSchema.default('OLD'),
  replies: z.stringbool().optional(),
});
export type ListForumPostsQuery = z.infer<typeof listForumPostsSchema>;

/**
 * Страница ответов по порядку (`OLD`), на которой стоит сообщение с этим
 * номером. Первое сообщение — «статья» над ответами: оно на первой странице.
 */
export function forumPostPage(number: number, limit: number = FORUM_POSTS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil((number - 1) / limit));
}

/**
 * `GET /forum/posts` — лента сообщений всего форума, как «Комментарии» у
 * RTTF: фильтры по разделу, типу предмета, автору, тексту (ADR-067).
 */
export const listForumFeedSchema = pageQuerySchema.extend({
  authorPlayerId: z.uuid().optional(),
  section: z.string().regex(FORUM_SECTION_SLUG_PATTERN).optional(),
  subjectType: forumSubjectTypeSchema.optional(),
  q: z.string().trim().min(2).max(100).optional(),
  sort: z.enum(['NEW', 'OLD', 'TOP']).default('NEW'),
});
export type ListForumFeedQuery = z.infer<typeof listForumFeedSchema>;

/** Сообщение в ленте — с темой, разделом и предметом, чтобы строка вела куда надо. */
export const forumPostItemSchema = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  topic: z.object({ id: z.uuid(), title: z.string() }),
  section: z.object({ slug: z.string(), title: z.string() }),
  subject: forumSubjectSchema.nullable(),
  author: forumAuthorSchema.nullable(),
  role: z.enum(FORUM_POST_ROLES).nullable(),
  /** Начало текста. */
  excerpt: z.string(),
  createdAt: z.iso.datetime(),
  likes: z.number().int().nonnegative(),
});
export type ForumPostItem = z.infer<typeof forumPostItemSchema>;

/** `GET /forum/posts/:id/locate` — где сообщение: для ссылок из уведомлений. */
export const forumPostLocationSchema = z.object({
  topicId: z.uuid(),
  number: z.number().int().positive(),
});
export type ForumPostLocation = z.infer<typeof forumPostLocationSchema>;

export const forumLikeViewSchema = z.object({
  likes: z.number().int().nonnegative(),
  liked: z.boolean(),
});
export type ForumLikeView = z.infer<typeof forumLikeViewSchema>;

// ---------------------------------------------------------------- тема предмета (F2)

/**
 * `GET /forum/subjects/:type/:id` — блок «Обсуждение» на странице предмета:
 * тема, если уже есть, и последние сообщения.
 */
export const forumSubjectThreadSchema = z.object({
  section: z.object({ id: z.uuid(), slug: z.string(), title: z.string() }).nullable(),
  topic: forumTopicViewSchema.nullable(),
  /** Последние сообщения, по порядку номеров. */
  posts: z.array(forumPostViewSchema),
});
export type ForumSubjectThread = z.infer<typeof forumSubjectThreadSchema>;

export const FORUM_SUBJECT_LAST_POSTS = 5;

// ---------------------------------------------------------------- вошедший

/** `GET /forum/me` — может ли человек писать; если нет — почему. */
export const forumMeSchema = z.object({
  canPost: z.boolean(),
  /** Нет профиля игрока: писать нельзя, пока не заполнит. */
  profileRequired: z.boolean(),
  mute: z.object({ until: z.iso.datetime(), reason: z.string() }).nullable(),
  moderator: z.boolean(),
});
export type ForumMe = z.infer<typeof forumMeSchema>;

// ---------------------------------------------------------------- жалобы

export const FORUM_REPORT_REASONS = ['SPAM', 'ABUSE', 'OFFTOPIC', 'OTHER'] as const;
export const forumReportReasonSchema = z.enum(FORUM_REPORT_REASONS);
export type ForumReportReason = z.infer<typeof forumReportReasonSchema>;

export const createForumReportSchema = z
  .object({
    reason: forumReportReasonSchema,
    comment: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.reason === 'OTHER' && value.comment === undefined) {
      ctx.addIssue({ code: 'custom', path: ['comment'], message: 'Опишите, что не так' });
    }
  });
export type CreateForumReportInput = z.infer<typeof createForumReportSchema>;

export const FORUM_REPORT_STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED'] as const;
export const forumReportStatusSchema = z.enum(FORUM_REPORT_STATUSES);
export type ForumReportStatus = z.infer<typeof forumReportStatusSchema>;

export const listForumReportsSchema = pageQuerySchema.extend({
  status: forumReportStatusSchema.default('OPEN'),
});
export type ListForumReportsQuery = z.infer<typeof listForumReportsSchema>;

/** Жалоба в очереди администратора — с сообщением, чтобы не открывать каждое. */
export const forumReportViewSchema = z.object({
  id: z.uuid(),
  reason: forumReportReasonSchema,
  comment: z.string().nullable(),
  status: forumReportStatusSchema,
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  reporterName: z.string(),
  post: z.object({
    id: z.uuid(),
    number: z.number().int().positive(),
    topic: z.object({ id: z.uuid(), title: z.string() }),
    author: forumAuthorSchema.nullable(),
    body: z.string(),
    hidden: z.boolean(),
    hiddenReason: z.string().nullable(),
    deleted: z.boolean(),
  }),
});
export type ForumReportView = z.infer<typeof forumReportViewSchema>;

/** Отклонить жалобу. Принимается она скрытием сообщения. */
export const resolveForumReportSchema = z.object({ status: z.literal('REJECTED') });
export type ResolveForumReportInput = z.infer<typeof resolveForumReportSchema>;

// ---------------------------------------------------------------- модерация

const reason = z.string().trim().min(1).max(200);

/** Скрыть или вернуть сообщение. Скрывая, причину назвать обязательно. */
export const hideForumPostSchema = z
  .object({ hidden: z.boolean(), reason: reason.optional() })
  .refine((value) => !value.hidden || value.reason !== undefined, {
    message: 'Укажите причину',
    path: ['reason'],
  });
export type HideForumPostInput = z.infer<typeof hideForumPostSchema>;

/** Тема у администратора: закрепить, закрыть, перенести, переименовать, скрыть. */
export const moderateForumTopicSchema = z
  .object({
    pinned: z.boolean(),
    locked: z.boolean(),
    sectionId: z.uuid(),
    title: z.string().trim().min(3).max(FORUM_TOPIC_TITLE_MAX),
    hidden: z.boolean(),
    reason: reason,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' })
  .refine((value) => value.hidden !== true || value.reason !== undefined, {
    message: 'Укажите причину',
    path: ['reason'],
  });
export type ModerateForumTopicInput = z.infer<typeof moderateForumTopicSchema>;

export const FORUM_MUTE_DAYS_MAX = 3650;

/** Запрет писать — `PUT /admin/forum/mutes/:userId`. */
export const forumMuteInputSchema = z.object({
  days: z.number().int().min(1).max(FORUM_MUTE_DAYS_MAX),
  reason: reason,
});
export type ForumMuteInput = z.infer<typeof forumMuteInputSchema>;

export const forumMuteViewSchema = z.object({
  user: forumAuthorSchema,
  until: z.iso.datetime(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});
export type ForumMuteView = z.infer<typeof forumMuteViewSchema>;

// ---------------------------------------------------------------- правила и предупреждения (ADR-067)

/**
 * Пункты «Правил общения» — `/forum/rules`. Модератор ссылается на пункт,
 * скрывая сообщение или предупреждая: как у RTTF, санкция называет правило.
 */
export const FORUM_RULES = ['ABUSE', 'FLOOD', 'ADS', 'DUPLICATE', 'OFFTOPIC', 'OTHER'] as const;
export const forumRuleSchema = z.enum(FORUM_RULES);
export type ForumRule = z.infer<typeof forumRuleSchema>;

/** Предупреждение без скрытия — `POST /admin/forum/warnings`; уходит уведомлением. */
export const forumWarningInputSchema = z
  .object({
    userId: z.uuid(),
    postId: z.uuid().optional(),
    rule: forumRuleSchema,
    comment: z.string().trim().min(1).max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.rule === 'OTHER' && value.comment === undefined) {
      ctx.addIssue({ code: 'custom', path: ['comment'], message: 'Опишите нарушение' });
    }
  });
export type ForumWarningInput = z.infer<typeof forumWarningInputSchema>;

// ---------------------------------------------------------------- сбоку на форуме (ADR-067)

/** `GET /forum/online` — «Сейчас на сайте: игроков N». */
export const forumOnlineSchema = z.object({ players: z.number().int().nonnegative() });
export type ForumOnline = z.infer<typeof forumOnlineSchema>;

/**
 * `GET /forum/birthdays` — дни рождения сегодня по времени Казахстана.
 * Только игроки, которые показывают дату полностью (ADR-037): у остальных
 * посторонним виден лишь год.
 */
export const forumBirthdaySchema = z.object({
  playerId: z.uuid(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  rating: z.number().nullable(),
  age: z.number().int().positive(),
});
export type ForumBirthday = z.infer<typeof forumBirthdaySchema>;

/** Обсуждение новости на странице клуба и тренера — ссылка «Обсудить (N)». */
export const forumDiscussionLinkSchema = z.object({
  topicId: z.uuid(),
  replies: z.number().int().nonnegative(),
});
export type ForumDiscussionLink = z.infer<typeof forumDiscussionLinkSchema>;
