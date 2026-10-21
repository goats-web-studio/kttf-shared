import { z } from 'zod';

import { TELEGRAM_PATTERN, contactKindSchema } from './club.js';
import { PRICE_KZT_MAX, priceUnitSchema, trafficSourceSchema } from './club-page.js';
import { pageQuerySchema } from './pagination.js';
import { cityRefSchema } from './place.js';

/**
 * Раздел «Тренировки» — ADR-059, `docs/11`, этап T1: страница тренера по
 * заявке, тренировки, квалификация, заслуги, статистика обращений.
 *
 * Страница строится на профиле игрока: имя, фото, рейтинг и игровая
 * статистика берутся оттуда, руками тренер заполняет только то, чего
 * продукт знать не может. Заявка — статус самой страницы, а не отдельная
 * таблица: администратор видит ровно то, что будет опубликовано.
 */

// ---------------------------------------------------------------- перечни

/**
 * Заявка: черновик → на проверке → опубликована или отклонена с причиной.
 * Отклонённую тренер правит и отправляет снова. Правки после одобрения —
 * постмодерация: страница остаётся опубликованной.
 */
export const COACH_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'] as const;
export const coachStatusSchema = z.enum(COACH_STATUSES);
export type CoachStatus = z.infer<typeof coachStatusSchema>;

/** Где тренирует: в клубе, на выезде, онлайн. Тренер без зала — нормальный случай. */
export const TRAINING_PLACES = ['CLUB', 'VISIT', 'ONLINE'] as const;
export const trainingPlaceSchema = z.enum(TRAINING_PLACES);
export type TrainingPlace = z.infer<typeof trainingPlaceSchema>;

/** Языки занятий. Казахский первым: продукт для Казахстана. */
export const COACH_LANGUAGES = ['KK', 'RU', 'EN'] as const;
export const coachLanguageSchema = z.enum(COACH_LANGUAGES);
export type CoachLanguage = z.infer<typeof coachLanguageSchema>;

export const TRAINING_KINDS = [
  'INDIVIDUAL',
  'GROUP',
  'SPLIT',
  'KIDS_GROUP',
  'VIDEO_REVIEW',
  'CAMP',
  'SPARRING',
  'OTHER',
] as const;
export const trainingKindSchema = z.enum(TRAINING_KINDS);
export type TrainingKind = z.infer<typeof trainingKindSchema>;

export const TRAINING_AUDIENCES = [
  'KIDS',
  'TEENS',
  'ADULT_BEGINNERS',
  'AMATEURS',
  'ATHLETES',
] as const;
export const trainingAudienceSchema = z.enum(TRAINING_AUDIENCES);
export type TrainingAudience = z.infer<typeof trainingAudienceSchema>;

/** Аудитории, к которым относится фильтр «возраст ребёнка». */
export const CHILD_AUDIENCES = ['KIDS', 'TEENS'] as const satisfies readonly TrainingAudience[];

/** Спортивный разряд или звание по возрастанию: юношеские, взрослые, КМС, МС, МСМК, ЗМС. */
export const SPORTS_RANKS = [
  'YOUTH_3',
  'YOUTH_2',
  'YOUTH_1',
  'RANK_3',
  'RANK_2',
  'RANK_1',
  'KMS',
  'MS',
  'MSMK',
  'ZMS',
] as const;
export const sportsRankSchema = z.enum(SPORTS_RANKS);
export type SportsRank = z.infer<typeof sportsRankSchema>;

/** Тренерская категория. `NONE` — «без категории», сказанное явно. */
export const COACH_CATEGORIES = ['HIGHEST', 'FIRST', 'SECOND', 'NONE'] as const;
export const coachCategorySchema = z.enum(COACH_CATEGORIES);
export type CoachCategory = z.infer<typeof coachCategorySchema>;

export const CREDENTIAL_KINDS = ['DIPLOMA', 'CERTIFICATE', 'COURSE', 'LICENSE', 'OTHER'] as const;
export const credentialKindSchema = z.enum(CREDENTIAL_KINDS);
export type CredentialKind = z.infer<typeof credentialKindSchema>;

/** Заслуга игроком («чемпион РК 2012 в паре») или тренером («ученик — призёр U15»). */
export const ACHIEVEMENT_ROLES = ['AS_PLAYER', 'AS_COACH'] as const;
export const achievementRoleSchema = z.enum(ACHIEVEMENT_ROLES);
export type AchievementRole = z.infer<typeof achievementRoleSchema>;

// ---------------------------------------------------------------- тариф

/**
 * Тариф страницы тренера — заложен и выключен, как у клуба (ADR-055, ADR-059).
 * Пока `COACH_PLANS_ENABLED` ложен, каждому действует защитный предел,
 * равный будущему Pro.
 */
export const COACH_PLANS = ['FREE', 'PRO'] as const;
export const coachPlanSchema = z.enum(COACH_PLANS);
export type CoachPlan = z.infer<typeof coachPlanSchema>;

export const COACH_PLANS_ENABLED = false;

export interface CoachPlanLimits {
  readonly trainings: number;
  /** Фото и видео в галерее, записей в месяц (`null` — без предела), закреплённых — как у клуба. */
  readonly photos: number;
  readonly videos: number;
  readonly postsPerMonth: number | null;
  readonly pinnedPosts: number;
  readonly credentials: number;
  readonly achievements: number;
  /** Глубина статистики в днях. */
  readonly statsDays: number;
}

