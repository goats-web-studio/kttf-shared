import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';
import { cityRefSchema } from './place.js';

/**
 * Дуэли и спарринги — ADR-065, `docs/13-duels-concept.md`.
 *
 * Дуэль — один матч 1×1 на рейтинг. Спарринг — игра-тренировка на время,
 * по желанию «на рейтинг»: тогда в конце вносят счёт одного матча, как у
 * дуэли. Предложение — вызов конкретному игроку или публикация «ищу
 * соперника»; на публикацию откликаются, автор выбирает одного.
 *
 * Место — клуб KTTF из справочника или свой зал с названием и адресом.
 * Время — до трёх вариантов «дата, с — до»; откликнувшийся выбирает один
 * или предлагает своё.
 *
 * Счёт вносит один участник, второй подтверждает за 48 часов или
 * оспаривает; спор решает администратор KTTF. Рейтинг меняется только после
 * подтверждения, с половинным весом турнирной встречи и ограничением частоты
 * (`@kttf/shared/rating`, `duelRatingBlock`).
 */

// ---------------------------------------------------------------- перечисления

export const DUEL_KINDS = ['DUEL', 'SPARRING'] as const;
export const duelKindSchema = z.enum(DUEL_KINDS);
export type DuelKind = z.infer<typeof duelKindSchema>;

/**
 * Состояние предложения.
 *
 * - `OPEN` — опубликовано, ждёт откликов;
 * - `CHALLENGE` — вызов конкретному игроку, ждёт его ответа;
 * - `SCHEDULED` — соперник и время согласованы;
 * - `REPORTED` — счёт внесён, ждёт подтверждения второго (48 ч);
 * - `DISPUTED` — второй не согласен, решает администратор;
 * - `COMPLETED` — сыграно; рейтинговая — с подтверждённым счётом;
 * - `UNCONFIRMED` — счёт не подтвердили за 48 ч: сыграно, рейтинг не менялся;
 * - `DECLINED` — вызванный отказался;
 * - `CANCELLED` — отменил участник;
 * - `EXPIRED` — прошли все предложенные варианты времени, а соперника нет.
 *
 * Нерейтинговый спарринг после `SCHEDULED` дальше не идёт: счёта у него нет,
 * прошедший виден по времени.
 */
export const DUEL_STATUSES = [
  'OPEN',
  'CHALLENGE',
  'SCHEDULED',
  'REPORTED',
  'DISPUTED',
  'COMPLETED',
  'UNCONFIRMED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
] as const;
export const duelStatusSchema = z.enum(DUEL_STATUSES);
export type DuelStatus = z.infer<typeof duelStatusSchema>;

/** Ещё не решено: соперник ищется или игра впереди. */
export const DUEL_ACTIVE_STATUSES: readonly DuelStatus[] = [
  'OPEN',
  'CHALLENGE',
  'SCHEDULED',
  'REPORTED',
  'DISPUTED',
];

/** Формат матча — до скольких побед: 2, 3 или 4 (из 3, 5, 7 партий). */
export const DUEL_BEST_OF = [3, 5, 7] as const;
export const duelBestOfSchema = z.union([z.literal(3), z.literal(5), z.literal(7)]);
export type DuelBestOf = z.infer<typeof duelBestOfSchema>;

/** Партий нужно выиграть для победы. */
export function setsToWin(bestOf: DuelBestOf): number {
  return (bestOf + 1) / 2;
}

