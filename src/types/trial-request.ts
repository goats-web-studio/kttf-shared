import { z } from 'zod';

import { trafficSourceSchema } from './club-page.js';
import { pageQuerySchema } from './pagination.js';

/**
 * Заявка на пробную тренировку с сайта — T3 (ADR-059, `docs/11` 3.3.3).
 *
 * «Записаться» по-прежнему открывает мессенджер; заявка — второй путь, для
 * тех, кто не хочет писать сам. Отправляет только вошедший: имя и телефон
 * берутся из аккаунта, контакты посторонних KTTF не хранит. Адресат — тот,
 * кто записывает на тренировку (`trainingBookingTarget`): тренер или клуб.
 */

export const TRIAL_FOR = ['SELF', 'CHILD'] as const;
export const trialForSchema = z.enum(TRIAL_FOR);
export type TrialFor = z.infer<typeof trialForSchema>;

/** `CANCELLED` — отозвал сам отправитель, пока заявка новая. */
export const TRIAL_STATUSES = ['NEW', 'ACCEPTED', 'DECLINED', 'CANCELLED'] as const;
export const trialStatusSchema = z.enum(TRIAL_STATUSES);
export type TrialStatus = z.infer<typeof trialStatusSchema>;

/** Сколько заявок человек отправляет за сутки: защита адресатов от спама. */
export const TRIAL_REQUESTS_PER_DAY = 5;
export const TRIAL_CHILD_AGE_MIN = 3;
export const TRIAL_CHILD_AGE_MAX = 17;

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Заявка — `POST /trainings/:id/trial-requests`. Возраст — только у заявки
 * за ребёнка и у неё обязателен. Одна открытая (`NEW`) заявка человека на
 * тренировку: повтор — отказ `TRIAL_REQUEST_EXISTS`.
 */
export const createTrialRequestSchema = z
  .object({
    forWhom: trialForSchema,
    childAge: z.number().int().min(TRIAL_CHILD_AGE_MIN).max(TRIAL_CHILD_AGE_MAX).optional(),
    /** Когда удобно: «будни после 18:00». */
    preferredTime: text(200).optional(),
    comment: text(500).optional(),
    source: trafficSourceSchema,
  })
  .superRefine((value, ctx) => {
    if (value.forWhom === 'CHILD' && value.childAge === undefined) {
      ctx.addIssue({ code: 'custom', path: ['childAge'], message: 'Укажите возраст ребёнка' });
    }
    if (value.forWhom === 'SELF' && value.childAge !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['childAge'], message: 'Возраст — только за ребёнка' });
    }
  });
export type CreateTrialRequestInput = z.infer<typeof createTrialRequestSchema>;

/** Ответ адресата — `POST /trial-requests/:id/answer`, только на новую. */
export const answerTrialRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED']),
  /** «Ждём в субботу в 10:00, возьмите сменную обувь». */
  reply: text(500).optional(),
});
export type AnswerTrialRequestInput = z.infer<typeof answerTrialRequestSchema>;

/** Списки заявок — свои, тренера, клуба; новые первыми. */
export const listTrialRequestsSchema = pageQuerySchema.extend({
  status: trialStatusSchema.optional(),
});
export type ListTrialRequestsQuery = z.infer<typeof listTrialRequestsSchema>;

/**
 * Кому ушла заявка — снимок на момент отправки: тренировка потом может
 * сменить того, кто записывает. Контакты — публичные контакты страницы,
 * чтобы после ответа отправитель мог написать сам.
 */
export const trialTargetSchema = z.object({
  kind: z.enum(['COACH', 'CLUB']),
  id: z.uuid(),
  name: z.string(),
  /** Страница тренера; у клуба — `null`, его адрес — `/clubs/:id`. */
  slug: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
});
export type TrialTarget = z.infer<typeof trialTargetSchema>;

/** Заявка глазами отправителя — `GET /me/trial-requests`. */
export const trialRequestViewSchema = z.object({
  id: z.uuid(),
  status: trialStatusSchema,
  training: z.object({ id: z.uuid(), title: z.string() }),
  target: trialTargetSchema,
  forWhom: trialForSchema,
  childAge: z.number().int().nullable(),
  preferredTime: z.string().nullable(),
  comment: z.string().nullable(),
  reply: z.string().nullable(),
  createdAt: z.iso.datetime(),
  answeredAt: z.iso.datetime().nullable(),
});
export type TrialRequestView = z.infer<typeof trialRequestViewSchema>;

/**
 * Заявка глазами адресата — `GET /coaches/:id/trial-requests`,
 * `GET /clubs/:id/trial-requests`. Плюс отправитель: имя из профиля игрока
 * (без профиля — логин) и телефон аккаунта, о чём сказано в форме.
 */
export const incomingTrialRequestViewSchema = trialRequestViewSchema.extend({
  requester: z.object({
    name: z.string(),
    phone: z.string(),
    /** Профиль игрока — ссылкой, если есть. */
    playerId: z.uuid().nullable(),
  }),
  source: trafficSourceSchema,
});
export type IncomingTrialRequestView = z.infer<typeof incomingTrialRequestViewSchema>;

/** Новых заявок у адресата — для метки на вкладке кабинета. */
export const trialRequestsCountSchema = z.object({ new: z.number().int().nonnegative() });
export type TrialRequestsCount = z.infer<typeof trialRequestsCountSchema>;