/** Черновик лимитов. Числа обсуждаются с владельцем до включения тарифов. */
export const COACH_PLAN_LIMITS: Readonly<Record<CoachPlan, CoachPlanLimits>> = {
  FREE: {
    trainings: 5,
    credentials: 5,
    achievements: 10,
    statsDays: 30,
    photos: 12,
    videos: 2,
    postsPerMonth: 4,
    pinnedPosts: 0,
  },
  PRO: {
    trainings: 20,
    credentials: 20,
    achievements: 40,
    statsDays: 365,
    photos: 100,
    videos: 20,
    postsPerMonth: null,
    pinnedPosts: 1,
  },
};

/** Лимиты, которые действуют сейчас: план тренера или, пока тарифы выключены, защитный предел. */
export function coachLimits(
  plan: CoachPlan,
  enabled: boolean = COACH_PLANS_ENABLED,
): CoachPlanLimits {
  return enabled ? COACH_PLAN_LIMITS[plan] : COACH_PLAN_LIMITS.PRO;
}

/** Схемы списков держат защитный предел: больше него сервер не примет ни при каком плане. */
const MAX = COACH_PLAN_LIMITS.PRO;

// ---------------------------------------------------------------- картинки и сканы

/**
 * Фото и обложка тренера — загрузкой `POST /files/coaches/:id`, по образцу
 * картинок клуба (ADR-055): WebP трёх ширин `CLUB_IMAGE_WIDTHS`, варианты
 * рядом с суффиксом ширины. Вариант ширины — та же `clubImageVariant`
 * по смыслу, но со своей папкой: `coachImageVariant`.
 */
export const COACH_IMAGE_PATH_PATTERN = /^\/api\/v1\/files\/coaches\/[0-9a-f-]{36}\.webp$/;

export const COACH_IMAGE_KINDS = ['photo', 'cover'] as const;
export const coachImageKindSchema = z.enum(COACH_IMAGE_KINDS);
export type CoachImageKind = z.infer<typeof coachImageKindSchema>;

/** Путь варианта нужной ширины; для чужого пути — он сам. */
export function coachImageVariant(url: string, width: 480 | 960 | 1600): string {
  if (!COACH_IMAGE_PATH_PATTERN.test(url) || width === 1600) return url;

  return url.replace(/\.webp$/, `-${String(width)}.webp`);
}

/**
 * Скан документа — `POST /files/coach-docs/:id`. Только фото (JPEG, PNG,
 * WebP): сервер пережимает его в один WebP и снимает метаданные. PDF не
 * принимается — первую страницу человек снимает телефоном.
 *
 * Скан — персональные данные (ADR-059, риски): папка `coach-docs` общей
 * выдачей файлов не отдаётся. Открывается он маршрутом документа —
 * `coachCredentialFilePath` — и только владельцу страницы и администратору,
 * пока тренер не отметил «показывать скан».
 */
export const COACH_DOC_PATH_PATTERN = /^\/api\/v1\/files\/coach-docs\/[0-9a-f-]{36}\.webp$/;

/** Маршрут выдачи скана документа. */
export function coachCredentialFilePath(coachId: string, credentialId: string): string {
  return `/api/v1/coaches/${coachId}/credentials/${credentialId}/file`;
}

// ---------------------------------------------------------------- страница

/** Год, с которого человек тренирует: не раньше 1950-го и не в будущем. */
const currentYear = new Date().getFullYear();
const year = z.number().int().min(1950).max(currentYear);

const text = (max: number) => z.string().trim().min(1).max(max);

/** Список без повторов — перечни меток. */
function uniqueList<T extends z.ZodType>(item: T, max: number) {
  return z
    .array(item)
    .max(max)
    .refine((list) => new Set(list).size === list.length, { message: 'Значение повторяется' });
}

/** «О себе» — простой текст, как записи клуба: без HTML и Markdown. */
export const COACH_ABOUT_MAX = 4000;

/**
 * Поля страницы тренера. Все необязательны: страница заводится пустой
 * и заполняется по частям. К отправке на проверку нужны город и хотя бы
 * одна тренировка — `coachMissing`.
 *
 * `null` стирает поле (ADR-043), отсутствие поля его не трогает.
 */