export const DUEL_RESPONSE_STATUSES = ['NEW', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'] as const;
export const duelResponseStatusSchema = z.enum(DUEL_RESPONSE_STATUSES);
export type DuelResponseStatus = z.infer<typeof duelResponseStatusSchema>;

/**
 * Пометки для администратора — чем рейтинговая дуэль подозрительна:
 *
 * - `PAIR_FREQUENT` — у пары 3+ рейтинговые дуэли за 30 дней;
 * - `ONE_SIDED` — у пары 3+ рейтинговые дуэли за 30 дней, и все выиграл один;
 * - `PROVISIONAL` — кто-то из двоих провизорный (меньше 20 встреч): его K
 *   вдвое выше, накрутка через него выгоднее;
 * - `BIG_GAIN` — победитель набрал на дуэлях 30+ очков за 30 дней.
 *
 * Пометка — повод посмотреть, а не наказание: блокировок автоматом нет
 * (бриф, запрет №7).
 */
export const DUEL_FLAGS = ['PAIR_FREQUENT', 'ONE_SIDED', 'PROVISIONAL', 'BIG_GAIN'] as const;
export const duelFlagSchema = z.enum(DUEL_FLAGS);
export type DuelFlag = z.infer<typeof duelFlagSchema>;

// ---------------------------------------------------------------- пределы

/** Вариантов времени в предложении. */
export const DUEL_SLOTS_MAX = 3;
/** Вариант времени — не длиннее (минут). */
export const DUEL_SLOT_MAX_MINUTES = 6 * 60;
/** Вариант времени — не короче (минут). */
export const DUEL_SLOT_MIN_MINUTES = 30;
/** Насколько вперёд можно предлагать время (дней). */
export const DUEL_HORIZON_DAYS = 60;
/** Открытых публикаций у игрока одновременно. */
export const DUEL_OPEN_MAX = 3;
/** Вызовов конкретным игрокам за сутки. */
export const DUEL_CHALLENGES_PER_DAY = 10;
/** Откликов за сутки. */
export const DUEL_RESPONSES_PER_DAY = 20;
/** Пороги пометок `PAIR_FREQUENT` / `ONE_SIDED` / `BIG_GAIN`. */
export const DUEL_FLAG_WINDOW_DAYS = 30;
export const DUEL_FLAG_PAIR_COUNT = 3;
export const DUEL_FLAG_BIG_GAIN = 30;

const text = (max: number) => z.string().trim().min(1).max(max);

// ---------------------------------------------------------------- ввод

/** Вариант времени: окно, в которое двое готовы встретиться. */
export const duelSlotInputSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .superRefine((value, ctx) => {
    const minutes = (Date.parse(value.endsAt) - Date.parse(value.startsAt)) / 60_000;
    if (minutes < DUEL_SLOT_MIN_MINUTES || minutes > DUEL_SLOT_MAX_MINUTES) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Время — от 30 минут до 6 часов',
      });
    }
  });
export type DuelSlotInput = z.infer<typeof duelSlotInputSchema>;

/**
 * Место: клуб KTTF или свой зал. Город у своего зала обязателен — по нему
 * доска фильтрует; у клуба город — клуба.
 */
function refineVenue(
  value: {
    readonly clubId?: string | undefined;
    readonly venueName?: string | undefined;
    readonly venueAddress?: string | undefined;
    readonly cityId?: string | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const club = value.clubId !== undefined;
  const venue = value.venueName !== undefined || value.venueAddress !== undefined;

  if (club && venue) {
    ctx.addIssue({ code: 'custom', path: ['venueName'], message: 'Клуб KTTF или свой зал' });
  }
  if (!club && (value.venueName === undefined || value.venueAddress === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['venueAddress'],
      message: 'Выберите клуб или укажите зал с адресом',
    });
  }
  if (!club && value.cityId === undefined) {
    ctx.addIssue({ code: 'custom', path: ['cityId'], message: 'Укажите город зала' });
  }
}

/**
 * Новое предложение — `POST /duels`.
 *
 * С `opponentId` — вызов этому игроку (`CHALLENGE`), без — публикация
 * (`OPEN`). Дуэль всегда рейтинговая; спарринг — по `rated`. Формат
 * `bestOf` — у рейтинговых, у нерейтингового спарринга его нет.
 * Сервер проверяет ещё: время в будущем и не дальше 60 дней, вызванный
 * — с аккаунтом и не сам автор, пределы публикаций и вызовов.
 */
export const createDuelSchema = z
  .object({
    kind: duelKindSchema,
    rated: z.boolean(),
    bestOf: duelBestOfSchema.optional(),
    opponentId: z.uuid().optional(),
    clubId: z.uuid().optional(),
    venueName: text(100).optional(),
    venueAddress: text(200).optional(),
    cityId: z.uuid().optional(),
    slots: z.array(duelSlotInputSchema).min(1).max(DUEL_SLOTS_MAX),
    /** «Играю атакующе, хочу потренировать приём подачи». */
    note: text(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'DUEL' && !value.rated) {
      ctx.addIssue({ code: 'custom', path: ['rated'], message: 'Дуэль всегда на рейтинг' });
    }
    if (value.rated && value.bestOf === undefined) {
      ctx.addIssue({ code: 'custom', path: ['bestOf'], message: 'Выберите формат матча' });
    }
    if (!value.rated && value.bestOf !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['bestOf'], message: 'Формат — только на рейтинг' });
    }
    refineVenue(value, ctx);
  });
