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
  readonly services: number;
  readonly credentials: number;
  readonly achievements: number;
  /** Глубина статистики в днях. */
  readonly statsDays: number;
}

/** Черновик лимитов. Числа обсуждаются с владельцем до включения тарифов. */
export const COACH_PLAN_LIMITS: Readonly<Record<CoachPlan, CoachPlanLimits>> = {
  FREE: { services: 5, credentials: 5, achievements: 10, statsDays: 30 },
  PRO: { services: 20, credentials: 20, achievements: 40, statsDays: 365 },
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

/** Возраст ребёнка, с которого берут: от трёх лет до семнадцати. */
const kidsAge = z.number().int().min(3).max(17);

export const coachServiceInputSchema = z
  .object({
    kind: trainingKindSchema,
    audiences: uniqueList(trainingAudienceSchema, TRAINING_AUDIENCES.length).min(1),
    /** «Дети с 6 лет» — только у детской или подростковой аудитории. */
    kidsFromAge: kidsAge.nullable().optional(),
    place: trainingPlaceSchema,
    title: text(100),
    /** Расписание строкой: «пн, ср, пт 18:00–19:30». */
    schedule: text(200).nullable().optional(),
    /** Целые тенге. Без цены — «по договорённости». */
    priceKzt: z.number().int().min(0).max(PRICE_KZT_MAX).nullable().optional(),
    unit: priceUnitSchema,
    /** Примечание; у места «клуб» — название зала и адрес, пока нет штаба (T2). */
    note: text(200).nullable().optional(),
  })
  .superRefine((value, ctx) => {
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
  });
export type CoachServiceInput = z.infer<typeof coachServiceInputSchema>;

/** Тренировки целиком: порядок строк — порядок в массиве, как прайс клуба. */
export const setCoachServicesSchema = z.object({
  services: z.array(coachServiceInputSchema).max(MAX.services),
});
export type SetCoachServicesInput = z.infer<typeof setCoachServicesSchema>;

export const coachServiceViewSchema = z.object({
  id: z.uuid(),
  kind: trainingKindSchema,
  audiences: z.array(trainingAudienceSchema),
  kidsFromAge: z.number().int().nullable(),
  place: trainingPlaceSchema,
  title: z.string(),
  schedule: z.string().nullable(),
  priceKzt: z.number().int().nullable(),
  unit: priceUnitSchema,
  note: z.string().nullable(),
});
export type CoachServiceView = z.infer<typeof coachServiceViewSchema>;

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
  services: z.array(coachServiceViewSchema),
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
export const COACH_REQUIREMENTS = ['city', 'services'] as const;
export type CoachRequirement = (typeof COACH_REQUIREMENTS)[number];

/** Список недостающего; пустой — можно отправлять. Одно правило на кнопку и сервер. */
export function coachMissing(coach: {
  readonly city: unknown;
  readonly services: readonly unknown[];
}): CoachRequirement[] {
  const missing: CoachRequirement[] = [];

  if (coach.city === null) missing.push('city');
  if (coach.services.length === 0) missing.push('services');

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
  servicesCount: z.number().int().nonnegative(),
  studentsCount: z.number().int().nonnegative(),
  profileReviewedAt: z.iso.datetime().nullable(),
});
export type CoachListItemView = z.infer<typeof coachListItemViewSchema>;

/**
 * Тренировки — `GET /trainings`, раздел «Тренировки» (`docs/11` 5.2).
 * Только тренировки опубликованных страниц. Порядок — по свежести страницы,
 * внутри страницы — как расставил тренер.
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
  /** Город страницы тренера. */
  cityId: commaSeparated.pipe(z.array(z.uuid()).min(1).max(20)).optional(),
  /** «Цена до», включительно. Тренировки без цены под такой фильтр не попадают. */
  priceTo: z.coerce.number().int().min(0).max(PRICE_KZT_MAX).optional(),
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

/** Карточка тренировки: сама тренировка и её тренер. */
export const trainingListItemViewSchema = coachServiceViewSchema.extend({
  coach: coachListItemViewSchema.pick({
    id: true,
    slug: true,
    player: true,
    photoUrl: true,
    city: true,
    languages: true,
    studentsCount: true,
  }),
});
export type TrainingListItemView = z.infer<typeof trainingListItemViewSchema>;

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
export const COACH_EVENT_KINDS = ['VIEW', 'PHONE', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM'] as const;
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