export const updateCoachSchema = z
  .object({
    /** Короткая строка под именем: «Детский тренер, Бостандыкский район». */
    headline: text(120).nullable(),
    about: text(COACH_ABOUT_MAX).nullable(),
    /** Своё фото тренера; без него — фото из профиля игрока. */
    photoUrl: z.string().regex(COACH_IMAGE_PATH_PATTERN).nullable(),
    coverUrl: z.string().regex(COACH_IMAGE_PATH_PATTERN).nullable(),
    coachingSince: year.nullable(),
    /** Город из справочника; при заведении страницы — город игрока. */
    cityId: z.uuid().nullable(),
    formats: uniqueList(trainingPlaceSchema, TRAINING_PLACES.length),
    /** Районы выезда строкой: «Бостандыкский, Медеуский». */
    visitAreas: text(200).nullable(),
    languages: uniqueList(coachLanguageSchema, COACH_LANGUAGES.length),
    phone: text(30).nullable(),
    whatsapp: text(30).nullable(),
    /** Имя в Telegram без `@`, как у клуба. */
    telegram: z.string().trim().regex(TELEGRAM_PATTERN).nullable(),
    instagram: text(100).nullable(),
    /** Главный способ связи — единственная кнопка `primary` на странице. */
    primaryContact: contactKindSchema.nullable(),
    sportsRank: sportsRankSchema.nullable(),
    coachCategory: coachCategorySchema.nullable(),
    /** Судейская категория строкой: «национальная», «международная (ITTF)». */
    refereeCategory: text(100).nullable(),
    /** «КазАСТ, тренер-преподаватель, 2014». */
    education: text(300).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateCoachInput = z.infer<typeof updateCoachSchema>;

// ---------------------------------------------------------------- тренировки

/** Игрок, на чьём профиле стоит страница, — для шапки и карточек. */
export const coachPlayerRefSchema = z.object({
  id: z.uuid(),
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  /** Фото из профиля игрока. Своё фото тренера — `CoachView.photoUrl`. */
  photoUrl: z.string().nullable(),
  /** Строкой, как везде (ADR-014). */
  rating: z.string(),
  isProvisional: z.boolean(),
  city: cityRefSchema,
});
export type CoachPlayerRef = z.infer<typeof coachPlayerRefSchema>;

/**
 * Тренировка — своя сущность (решение владельца от 20.10.2026): её заводит
 * тренер на своей странице или клуб на своей. Тренировка «в клубе» обязана
 * назвать место: клуб KTTF или, если зал не в KTTF, название и адрес.
 *
 * Вторая сторона подтверждает связь: тренер указал клуб — подтверждает клуб
 * (OWNER или ORGANIZER), клуб указал тренера — подтверждает тренер. До
 * подтверждения тренировка видна у автора, но без второй стороны: у клуба —
 * без тренера, у тренера — не публикуется вовсе, пока клуб не ответил.
 * Разорвать связь может любая сторона.
 */
export const TRAINING_AUTHORS = ['COACH', 'CLUB'] as const;
export const trainingAuthorSchema = z.enum(TRAINING_AUTHORS);
export type TrainingAuthor = z.infer<typeof trainingAuthorSchema>;

/**
 * Связь со второй стороной: `NONE` — второй стороны нет (выезд, онлайн,
 * зал по адресу, клубная тренировка без тренера); `PENDING` — ждёт ответа;
 * `CONFIRMED`; `DECLINED` — вторая сторона отказала или разорвала связь.
 */
export const TRAINING_LINKS = ['NONE', 'PENDING', 'CONFIRMED', 'DECLINED'] as const;
export const trainingLinkSchema = z.enum(TRAINING_LINKS);
export type TrainingLink = z.infer<typeof trainingLinkSchema>;

/**
 * Кто записывает и принимает оплату (решение владельца от 21.10.2026).
 * Группа клуба — всегда клуб. Своя тренировка тренера в клубе KTTF — по
 * выбору тренера: лично или через клуб; в остальных местах — тренер.
 */
export const TRAINING_BOOKINGS = ['COACH', 'CLUB'] as const;
export const trainingBookingSchema = z.enum(TRAINING_BOOKINGS);
export type TrainingBooking = z.infer<typeof trainingBookingSchema>;

/** Возраст ребёнка, с которого берут: от трёх лет до семнадцати. */
const kidsAge = z.number().int().min(3).max(17);

export const TRAINING_DESCRIPTION_MAX = 1000;

/** Поля тренировки, общие у тренера и клуба. */
const trainingFields = {
  /** Строка списка: сохраняет тренировку и её связь со второй стороной. */
  id: z.uuid().optional(),
  kind: trainingKindSchema,
  audiences: uniqueList(trainingAudienceSchema, TRAINING_AUDIENCES.length).min(1),
  /** «Дети с 6 лет» — только у детской или подростковой аудитории. */
  kidsFromAge: kidsAge.nullable().optional(),
  title: text(100),
  /** Расписание строкой: «пн, ср, пт 18:00–19:30». */
  schedule: text(200).nullable().optional(),
  /** Целые тенге. Без цены — «по договорённости». */
  priceKzt: z.number().int().min(0).max(PRICE_KZT_MAX).nullable().optional(),
  unit: priceUnitSchema,
  note: text(200).nullable().optional(),
  /** «Подробнее»: что будет на занятии, что взять с собой. Простой текст. */
  description: text(TRAINING_DESCRIPTION_MAX).nullable().optional(),
};

function kidsAgeForChildren(
  value: {
    readonly audiences: readonly TrainingAudience[];
    readonly kidsFromAge?: number | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const forChildren = value.audiences.some((audience) =>
    (CHILD_AUDIENCES as readonly TrainingAudience[]).includes(audience),
  );

  if (value.kidsFromAge !== undefined && value.kidsFromAge !== null && !forChildren) {
    ctx.addIssue({
      code: 'custom',
      path: ['kidsFromAge'],
      message: 'Возраст ребёнка — только у тренировки для детей или подростков',
    });
  }
}

/**
 * Место тренировки тренера. «В клубе» — ровно одно из двух: клуб KTTF
 * (`clubId`, клуб подтверждает) или зал вне KTTF — название и адрес.
 * У выезда и онлайна места нет.
 */
function placeIsNamed(
  value: {
    readonly place: TrainingPlace;
    readonly clubId?: string | null | undefined;
    readonly venueName?: string | null | undefined;
    readonly venueAddress?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const club = value.clubId !== undefined && value.clubId !== null;
  const venue = value.venueName !== undefined && value.venueName !== null;
  const address = value.venueAddress !== undefined && value.venueAddress !== null;

  if (value.place !== 'CLUB') {
    if (club || venue || address) {
      ctx.addIssue({
        code: 'custom',
        path: ['place'],
        message: 'Клуб или зал указывается только у тренировки в клубе',
      });
    }
    return;
  }

  if (club === venue) {
    ctx.addIssue({
      code: 'custom',
      path: ['clubId'],
      message: 'Тренировка в клубе: выберите клуб KTTF или впишите зал с адресом',
    });
    return;
  }

  if (venue !== address) {
    ctx.addIssue({
      code: 'custom',
      path: ['venueAddress'],
      message: 'Зал вне KTTF — с названием и адресом',
    });
  }
}

export const coachTrainingInputSchema = z
  .object({
    ...trainingFields,
    place: trainingPlaceSchema,
    /** Клуб KTTF — для места «в клубе»; клуб подтверждает. */
    clubId: z.uuid().nullable().optional(),
    /** Зал вне KTTF: название и адрес. */
    venueName: text(100).nullable().optional(),
    venueAddress: text(200).nullable().optional(),
    /** Кто записывает и принимает оплату. «Через клуб» — только в клубе KTTF. */
    booking: trainingBookingSchema.optional(),
  })
  .superRefine((value, ctx) => {
    kidsAgeForChildren(value, ctx);
    placeIsNamed(value, ctx);
    if (value.booking === 'CLUB' && (value.clubId === undefined || value.clubId === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['booking'],
        message: 'Запись через клуб — только у тренировки в клубе KTTF',
      });
    }
  });
export type CoachTrainingInput = z.infer<typeof coachTrainingInputSchema>;

/** Повтор `id` в списке — две строки об одной тренировке. */
function idsUnique(list: readonly { readonly id?: string | undefined }[]): boolean {
  const ids = list.flatMap((row) => (row.id === undefined ? [] : [row.id]));

  return new Set(ids).size === ids.length;
}

/**
 * Свои тренировки тренера целиком: порядок — порядок в массиве. Строка
 * с `id` сохраняет тренировку; связь с клубом сохраняется, если клуб не
 * сменился, иначе снова ждёт подтверждения. Клубные тренировки, где тренер
 * подтвердил участие, этим списком не правятся — их ведёт клуб.
 */
export const setCoachTrainingsSchema = z.object({
  trainings: z
    .array(coachTrainingInputSchema)
    .max(MAX.trainings)
    .refine(idsUnique, { message: 'Тренировка повторяется' }),
});
export type SetCoachTrainingsInput = z.infer<typeof setCoachTrainingsSchema>;

/** Тренировки клуба: место — сам клуб. */
export const CLUB_TRAININGS_MAX = 30;

export const clubTrainingInputSchema = z
  .object({
    ...trainingFields,
    /** Тренер со страницей (`Coach.id`); тренер подтверждает. Без тренера — тренировка клуба. */
    coachId: z.uuid().nullable().optional(),
  })
  .superRefine(kidsAgeForChildren);
export type ClubTrainingInput = z.infer<typeof clubTrainingInputSchema>;

/** Тренировки клуба целиком; смена тренера у строки — снова ждёт подтверждения. */
export const setClubTrainingsSchema = z.object({
  trainings: z
    .array(clubTrainingInputSchema)
    .max(CLUB_TRAININGS_MAX)
    .refine(idsUnique, { message: 'Тренировка повторяется' }),
});
export type SetClubTrainingsInput = z.infer<typeof setClubTrainingsSchema>;

/** Клуб в тренировке — для шапки блока и ссылки. */
export const trainingClubRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  address: z.string().nullable(),
  city: cityRefSchema,
  /** Маршрут — ссылка клуба в 2GIS, иначе поиск по адресу. */
  twoGisUrl: z.string().nullable(),
  /** Контакты — для «Записаться» прямо из списка, без захода на страницу. */
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  telegram: z.string().nullable(),
  primaryContact: contactKindSchema.nullable(),
});
export type TrainingClubRef = z.infer<typeof trainingClubRefSchema>;

/** Тренер в тренировке — для строки «тренер» и ссылки. */
export const trainingCoachRefSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  player: coachPlayerRefSchema,
  photoUrl: z.string().nullable(),
  /** Контакты — для «Записаться» прямо из списка, без захода на страницу. */
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  telegram: z.string().nullable(),
  primaryContact: contactKindSchema.nullable(),
});
export type TrainingCoachRef = z.infer<typeof trainingCoachRefSchema>;