export type CreateDuelInput = z.infer<typeof createDuelSchema>;

/**
 * Отклик — `POST /duels/:id/responses`: выбрать вариант автора (`slotId`)
 * или предложить своё время (`proposed`), ровно одно. Вызванный игрок
 * отвечает так же. Один открытый отклик игрока на предложение.
 *
 * Вызванный, выбравший вариант автора, — согласие: дуэль назначена сразу.
 * Остальное — автор подтверждает отклик сам.
 */
export const respondDuelSchema = z
  .object({
    slotId: z.uuid().optional(),
    proposed: duelSlotInputSchema.optional(),
    message: text(500).optional(),
  })
  .refine((value) => (value.slotId === undefined) !== (value.proposed === undefined), {
    path: ['slotId'],
    message: 'Выберите вариант времени или предложите своё',
  });
export type RespondDuelInput = z.infer<typeof respondDuelSchema>;

/** Отказ вызванного или отмена участником — `POST /duels/:id/decline|cancel`. */
export const duelReasonSchema = z.object({ reason: text(300).optional() });
export type DuelReasonInput = z.infer<typeof duelReasonSchema>;

/**
 * Счёт — `POST /duels/:id/result`, участник, не раньше начала согласованного
 * времени. Победитель — один из двоих, у него `setsToWin(bestOf)` партий,
 * у проигравшего меньше. Проверка формата — на сервере: формат в дуэли.
 */
export const reportDuelSchema = z.object({
  winnerId: z.uuid(),
  winnerSets: z.number().int().min(2).max(4),
  loserSets: z.number().int().min(0).max(3),
});
export type ReportDuelInput = z.infer<typeof reportDuelSchema>;

/** Несогласие со счётом — `POST /duels/:id/dispute`, второй участник. */
export const disputeDuelSchema = z.object({ comment: text(500) });
export type DisputeDuelInput = z.infer<typeof disputeDuelSchema>;

/**
 * Решение спора администратором — `POST /admin/duels/:id/resolve`: счёт
 * (`result`) — дуэль обсчитывается; без счёта — сыгранной не считается
 * (`CANCELLED`), рейтинг не меняется.
 */
export const resolveDuelSchema = z.object({
  result: reportDuelSchema.optional(),
  comment: text(500),
});
export type ResolveDuelInput = z.infer<typeof resolveDuelSchema>;

/**
 * Отмена начисления — `POST /admin/duels/:id/annul`: обратные события в
 * журнал (`MANUAL_ADJUST`) обоим, дуэль помечается аннулированной.
 */
export const annulDuelSchema = z.object({ reason: text(300) });
export type AnnulDuelInput = z.infer<typeof annulDuelSchema>;

// ---------------------------------------------------------------- списки

/**
 * Доска — `GET /duels`: открытые публикации с ещё не прошедшим временем
 * (`scope=open`, по умолчанию, ближайшие первыми) или недавно сыгранные
 * рейтинговые (`scope=recent`, свежие первыми).
 */
export const listDuelsSchema = pageQuerySchema.extend({
  scope: z.enum(['open', 'recent']).default('open'),
  cityId: z.uuid().optional(),
  clubId: z.uuid().optional(),
  kind: duelKindSchema.optional(),
  rated: z.stringbool().optional(),
});
export type ListDuelsQuery = z.infer<typeof listDuelsSchema>;

/**
 * Мои — `GET /me/duels`: `active` — где я автор, вызванный, соперник или
 * откликнулся, и ещё не решено (ближайшие первыми); `history` — остальное
 * (свежие первыми).
 */
export const listMyDuelsSchema = pageQuerySchema.extend({
  scope: z.enum(['active', 'history']).default('active'),
});
export type ListMyDuelsQuery = z.infer<typeof listMyDuelsSchema>;

/** Очередь администратора — `GET /admin/duels`: рейтинговые, свежие первыми. */
export const listAdminDuelsSchema = pageQuerySchema.extend({
  status: duelStatusSchema.optional(),
  flagged: z.stringbool().optional(),
  playerId: z.uuid().optional(),
});
export type ListAdminDuelsQuery = z.infer<typeof listAdminDuelsSchema>;

// ---------------------------------------------------------------- вид

/** Игрок дуэли: имя, рейтинг сейчас, фото. */
export const duelPlayerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  rating: z.string(),
  isProvisional: z.boolean(),
  city: cityRefSchema,
});
export type DuelPlayer = z.infer<typeof duelPlayerSchema>;

