import { z } from 'zod';

import { clubHoursIntervalSchema } from './club-hours.js';
import { clubPriceViewSchema } from './club-page.js';
import { CLUB_IMAGE_PATH_PATTERN } from './media.js';
import { pageQuerySchema } from './pagination.js';
import { cityRefSchema } from './place.js';

/**
 * Контракт клубов — ТС 7.4.
 *
 * Состав полей — ТЗ 3.1 и модель `Club`, страница клуба — ADR-055 и
 * `docs/09`: обложка, удобства, зал, контакты, ссылка в 2GIS. Часы и цены
 * правятся своими маршрутами целиком (`club-hours.ts`, `club-page.ts`).
 */

const optionalText = z.string().trim().min(1).max(500);

/** Удобства зала. Детская секция — тоже удобство: по ней фильтруют так же. */
export const CLUB_AMENITIES = [
  'AIR_CONDITIONING',
  'SHOWER',
  'PARKING',
  'LOCKER_ROOM',
  'WIFI',
  'CAFE',
  'SHOP',
  'KIDS',
] as const;
export const clubAmenitySchema = z.enum(CLUB_AMENITIES);
export type ClubAmenity = z.infer<typeof clubAmenitySchema>;

export const FLOOR_TYPES = ['SPORT_COVER', 'LINOLEUM', 'WOOD', 'OTHER'] as const;
export const floorTypeSchema = z.enum(FLOOR_TYPES);
export type FloorType = z.infer<typeof floorTypeSchema>;

/** Главный способ связи — он становится единственной кнопкой `primary` на странице. */
export const CONTACT_KINDS = ['PHONE', 'WHATSAPP', 'TELEGRAM'] as const;
export const contactKindSchema = z.enum(CONTACT_KINDS);
export type ContactKind = z.infer<typeof contactKindSchema>;

/**
 * Имя в Telegram без `@` — так из него собирается ссылка `t.me/<имя>`.
 * Ссылку целиком форма разбирает сама и присылает только имя.
 */
export const TELEGRAM_PATTERN = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

/** Ссылка на карточку в 2GIS, в том числе короткая `go.2gis.com`. */
export const TWO_GIS_URL_PATTERN = /^https:\/\/(?:[a-z]+\.)?2gis\.(?:kz|ru|com)\//;

/** Своя загруженная картинка или, для логотипов из прошлого, внешняя ссылка. */
const clubImage = z.union([z.string().regex(CLUB_IMAGE_PATH_PATTERN), z.url().max(500)]);

export const createClubSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Город из справочника — ADR-046. */
  cityId: z.uuid(),
  shortName: optionalText.max(50).optional(),
  address: optionalText.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Клуб без столов не проводит турниры; ноль здесь означал бы опечатку.
  tableCount: z.number().int().positive().max(200).optional(),
  phone: optionalText.max(30).optional(),
  whatsapp: optionalText.max(30).optional(),
  instagram: optionalText.max(100).optional(),
  logoUrl: clubImage.optional(),
  description: z.string().trim().max(2000).optional(),
  /** Обложка — только загруженная: чужая ссылка на крупную картинку — это чужой трафик. */
  coverUrl: z.string().regex(CLUB_IMAGE_PATH_PATTERN).optional(),
  website: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .optional(),
  telegram: z.string().trim().regex(TELEGRAM_PATTERN).optional(),
  twoGisUrl: z.url().max(500).regex(TWO_GIS_URL_PATTERN).optional(),
  amenities: z
    .array(clubAmenitySchema)
    .max(CLUB_AMENITIES.length)
    .refine((list) => new Set(list).size === list.length, { message: 'Удобство повторяется' })
    .optional(),
  tableBrand: optionalText.max(100).optional(),
  floorType: floorTypeSchema.optional(),
  /** Два метра — меньше не бывает даже в подвале; двадцать — спортзал с запасом. */
  ceilingHeightCm: z.number().int().min(200).max(2000).optional(),
  hoursNote: optionalText.max(200).optional(),
  primaryContact: contactKindSchema.optional(),
});
export type CreateClubInput = z.infer<typeof createClubSchema>;

const create = createClubSchema.shape;

/**
 * Изменение клуба. Пустое тело отвергается: запрос, который ничего не меняет,
 * почти всегда означает ошибку на клиенте, а не намерение.
 *
 * `null` у необязательного поля — «стереть» (ADR-043): организатор, убравший
 * из формы старый телефон, ждёт, что его не станет и на странице клуба.
 * Название, город и столы стереть нельзя — без них клуба нет. Ограничения
 * полей берутся из схемы создания, а не повторяются.
 */