export const trainingVenueSchema = z.object({ name: z.string(), address: z.string() });
export type TrainingVenue = z.infer<typeof trainingVenueSchema>;

/**
 * Тренировка в ответах. Публично вторая сторона видна только при
 * `CONFIRMED`: у клубной тренировки без подтверждения `coach` — `null`,
 * неподтверждённая тренировка тренера в клубе публично не отдаётся вовсе.
 * Автору и второй стороне — как есть, со статусом связи.
 */
export const trainingViewSchema = z.object({
  id: z.uuid(),
  author: trainingAuthorSchema,
  kind: trainingKindSchema,
  audiences: z.array(trainingAudienceSchema),
  kidsFromAge: z.number().int().nullable(),
  place: trainingPlaceSchema,
  club: trainingClubRefSchema.nullable(),
  venue: trainingVenueSchema.nullable(),
  coach: trainingCoachRefSchema.nullable(),
  link: trainingLinkSchema,
  /** Кто записывает: у группы клуба — `CLUB`, у своей тренировки тренера — его выбор. */
  booking: trainingBookingSchema,
  title: z.string(),
  schedule: z.string().nullable(),
  priceKzt: z.number().int().nullable(),
  unit: priceUnitSchema,
  note: z.string().nullable(),
  description: z.string().nullable(),
});
export type TrainingView = z.infer<typeof trainingViewSchema>;