export const duelSlotSchema = z.object({
  id: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});
export type DuelSlotView = z.infer<typeof duelSlotSchema>;

/** Место: клуб KTTF (`club`) или свой зал (`venueName`, `venueAddress`). */
export const duelVenueSchema = z.object({
  club: z.object({ id: z.uuid(), name: z.string(), address: z.string().nullable() }).nullable(),
  venueName: z.string().nullable(),
  venueAddress: z.string().nullable(),
  city: cityRefSchema,
});
export type DuelVenue = z.infer<typeof duelVenueSchema>;

export const duelResultSchema = z.object({
  winnerId: z.uuid(),
  winnerSets: z.number().int(),
  loserSets: z.number().int(),
  reportedById: z.uuid(),
  reportedAt: z.iso.datetime(),
  /** Срок подтверждения: `reportedAt` + 48 ч. */
  confirmBy: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
  disputeComment: z.string().nullable(),
  /** Решение администратора по спору. */
  resolutionComment: z.string().nullable(),
});
export type DuelResult = z.infer<typeof duelResultSchema>;

/** Изменение рейтинга участника по дуэли. */
export const duelRatingChangeSchema = z.object({
  playerId: z.uuid(),
  ratingBefore: z.string(),
  delta: z.string(),
  ratingAfter: z.string(),
});
export type DuelRatingChange = z.infer<typeof duelRatingChangeSchema>;

/** Отклик: виден автору целиком, откликнувшемуся — свой. */
export const duelResponseViewSchema = z.object({
  id: z.uuid(),
  player: duelPlayerSchema,
  /** Выбранный вариант автора или `null` — предложено своё время. */
  slotId: z.uuid().nullable(),
  proposedStartsAt: z.iso.datetime().nullable(),
  proposedEndsAt: z.iso.datetime().nullable(),
  message: z.string().nullable(),
  status: duelResponseStatusSchema,
  createdAt: z.iso.datetime(),
});
export type DuelResponseView = z.infer<typeof duelResponseViewSchema>;

/** Строка доски и списков. */
export const duelItemSchema = z.object({
  id: z.uuid(),
  kind: duelKindSchema,
  rated: z.boolean(),
  bestOf: duelBestOfSchema.nullable(),
  status: duelStatusSchema,
  author: duelPlayerSchema,
  /** Вызванный или выбранный соперник; у публикации без выбора — `null`. */
  opponent: duelPlayerSchema.nullable(),
  venue: duelVenueSchema,
  /** Предложенные варианты, по времени. */
  slots: z.array(duelSlotSchema),
  /** Согласованное время — у назначенной и дальше. */
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
  /** Новых откликов — видно только автору; остальным `null`. */
  responsesNew: z.number().int().nonnegative().nullable(),
  result: duelResultSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type DuelItemView = z.infer<typeof duelItemSchema>;

/**
 * Страница предложения — `GET /duels/:id`. `responses` — автору все, другим
 * — только свой. `can` — какие действия сейчас доступны смотрящему: кнопки
 * не угадывают правила сами.
 */
export const duelViewSchema = duelItemSchema.extend({
  responses: z.array(duelResponseViewSchema),
  ratingChanges: z.array(duelRatingChangeSchema),
  /** Начисление отменено администратором. */
  annulledAt: z.iso.datetime().nullable(),
  annulReason: z.string().nullable(),
  /** Рейтинговая, но счёт обсчитан без рейтинга (предел частоты). */
  ratingSkipped: z.enum(['PAIR', 'PLAYER']).nullable(),
  can: z.object({
    respond: z.boolean(),
    withdraw: z.boolean(),
    decline: z.boolean(),
    cancel: z.boolean(),
    report: z.boolean(),
    confirm: z.boolean(),
    dispute: z.boolean(),
  }),
});
export type DuelView = z.infer<typeof duelViewSchema>;

/** Строка очереди администратора. */
export const adminDuelItemSchema = duelItemSchema.extend({
  flags: z.array(duelFlagSchema),
  ratingChanges: z.array(duelRatingChangeSchema),
  annulledAt: z.iso.datetime().nullable(),
  /** Рейтинговых дуэлей этой пары за 30 дней, эта тоже. */
  pairCount30d: z.number().int().nonnegative(),
});
export type AdminDuelItemView = z.infer<typeof adminDuelItemSchema>;