export const updateClubSchema = createClubSchema
  .extend({
    shortName: create.shortName.unwrap().nullable(),
    address: create.address.unwrap().nullable(),
    lat: create.lat.unwrap().nullable(),
    lng: create.lng.unwrap().nullable(),
    phone: create.phone.unwrap().nullable(),
    whatsapp: create.whatsapp.unwrap().nullable(),
    instagram: create.instagram.unwrap().nullable(),
    logoUrl: create.logoUrl.unwrap().nullable(),
    description: create.description.unwrap().nullable(),
    coverUrl: create.coverUrl.unwrap().nullable(),
    website: create.website.unwrap().nullable(),
    telegram: create.telegram.unwrap().nullable(),
    twoGisUrl: create.twoGisUrl.unwrap().nullable(),
    tableBrand: create.tableBrand.unwrap().nullable(),
    floorType: create.floorType.unwrap().nullable(),
    ceilingHeightCm: create.ceilingHeightCm.unwrap().nullable(),
    hoursNote: create.hoursNote.unwrap().nullable(),
    primaryContact: create.primaryContact.unwrap().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateClubInput = z.infer<typeof updateClubSchema>;

/** Список через запятую в адресе: `?cityId=<id>,<id>` — как в «Игроках» (ADR-054). */
const commaSeparated = z.string().transform((value) => value.split(',').map((part) => part.trim()));

export const listClubsSchema = pageQuerySchema.extend({
  /** Город или несколько через запятую. */
  cityId: commaSeparated.pipe(z.array(z.uuid()).min(1).max(20)).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  /** Все перечисленные удобства сразу, а не любое из них. */
  amenities: commaSeparated
    .pipe(z.array(clubAmenitySchema).min(1).max(CLUB_AMENITIES.length))
    .optional(),
  /** Только клубы с ближайшим или идущим турниром. */
  upcoming: z.stringbool().optional(),
});
export type ListClubsQuery = z.infer<typeof listClubsSchema>;

/** Запрос списка с клиента: списки — массивом или строкой, в адрес уходят через запятую. */
export type ListClubsRequest = Omit<ListClubsQuery, 'cityId' | 'amenities'> & {
  readonly cityId?: string | readonly string[];
  readonly amenities?: readonly ClubAmenity[];
};

/** Скрыть клуб из каталога — администратор (ADR-055, модерация). */
export const setClubHiddenSchema = z.object({ hidden: z.boolean() });
export type SetClubHiddenInput = z.infer<typeof setClubHiddenSchema>;

export const clubRoleSchema = z.enum(['OWNER', 'ORGANIZER', 'REFEREE']);
export type ClubRole = z.infer<typeof clubRoleSchema>;

/**
 * Добавление в состав — ТЗ 1: состав организаторов ведёт владелец.
 *
 * Человек указывается тем, чем он входит, — логином или телефоном
 * (ADR-043). Внутренний идентификатор аккаунта владельцу взять негде:
 * списка пользователей платформа не отдаёт и отдавать не должна.
 */
export const addMemberSchema = z.object({
  identifier: z.string().trim().min(1).max(64),
  role: clubRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/** Клуб в ответах API. Состав полей — ТЗ 3.1 в пределах модели `Club`. */
export const clubViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  shortName: z.string().nullable(),
  city: cityRefSchema,
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  tableCount: z.number().int(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  logoUrl: z.string().nullable(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  website: z.string().nullable(),
  telegram: z.string().nullable(),
  twoGisUrl: z.string().nullable(),
  amenities: z.array(clubAmenitySchema),
  tableBrand: z.string().nullable(),
  floorType: floorTypeSchema.nullable(),
  ceilingHeightCm: z.number().int().nullable(),
  hoursNote: z.string().nullable(),
  primaryContact: contactKindSchema.nullable(),
  hours: z.array(clubHoursIntervalSchema),
  prices: z.array(clubPriceViewSchema),
  /** Когда страницу последний раз сохраняли или подтверждали «Всё актуально». */
  profileReviewedAt: z.iso.datetime().nullable(),
  /** Скрыт из каталога администратором. По прямой ссылке страница открывается. */
  hidden: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type ClubView = z.infer<typeof clubViewSchema>;

/** Клуб в списке: тот же вид плюс ближайший турнир — по нему список и упорядочен. */
export const clubListItemViewSchema = clubViewSchema.extend({
  /** Начало ближайшего или идущего турнира; `null`, если впереди ничего нет. */
  nextTournamentAt: z.iso.datetime().nullable(),
});
export type ClubListItemView = z.infer<typeof clubListItemViewSchema>;

/** Участник состава клуба — ТЗ 3.2. */
export const clubMemberViewSchema = z.object({
  userId: z.uuid(),
  role: z.string(),
  playerId: z.uuid().nullable(),
  /** `null`, пока профиль игрока не заполнен. */
  name: z.string().nullable(),
});
export type ClubMemberView = z.infer<typeof clubMemberViewSchema>;