/**
 * Владелец тренировки — тот, кто её завёл, и с ним связываются.
 * Группа клуба — владелец клуб, тренер в ней указан тренером. Своя
 * тренировка тренера — владелец тренер, клуб в ней — место.
 */
export type TrainingOwner =
  | { readonly kind: 'CLUB'; readonly club: TrainingClubRef }
  | { readonly kind: 'COACH'; readonly coach: TrainingCoachRef };

/** Кто завёл тренировку. `null` — владельца не видно смотрящему. */
export function trainingOwner(
  training: Pick<TrainingView, 'author' | 'club' | 'coach'>,
): TrainingOwner | null {
  if (training.author === 'CLUB') {
    return training.club === null ? null : { kind: 'CLUB', club: training.club };
  }

  return training.coach === null ? null : { kind: 'COACH', coach: training.coach };
}

/**
 * Кому писать «Записаться»: клубу у группы клуба и у тренировки тренера
 * с записью через клуб, иначе тренеру. Вторая сторона получает нажатие
 * отдельной строкой статистики. `null` — писать некому.
 */
export function trainingBookingTarget(
  training: Pick<TrainingView, 'author' | 'booking' | 'club' | 'coach'>,
): TrainingOwner | null {
  if (training.author === 'COACH' && training.booking === 'CLUB' && training.club !== null) {
    return { kind: 'CLUB', club: training.club };
  }

  return trainingOwner(training);
}

/** Сколько других тренировок владельца на странице тренировки. */
export const TRAINING_MORE_MAX = 6;

/**
 * Страница тренировки — `GET /trainings/:id`, «Подробнее». Видимость — та
 * же, что в списке. `more` — другие публичные тренировки того же владельца.
 */
export const trainingDetailViewSchema = trainingViewSchema.extend({
  more: z.array(trainingViewSchema).max(TRAINING_MORE_MAX),
});
export type TrainingDetailView = z.infer<typeof trainingDetailViewSchema>;

/**
 * Тренировки клуба в кабинете — `GET /clubs/:id/trainings/manage`: свои,
 * входящие от тренеров (ждут ответа клуба) и подтверждённые тренерские.
 * Публично клуб отдаёт `GET /clubs/:id/trainings` — свои и подтверждённые.
 */
export const clubTrainingsManageViewSchema = z.object({
  trainings: z.array(trainingViewSchema),
  requests: z.array(trainingViewSchema),
  coachTrainings: z.array(trainingViewSchema),
});
export type ClubTrainingsManageView = z.infer<typeof clubTrainingsManageViewSchema>;

// ---------------------------------------------------------------- квалификация

/**
 * Документ: диплом, сертификат, курс. Список правится целиком; `id` у
 * строки сохраняет документ и его отметку «проверено KTTF». Отметка
 * снимается сама, если у документа поменялись название, кем выдан, год
 * или скан: проверяли другое.
 */
export const coachCredentialInputSchema = z.object({
  id: z.uuid().optional(),
  kind: credentialKindSchema,
  title: text(150),
  issuer: text(150).nullable().optional(),
  year: year.nullable().optional(),
  /** Путь скана из `POST /files/coach-docs/:id`. */
  file: z.string().regex(COACH_DOC_PATH_PATTERN).nullable().optional(),
  /** «Показывать скан»: без галочки скан видят только тренер и администратор. */
  filePublic: z.boolean().optional(),
});
export type CoachCredentialInput = z.infer<typeof coachCredentialInputSchema>;

export const setCoachCredentialsSchema = z.object({
  credentials: z
    .array(coachCredentialInputSchema)
    .max(MAX.credentials)
    .refine(
      (list) => {
        const ids = list.flatMap((row) => (row.id === undefined ? [] : [row.id]));

        return new Set(ids).size === ids.length;
      },
      { message: 'Документ повторяется' },
    ),
});
export type SetCoachCredentialsInput = z.infer<typeof setCoachCredentialsSchema>;

export const coachCredentialViewSchema = z.object({
  id: z.uuid(),
  kind: credentialKindSchema,
  title: z.string(),
  issuer: z.string().nullable(),
  year: z.number().int().nullable(),
  /** Скан приложен — даже если смотрящему его не показывают. */
  hasFile: z.boolean(),
  filePublic: z.boolean(),
  /**
   * Где открыть скан — `coachCredentialFilePath`. `null`, если скана нет
   * или смотрящему он не положен: публичен только с галочкой тренера.
   */
  fileUrl: z.string().nullable(),
  /** Путь загрузки для правки списка. Только владельцу страницы и администратору. */
  file: z.string().nullable(),
  /** «Проверено KTTF» — когда администратор сверил документ по скану. */
  verifiedAt: z.iso.datetime().nullable(),
});
export type CoachCredentialView = z.infer<typeof coachCredentialViewSchema>;

