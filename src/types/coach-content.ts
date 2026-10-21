import { z } from 'zod';

import {
  CLUB_POST_BODY_MAX,
  addClubVideoSchema,
  hideClubContentSchema,
  mediaKindSchema,
  postKindSchema,
  reorderClubMediaSchema,
  updateClubMediaSchema,
  type PostKind,
} from './club-content.js';
import { COACH_IMAGE_PATH_PATTERN } from './coach.js';
import { pageQuerySchema } from './pagination.js';

/**
 * Фото, видео и новости тренера — T2.2 (ADR-059, `docs/11` 3.2). Механика
 * клуба один в один (ADR-055, `club-content.ts`): постмодерация, простой
 * текст, один закреп, акция уходит в архив после срока, YouTube по нажатию.
 * Отличие одно — картинки лежат в папке тренера (`COACH_IMAGE_PATH_PATTERN`).
 */

// ---------------------------------------------------------------- записи

const postFields = {
  kind: postKindSchema,
  title: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(CLUB_POST_BODY_MAX),
  /** Картинка — загруженная картинка тренера (`POST /files/coaches/:id`). */
  imageUrl: z.string().regex(COACH_IMAGE_PATH_PATTERN).nullable().optional(),
  /** Срок акции, включительно. У новости срока нет. */
  validUntil: z.iso.date().nullable().optional(),
};

/** Срок есть только у акции — то же правило, что у клуба. */
function promoOnlyHasDate(
  value: { kind?: PostKind | undefined; validUntil?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (value.kind === 'NEWS' && value.validUntil !== undefined && value.validUntil !== null) {
    ctx.addIssue({ code: 'custom', message: 'Срок бывает только у акции', path: ['validUntil'] });
  }
}

export const createCoachPostSchema = z.object(postFields).superRefine(promoOnlyHasDate);
export type CreateCoachPostInput = z.infer<typeof createCoachPostSchema>;

export const updateCoachPostSchema = z
  .object({ ...postFields, pinned: z.boolean() })
  .partial()
  .superRefine(promoOnlyHasDate)
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateCoachPostInput = z.infer<typeof updateCoachPostSchema>;

export const listCoachPostsSchema = pageQuerySchema.extend({
  /** С завершившимися акциями — для кабинета тренера. */
  archive: z.stringbool().optional(),
});
export type ListCoachPostsQuery = z.infer<typeof listCoachPostsSchema>;

export const coachPostViewSchema = z.object({
  id: z.uuid(),
  coachId: z.uuid(),
  kind: postKindSchema,
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  validUntil: z.iso.date().nullable(),
  pinned: z.boolean(),
  publishedAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  /** Скрыта администратором: публично не видна, тренер видит причину. */
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
});
export type CoachPostView = z.infer<typeof coachPostViewSchema>;

// ---------------------------------------------------------------- фото и видео

/** Видео — ссылкой на YouTube, как у клуба; обложку сервер хранит у себя. */
export const addCoachVideoSchema = addClubVideoSchema;
export type AddCoachVideoInput = z.infer<typeof addCoachVideoSchema>;

export const updateCoachMediaSchema = updateClubMediaSchema;
export type UpdateCoachMediaInput = z.infer<typeof updateCoachMediaSchema>;

export const reorderCoachMediaSchema = reorderClubMediaSchema;
export type ReorderCoachMediaInput = z.infer<typeof reorderCoachMediaSchema>;

export const coachMediaViewSchema = z.object({
  id: z.uuid(),
  coachId: z.uuid(),
  kind: mediaKindSchema,
  /** Фото — сама картинка, видео — его обложка, тоже наша. */
  imageUrl: z.string(),
  youtubeId: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  caption: z.string().nullable(),
  createdAt: z.iso.datetime(),
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
});
export type CoachMediaView = z.infer<typeof coachMediaViewSchema>;

// ---------------------------------------------------------------- модерация

/** Лента свежего контента тренеров для администратора — `GET /admin/coach-content`. */
export const coachContentFeedSchema = pageQuerySchema;

export const coachContentItemSchema = z.object({
  kind: z.enum(['POST', 'MEDIA']),
  id: z.uuid(),
  coach: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }),
  createdAt: z.iso.datetime(),
  title: z.string().nullable(),
  excerpt: z.string().nullable(),
  imageUrl: z.string().nullable(),
  youtubeId: z.string().nullable(),
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
});
export type CoachContentItem = z.infer<typeof coachContentItemSchema>;

/** Скрыть запись или медиа тренера — причину видит тренер. */
export const hideCoachContentSchema = hideClubContentSchema;
export type HideCoachContentInput = z.infer<typeof hideCoachContentSchema>;
