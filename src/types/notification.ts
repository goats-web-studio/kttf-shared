import { z } from 'zod';

import { forumRuleSchema } from './forum.js';
import { pageQuerySchema } from './pagination.js';

/**
 * Уведомления внутри сайта — ТЗ 10, первая часть (ADR-059, T3). Колокольчик
 * в шапке и страница уведомлений; доставка наружу (Web Push) — следующим
 * шагом. Тип — что случилось, `data` — всё, что нужно для строки и ссылки,
 * снимком на момент события: заявку могут удалить, клуб — переименовать.
 *
 * Новые типы добавляются сюда же; клиент, не знающий типа, строку не
 * показывает (`notificationViewSchema.safeParse`).
 */

/** Как часто клиент спрашивает число непрочитанных. */
export const NOTIFICATIONS_POLL_MS = 60_000;
/** Старше — удаляются: уведомление не архив. */
export const NOTIFICATIONS_KEEP_DAYS = 90;

/** Адресат заявки — тренер своей страницей или клуб; нужен для ссылки в кабинет. */
const trialInbox = z.object({
  kind: z.enum(['COACH', 'CLUB']),
  id: z.uuid(),
  name: z.string(),
});

const base = {
  id: z.uuid(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
};

export const notificationViewSchema = z.discriminatedUnion('type', [
  /** Новая заявка на пробную — тренеру или OWNER и ORGANIZER клуба. */
  z.object({
    ...base,
    type: z.literal('TRIAL_REQUEST_NEW'),
    data: z.object({
      trialRequestId: z.uuid(),
      trainingTitle: z.string(),
      requesterName: z.string(),
      inbox: trialInbox,
    }),
  }),
  /** Отправитель отозвал заявку. */
  z.object({
    ...base,
    type: z.literal('TRIAL_REQUEST_CANCELLED'),
    data: z.object({
      trialRequestId: z.uuid(),
      trainingTitle: z.string(),
      requesterName: z.string(),
      inbox: trialInbox,
    }),
  }),
  /** Ответ на заявку — отправителю. */
  z.object({
    ...base,
    type: z.literal('TRIAL_REQUEST_ANSWERED'),
    data: z.object({
      trialRequestId: z.uuid(),
      trainingTitle: z.string(),
      status: z.enum(['ACCEPTED', 'DECLINED']),
      /** Кто ответил: имя тренера или название клуба. */
      targetName: z.string(),
    }),
  }),
  /** Ваше сообщение процитировали — автору цитаты. */
  z.object({
    ...base,
    type: z.literal('FORUM_REPLY'),
    data: z.object({
      topicId: z.uuid(),
      topicTitle: z.string(),
      postId: z.uuid(),
      number: z.number().int().positive(),
      authorName: z.string(),
    }),
  }),
  /**
   * Новые сообщения в теме, на которую подписан. Одно непрочитанное на тему:
   * следующие увеличивают `count`, ссылка ведёт к первому непрочитанному.
   */
  z.object({
    ...base,
    type: z.literal('FORUM_TOPIC_UPDATE'),
    data: z.object({
      topicId: z.uuid(),
      topicTitle: z.string(),
      postId: z.uuid(),
      number: z.number().int().positive(),
      authorName: z.string(),
      count: z.number().int().positive(),
    }),
  }),
  /** Модератор скрыл ваше сообщение или тему — с причиной. */
  z.object({
    ...base,
    type: z.literal('FORUM_POST_HIDDEN'),
    data: z.object({
      topicId: z.uuid(),
      topicTitle: z.string(),
      /** `null` — скрыта тема целиком. */
      postId: z.uuid().nullable(),
      number: z.number().int().positive().nullable(),
      reason: z.string(),
    }),
  }),
  /**
   * Предупреждение модератора без скрытия (ADR-067): какое правило и где.
   * Сообщения может не быть — предупреждение за поведение в целом.
   */
  z.object({
    ...base,
    type: z.literal('FORUM_WARNING'),
    data: z.object({
      rule: forumRuleSchema,
      comment: z.string().nullable(),
      topicId: z.uuid().nullable(),
      topicTitle: z.string().nullable(),
      postId: z.uuid().nullable(),
      number: z.number().int().positive().nullable(),
    }),
  }),
]);
export type NotificationView = z.infer<typeof notificationViewSchema>;
export type NotificationType = NotificationView['type'];

/** `GET /notifications` — новые первыми. */
export const listNotificationsSchema = pageQuerySchema;
export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;

/** `GET /notifications/unread` — для колокольчика. */
export const notificationsUnreadSchema = z.object({ unread: z.number().int().nonnegative() });
export type NotificationsUnread = z.infer<typeof notificationsUnreadSchema>;

/** `POST /notifications/read` — отметить прочитанными эти; без `ids` — все. */
export const readNotificationsSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100).optional(),
});
export type ReadNotificationsInput = z.infer<typeof readNotificationsSchema>;