/** Отметка администратора у документа. */
export const verifyCoachCredentialSchema = z.object({ verified: z.boolean() });
export type VerifyCoachCredentialInput = z.infer<typeof verifyCoachCredentialSchema>;

export const coachAchievementInputSchema = z.object({
  role: achievementRoleSchema,
  year: year.nullable().optional(),
  title: text(200),
});
export type CoachAchievementInput = z.infer<typeof coachAchievementInputSchema>;

export const setCoachAchievementsSchema = z.object({
  achievements: z.array(coachAchievementInputSchema).max(MAX.achievements),
});
export type SetCoachAchievementsInput = z.infer<typeof setCoachAchievementsSchema>;

export const coachAchievementViewSchema = z.object({
  id: z.uuid(),
  role: achievementRoleSchema,
  year: z.number().int().nullable(),
  title: z.string(),
});
export type CoachAchievementView = z.infer<typeof coachAchievementViewSchema>;

// ---------------------------------------------------------------- вид страницы

// ---------------------------------------------------------------- штаб клуба

/**
 * Тренерский штаб клуба — T2 (ADR-059, решение владельца от 21.10.2026).
 * Своя связь «клуб — тренер» с должностью. Заводит любая сторона: клуб
 * (OWNER, ORGANIZER) приглашает, тренер просится; вторая подтверждает.
 * Подтверждённая тренировка тренера в клубе или группа клуба с тренером
 * добавляют его в штаб сами. Разорвать может любая сторона; тренировки
 * при этом не трогаются.
 */
export const CLUB_COACH_STATUSES = ['REQUESTED_BY_COACH', 'INVITED_BY_CLUB', 'ACTIVE'] as const;
export const clubCoachStatusSchema = z.enum(CLUB_COACH_STATUSES);
export type ClubCoachStatus = z.infer<typeof clubCoachStatusSchema>;

/** Должность строкой: «старший тренер», «детский тренер». */
const position = text(60);

/** Клуб приглашает тренера — `POST /clubs/:id/staff`. */
export const inviteClubCoachSchema = z.object({
  coachId: z.uuid(),
  position: position.nullable().optional(),
});
export type InviteClubCoachInput = z.infer<typeof inviteClubCoachSchema>;

/** Тренер просится в клуб — `POST /coaches/:id/clubs`. */
export const requestClubCoachSchema = z.object({
  clubId: z.uuid(),
  position: position.nullable().optional(),
});
export type RequestClubCoachInput = z.infer<typeof requestClubCoachSchema>;

/** Должность правит клуб — `PATCH /clubs/:id/staff/:coachId`. */
export const updateClubCoachSchema = z.object({ position: position.nullable() });
export type UpdateClubCoachInput = z.infer<typeof updateClubCoachSchema>;

export const clubCoachViewSchema = z.object({
  club: trainingClubRefSchema,
  coach: trainingCoachRefSchema,
  status: clubCoachStatusSchema,
  position: z.string().nullable(),
  requestedAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
});
export type ClubCoachView = z.infer<typeof clubCoachViewSchema>;

/**
 * Штаб в кабинете клуба — `GET /clubs/:id/staff/manage`: состав,
 * приглашённые клубом (ждут тренера) и запросы тренеров (ждут клуб).
 * Публично — `GET /clubs/:id/staff`: только `ACTIVE` с опубликованной
 * страницей тренера.
 */
export const clubStaffManageViewSchema = z.object({
  active: z.array(clubCoachViewSchema),
  invited: z.array(clubCoachViewSchema),
  requests: z.array(clubCoachViewSchema),
});
export type ClubStaffManageView = z.infer<typeof clubStaffManageViewSchema>;

/** Ждёт ли связь ответа этой стороны. Одно правило на кнопку и сервер. */
export function clubCoachAwaits(status: ClubCoachStatus, side: 'CLUB' | 'COACH'): boolean {
  return side === 'CLUB' ? status === 'REQUESTED_BY_COACH' : status === 'INVITED_BY_CLUB';
}

