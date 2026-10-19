import { z } from 'zod';

import { CLUB_IMAGE_PATH_PATTERN } from './media.js';
import { pageQuerySchema } from './pagination.js';

/**
 * Живая страница клуба — ADR-055, `docs/09` 3.2: новости и акции, фото,
 * видео YouTube. Публикуется сразу, администратор скрывает (постмодерация,
 * решение владельца от 19.10.2026).
 */

// ---------------------------------------------------------------- записи

export const POST_KINDS = ['NEWS', 'PROMO'] as const;
export const postKindSchema = z.enum(POST_KINDS);
export type PostKind = z.infer<typeof postKindSchema>;

/** Текст записи — простой, без HTML и Markdown: ссылки делает кликабельными клиент. */
export const CLUB_POST_BODY_MAX = 4000;

const postFields = {
  kind: postKindSchema,
  title: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(CLUB_POST_BODY_MAX),
  /** Картинка — загруженная картинка клуба (`POST /files/clubs/:id`). */
  imageUrl: z.string().regex(CLUB_IMAGE_PATH_PATTERN).nullable().optional(),
  /** Срок акции, включительно. У новости срока нет. */
  validUntil: z.iso.date().nullable().optional(),
};

/** Срок есть только у акции: «новость до 31 октября» — это акция. */
function promoOnlyHasDate(
  value: { kind?: PostKind | undefined; validUntil?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (value.kind === 'NEWS' && value.validUntil !== undefined && value.validUntil !== null) {
    ctx.addIssue({
      code: 'custom',
      message: 'Срок бывает только у акции',
      path: ['validUntil'],
    });
  }
}

export const createClubPostSchema = z.object(postFields).superRefine(promoOnlyHasDate);
export type CreateClubPostInput = z.infer<typeof createClubPostSchema>;

export const updateClubPostSchema = z
  .object({ ...postFields, pinned: z.boolean() })
  .partial()
  .superRefine(promoOnlyHasDate)
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateClubPostInput = z.infer<typeof updateClubPostSchema>;

export const listClubPostsSchema = pageQuerySchema.extend({
  /** С завершившимися акциями — для кабинета клуба. Публично они уходят в архив сами. */
  archive: z.stringbool().optional(),
});
export type ListClubPostsQuery = z.infer<typeof listClubPostsSchema>;

export const clubPostViewSchema = z.object({
  id: z.uuid(),
  clubId: z.uuid(),
  kind: postKindSchema,
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  validUntil: z.iso.date().nullable(),
  pinned: z.boolean(),
  publishedAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  /** Скрыта администратором: публично не видна, клуб видит причину в кабинете. */
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
});
export type ClubPostView = z.infer<typeof clubPostViewSchema>;

/**
 * Акция завершилась: её последний день прошёл по местному времени клуба.
 * `today` — дата клуба `YYYY-MM-DD`; строки такого вида сравниваются как даты.
 */
export function isPromoExpired(
  post: Pick<ClubPostView, 'kind' | 'validUntil'>,
  today: string,
): boolean {
  return post.kind === 'PROMO' && post.validUntil !== null && post.validUntil < today;
}

// ---------------------------------------------------------------- фото и видео

export const MEDIA_KINDS = ['PHOTO', 'VIDEO'] as const;
export const mediaKindSchema = z.enum(MEDIA_KINDS);
export type MediaKind = z.infer<typeof mediaKindSchema>;

const caption = z.string().trim().min(1).max(200);

/** Видео — ссылкой на YouTube. Сервер сам скачивает обложку и хранит у себя. */
export const addClubVideoSchema = z.object({
  url: z.string().trim().min(1).max(500),
  caption: caption.nullable().optional(),
});
export type AddClubVideoInput = z.infer<typeof addClubVideoSchema>;

export const updateClubMediaSchema = z.object({ caption: caption.nullable() });
export type UpdateClubMediaInput = z.infer<typeof updateClubMediaSchema>;

/** Порядок галереи целиком: идентификаторы в нужном порядке. */
export const reorderClubMediaSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});
export type ReorderClubMediaInput = z.infer<typeof reorderClubMediaSchema>;

export const clubMediaViewSchema = z.object({
  id: z.uuid(),
  clubId: z.uuid(),
  kind: mediaKindSchema,
  /** Фото — сама картинка, видео — его обложка, тоже наша. */
  imageUrl: z.string(),
  youtubeId: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  caption: z.string().nullable(),
  createdAt: z.iso.datetime(),
  hidden: z.boolean(),
});
export type ClubMediaView = z.infer<typeof clubMediaViewSchema>;

/**
 * Ссылка на ролик YouTube и его идентификатор (11 знаков) — первой из трёх
 * групп. Разбор выражением, а не `URL`: общий код не тянет библиотек
 * платформы и собирается без DOM и Node.
 */
const YOUTUBE_URL =
  /^https?:\/\/(?:www\.|m\.)?(?:youtu\.be\/([\w-]{11})|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=([\w-]{11})|(?:shorts|embed|live)\/([\w-]{11})))(?:[?&#/].*)?$/;

/**
 * Идентификатор ролика из ссылки, как её копируют: `youtu.be/<id>`,
 * `youtube.com/watch?v=<id>`, `/shorts/<id>`, `/embed/<id>`, `/live/<id>`,
 * с `m.` и `www.` и без. Чужая ссылка — `null`: вставлять в страницу клуба
 * можно только YouTube, и только через `youtube-nocookie.com`.
 */
export function parseYoutubeId(input: string): string | null {
  const match = YOUTUBE_URL.exec(input.trim());

  // Совпала ровно одна группа; несовпавшие при склейке дают пустую строку.
  return match === null ? null : match.slice(1).join('');
}

// ---------------------------------------------------------------- модерация

/** Лента свежего контента всех клубов для администратора. */
export const clubContentFeedSchema = pageQuerySchema;

export const CONTENT_KINDS = ['POST', 'MEDIA'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const clubContentItemSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  id: z.uuid(),
  club: z.object({ id: z.uuid(), name: z.string() }),
  createdAt: z.iso.datetime(),
  /** Заголовок записи или подпись медиа. */
  title: z.string().nullable(),
  /** Начало текста записи — чтобы не открывать каждую. */
  excerpt: z.string().nullable(),
  imageUrl: z.string().nullable(),
  youtubeId: z.string().nullable(),
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
});
export type ClubContentItem = z.infer<typeof clubContentItemSchema>;

export const hideClubContentSchema = z.object({
  hidden: z.boolean(),
  /** Причина видна клубу в кабинете: «скрыто: реклама чужих услуг». */
  reason: z.string().trim().min(1).max(200).nullable().optional(),
});
export type HideClubContentInput = z.infer<typeof hideClubContentSchema>;