export const coachViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  player: coachPlayerRefSchema,
  status: coachStatusSchema,
  /** Причина отказа — только владельцу и администратору, иначе `null`. */
  rejectReason: z.string().nullable(),
  /** Когда администратор последний раз одобрил или отклонил. */
  reviewedAt: z.iso.datetime().nullable(),
  /** Скрыта администратором: публично не открывается, тренер видит причину. */
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  photoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  coachingSince: z.number().int().nullable(),
  city: cityRefSchema.nullable(),
  formats: z.array(trainingPlaceSchema),
  visitAreas: z.string().nullable(),
  languages: z.array(coachLanguageSchema),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  telegram: z.string().nullable(),
  instagram: z.string().nullable(),
  primaryContact: contactKindSchema.nullable(),
  sportsRank: sportsRankSchema.nullable(),
  coachCategory: coachCategorySchema.nullable(),
  refereeCategory: z.string().nullable(),
  education: z.string().nullable(),
  /**
   * Тренировки страницы: свои и клубные, где тренер подтвердил участие.
   * Своя — `author: COACH`, клубная — `CLUB`.
   */
  trainings: z.array(trainingViewSchema),
  /** Входящие от клубов, ждут ответа тренера. Только владельцу и администратору, иначе пусто. */
  trainingRequests: z.array(trainingViewSchema),
  /** Клубы, где он в штабе (`ACTIVE`), с должностью. */
  clubs: z.array(clubCoachViewSchema),
  /** Приглашения клубов и свои запросы, ждущие ответа. Только владельцу и администратору, иначе пусто. */
  clubInvites: z.array(clubCoachViewSchema),
  clubRequests: z.array(clubCoachViewSchema),
  credentials: z.array(coachCredentialViewSchema),
  achievements: z.array(coachAchievementViewSchema),
  /** Игроков, выбравших его тренером в анкете (ADR-035). Младшие 14 — тоже только числом. */
  studentsCount: z.number().int().nonnegative(),
  /** Когда страницу последний раз сохраняли или подтверждали «Всё актуально». */
  profileReviewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type CoachView = z.infer<typeof coachViewSchema>;

/** Опубликована ли страница: одобрена и не скрыта. Только такие видны всем. */
export function isCoachPublic(coach: {
  readonly status: CoachStatus;
  readonly hidden: boolean;
}): boolean {
  return coach.status === 'APPROVED' && !coach.hidden;
}

/** Чего не хватает для отправки на проверку (ADR-059, риск «пустые страницы»). */
export const COACH_REQUIREMENTS = ['city', 'trainings'] as const;
export type CoachRequirement = (typeof COACH_REQUIREMENTS)[number];

/** Список недостающего; пустой — можно отправлять. Одно правило на кнопку и сервер. */
export function coachMissing(coach: {
  readonly city: unknown;
  readonly trainings: readonly unknown[];
}): CoachRequirement[] {
  const missing: CoachRequirement[] = [];

  if (coach.city === null) missing.push('city');
  if (coach.trainings.length === 0) missing.push('trainings');

  return missing;
}

/** Из какого статуса можно отправить на проверку: черновик и отклонённая. */
export function canSubmitCoach(status: CoachStatus): boolean {
  return status === 'DRAFT' || status === 'REJECTED';
}

// ---------------------------------------------------------------- списки

/** Список через запятую в адресе — как в «Игроках» и «Клубах». */
const commaSeparated = z.string().transform((value) => value.split(',').map((part) => part.trim()));

/** Тренеры — `GET /coaches`: переключатель «Тренеры» и выбор тренера в анкете. */
export const listCoachesSchema = pageQuerySchema.extend({
  /** Фамилия или имя словами. */
  search: z.string().trim().min(1).max(100).optional(),
  cityId: commaSeparated.pipe(z.array(z.uuid()).min(1).max(20)).optional(),
  language: coachLanguageSchema.optional(),
});
export type ListCoachesQuery = z.infer<typeof listCoachesSchema>;

export type ListCoachesRequest = Omit<ListCoachesQuery, 'cityId'> & {
  readonly cityId?: string | readonly string[];
};

export const coachListItemViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  player: coachPlayerRefSchema,
  headline: z.string().nullable(),
  photoUrl: z.string().nullable(),
  city: cityRefSchema.nullable(),
  formats: z.array(trainingPlaceSchema),
  languages: z.array(coachLanguageSchema),
  sportsRank: sportsRankSchema.nullable(),
  coachCategory: coachCategorySchema.nullable(),
  coachingSince: z.number().int().nullable(),
  /** Самая низкая цена среди тренировок с ценой — «от 8 000 ₸». */
  minPriceKzt: z.number().int().nullable(),
  trainingsCount: z.number().int().nonnegative(),
  /** Клубы KTTF, где у тренера подтверждённые тренировки. */
  clubs: z.array(trainingClubRefSchema.pick({ id: true, name: true })),
  studentsCount: z.number().int().nonnegative(),
  profileReviewedAt: z.iso.datetime().nullable(),
});
export type CoachListItemView = z.infer<typeof coachListItemViewSchema>;

/**
 * Тренировки — `GET /trainings`, раздел «Тренировки» (`docs/11` 5.2).
 * Публичные тренировки блоками по месту: клуб KTTF, зал вне KTTF, затем
 * «выезд и онлайн» одним блоком последним. Страница считает блоки, а не
 * тренировки: блок клуба не рвётся между страницами.
 */
export const listTrainingsSchema = pageQuerySchema.extend({
  kind: commaSeparated
    .pipe(z.array(trainingKindSchema).min(1).max(TRAINING_KINDS.length))
    .optional(),
  /** Любая из перечисленных аудиторий. */
  audience: commaSeparated
    .pipe(z.array(trainingAudienceSchema).min(1).max(TRAINING_AUDIENCES.length))
    .optional(),
  /**
   * Возраст ребёнка: тренировки для детей или подростков, которые берут
   * с этого возраста или младше, а также без указанного возраста.
   */
  age: z.coerce.number().int().min(3).max(17).optional(),
  place: commaSeparated
    .pipe(z.array(trainingPlaceSchema).min(1).max(TRAINING_PLACES.length))
    .optional(),
  /** Конкретный клуб KTTF. */
  clubId: z.uuid().optional(),
  /** Город: клуба у клубной тренировки, иначе страницы тренера. */
  cityId: commaSeparated.pipe(z.array(z.uuid()).min(1).max(20)).optional(),
  /** «Цена до», включительно. Тренировки без цены под такой фильтр не попадают. */
  priceTo: z.coerce.number().int().min(0).max(PRICE_KZT_MAX).optional(),
  /** Язык тренера; у клубной тренировки без тренера фильтр не проверить — она не попадает. */
  language: coachLanguageSchema.optional(),
});
export type ListTrainingsQuery = z.infer<typeof listTrainingsSchema>;

export type ListTrainingsRequest = Omit<
  ListTrainingsQuery,
  'kind' | 'audience' | 'place' | 'cityId'
> & {
  readonly kind?: readonly TrainingKind[];
  readonly audience?: readonly TrainingAudience[];
  readonly place?: readonly TrainingPlace[];
  readonly cityId?: string | readonly string[];
};

/** Вид блока: клуб KTTF, зал вне KTTF, выезд и онлайн. */
export const TRAINING_GROUP_KINDS = ['CLUB', 'VENUE', 'ANYWHERE'] as const;
export const trainingGroupKindSchema = z.enum(TRAINING_GROUP_KINDS);
export type TrainingGroupKind = z.infer<typeof trainingGroupKindSchema>;

/** Блок списка: место и его тренировки по фильтрам запроса. */
export const trainingGroupViewSchema = z.object({
  kind: trainingGroupKindSchema,
  /** У блока клуба. */
  club: trainingClubRefSchema.nullable(),
  /** У блока зала вне KTTF. */
  venue: trainingVenueSchema.nullable(),
  trainings: z.array(trainingViewSchema),
});
export type TrainingGroupView = z.infer<typeof trainingGroupViewSchema>;

// ---------------------------------------------------------------- администратор

/** Заявки тренеров у администратора: по статусу, свежие отправленные сверху. */
export const listCoachApplicationsSchema = pageQuerySchema.extend({
  status: coachStatusSchema.optional(),
});
export type ListCoachApplicationsQuery = z.infer<typeof listCoachApplicationsSchema>;

/** Строка разбора: страница целиком — администратор видит то, что опубликует. */
export const coachApplicationViewSchema = coachViewSchema.extend({
  /** Когда отправлена на проверку последний раз. */
  submittedAt: z.iso.datetime().nullable(),
});
export type CoachApplicationView = z.infer<typeof coachApplicationViewSchema>;

/** Отказ — с причиной: тренер увидит её в кабинете и поправит страницу. */
export const rejectCoachSchema = z.object({ reason: text(500) });
export type RejectCoachInput = z.infer<typeof rejectCoachSchema>;

/** Скрыть страницу (постмодерация): причину видит тренер. */
export const setCoachHiddenSchema = z
  .object({ hidden: z.boolean(), reason: text(500).optional() })
  .refine((value) => !value.hidden || value.reason !== undefined, {
    message: 'Скрытие — с причиной',
    path: ['reason'],
  });
export type SetCoachHiddenInput = z.infer<typeof setCoachHiddenSchema>;

// ---------------------------------------------------------------- статистика

/** Просмотр страницы и нажатия на способы связи — механика `ClubStatDaily`. */
/**
 * `CLUB_GROUP` — «Записаться» через клуб на тренировку, где он тренер:
 * группу клуба или свою с записью через клуб. Обращение ушло клубу,
 * тренеру — отдельной строкой, а не в его прямые обращения (решение
 * владельца от 21.10.2026).
 */
export const COACH_EVENT_KINDS = [
  'VIEW',
  'PHONE',
  'WHATSAPP',
  'TELEGRAM',
  'INSTAGRAM',
  'CLUB_GROUP',
] as const;
export const coachEventKindSchema = z.enum(COACH_EVENT_KINDS);
export type CoachEventKind = z.infer<typeof coachEventKindSchema>;

export const coachEventSchema = z.object({
  kind: coachEventKindSchema,
  source: trafficSourceSchema,
});
export type CoachEventInput = z.infer<typeof coachEventSchema>;

export const coachStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(coachLimits('PRO').statsDays).default(30),
});
export type CoachStatsQuery = z.infer<typeof coachStatsQuerySchema>;

export const coachStatsRowSchema = z.object({
  /** День по UTC+5, `YYYY-MM-DD`. */
  date: z.iso.date(),
  source: trafficSourceSchema,
  views: z.number().int(),
  phone: z.number().int(),
  whatsapp: z.number().int(),
  telegram: z.number().int(),
  instagram: z.number().int(),
  /** Записи через клуб на тренировки, где он тренер. */
  clubGroup: z.number().int(),
});
export type CoachStatsRow = z.infer<typeof coachStatsRowSchema>;

export const coachStatsViewSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  /** Только дни, в которые что-то было. */
  rows: z.array(coachStatsRowSchema),
});
export type CoachStatsView = z.infer<typeof coachStatsViewSchema>;

// ---------------------------------------------------------------- сессия

/** Своя страница тренера в `GET /auth/me`: кабинет показывает статус заявки. */
export const coachRefSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  status: coachStatusSchema,
});
export type CoachRef = z.infer<typeof coachRefSchema>;
