import { z } from 'zod';

import { productListItemViewSchema } from './catalog.js';
import { pageQuerySchema } from './pagination.js';
import { cityRefSchema } from './place.js';

/**
 * Контракт игроков — ТС 7.2.
 *
 * Состав полей — ТЗ 2.2 целиком: спортивная часть профиля живёт здесь, в
 * модели `Player`. Всё, что относится к аккаунту — логин, почта, язык,
 * пароль, Telegram — лежит в `account.ts` и меняется отдельными маршрутами.
 * Граница проведена по сущности, а не по экрану: у игрока может не быть
 * аккаунта вовсе (его завёл тренер), а у пользователя — профиля игрока
 * (судья, организатор). ADR-035.
 *
 * Рейтинг в схемах запросов отсутствует намеренно: он проекция журнала
 * `RatingEvent` (ТС 1.4), полем его не задают. Вопрос о стартовом значении
 * открыт (ОВ-2), до его решения действует умолчание схемы.
 */

/** Верхняя граница года рождения — текущий год: игроков из будущего нет. */
const currentYear = new Date().getFullYear();

const name = z.string().trim().min(1).max(100);

/** Пол. Вынесен отдельно: его же ограничивают турниры (ТЗ 4.2). */
export const genderSchema = z.enum(['MALE', 'FEMALE']);

/** Игровая рука — ТЗ 2.2. */
export const playingHandSchema = z.enum(['RIGHT', 'LEFT']);
export type PlayingHand = z.infer<typeof playingHandSchema>;

/**
 * Хват — ТЗ 2.2.
 *
 * Два значения, потому что третьего в настольном теннисе нет: европейский
 * (горизонтальный) и азиатский, он же «перо». Разновидности пера различает
 * инвентарь, а не хват.
 */
export const gripSchema = z.enum(['SHAKEHAND', 'PENHOLD']);
export type Grip = z.infer<typeof gripSchema>;

/**
 * Инвентарь — свободная строка, а не справочник.
 *
 * У конкурента это выпадающий список моделей. Свой справочник инвентаря —
 * отдельный продукт: его нужно наполнять, чистить дубли и обновлять по мере
 * выхода новых моделей. Строка не мешает завести справочник потом: значения
 * из неё станут первым его наполнением.
 */
const equipment = z.string().trim().min(1).max(120);

/**
 * Инвентарь из каталога маркета — ADR-058. Строка выше остаётся для того,
 * чего в каталоге нет. Основание — товар категории BLADE, накладки — RUBBER:
 * категорию сверяет сервер, схема знает только идентификатор.
 */
const equipmentProduct = z.uuid();

/**
 * Фото: путь к своему файлу либо внешняя ссылка.
 *
 * Своя загрузка отдаёт путь вида `/api/v1/files/...` (ADR-036), поэтому
 * абсолютной ссылкой ограничиться нельзя. Внешняя остаётся принимаемой:
 * профили, заведённые до появления загрузки, ссылаются наружу.
 */
const photo = z.union([
  z
    .string()
    .trim()
    .regex(/^\/[A-Za-z0-9\-._/]{1,200}$/, 'Ожидается путь к файлу или ссылка'),
  z.url().max(500),
]);

/**
 * Год рождения и дата обязаны говорить одно и то же.
 *
 * Год — источник истины для допуска на турнир: `birthYearFrom` и
 * `birthYearTo` сравниваются с ним, и возрастные категории в настольном
 * теннисе считаются по году, а не по дате. Дата необязательна и нужна
 * профилю. Разойдясь, они дали бы игрока, который по профилю проходит
 * в категорию, а по допуску нет.
 */
function agreeOnBirth(
  value: { birthYear?: number | undefined; birthDate?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (value.birthDate === undefined || value.birthDate === null) {
    return;
  }

  if (value.birthYear === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['birthYear'],
      message: 'Дата рождения задаётся вместе с годом',
    });

    return;
  }

  if (Number(value.birthDate.slice(0, 4)) !== value.birthYear) {
    ctx.addIssue({
      code: 'custom',
      path: ['birthDate'],
      message: 'Дата рождения не совпадает с годом рождения',
    });
  }
}

/**
 * Тренер задаётся либо выбором из списка, либо строкой, но не обоими сразу.
 *
 * Заполненные разом связь и текст — это два разных ответа на один вопрос,
 * и рано или поздно они разойдутся.
 */
function coachIsSingle(
  value: {
    coachPlayerId?: string | null | undefined;
    coachName?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (
    value.coachPlayerId !== undefined &&
    value.coachPlayerId !== null &&
    value.coachName !== undefined &&
    value.coachName !== null
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['coachName'],
      message: 'Тренер выбирается из списка либо вписывается вручную, но не разом',
    });
  }
}

const profile = {
  lastName: name,
  firstName: name,
  // Отчество не обязательно — бриф, запрет №6.
  middleName: name.optional(),
  birthYear: z.number().int().min(1900).max(currentYear),
  /** Полная дата рождения. Необязательна — см. `agreeOnBirth`. */
  birthDate: z.iso.date().optional(),
  /**
   * Показывать посторонним только год рождения — ADR-037.
   *
   * Хранится ровно так, как звучит галочка в форме: без отрицания, которое
   * рано или поздно прочитают наоборот. Умолчание — `true`: до появления
   * полной даты профиль показывал только год, и включение галочки по
   * умолчанию не меняет того, что о человеке видно.
   */
  birthYearOnly: z.boolean().optional(),
  gender: genderSchema,
  /** Город из справочника — ADR-046. */
  cityId: z.uuid(),
  photoUrl: photo.optional(),
  clubId: z.uuid().optional(),
  playingHand: playingHandSchema.optional(),
  grip: gripSchema.optional(),
  blade: equipment.optional(),
  rubberForehand: equipment.optional(),
  rubberBackhand: equipment.optional(),
  bladeProductId: equipmentProduct.optional(),
  rubberForehandProductId: equipmentProduct.optional(),
  rubberBackhandProductId: equipmentProduct.optional(),
  /** «О себе». Ограничение по длине — чтобы поле не превратилось в блог. */
  bio: z.string().trim().min(1).max(500).optional(),
  /** Тренер, выбранный из списка. */
  coachPlayerId: z.uuid().optional(),
  /** Тренер, которого в списке нет. */
  coachName: name.optional(),
};

export const createPlayerSchema = z.object(profile).superRefine((value, ctx) => {
  agreeOnBirth(value, ctx);
  coachIsSingle(value, ctx);
});
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

/**
 * Правка профиля: `null` очищает поле, отсутствие поля его не трогает.
 *
 * Без `null` однажды заполненное поле нельзя стереть вовсе: PATCH, который
 * умеет только заполнять, оставляет человека с чужим инвентарём в анкете
 * навсегда. Обязательные поля очищать нельзя — их и нет в этом списке.
 */
const clearable = {
  middleName: profile.middleName.nullable(),
  birthDate: profile.birthDate.nullable(),
  photoUrl: profile.photoUrl.nullable(),
  clubId: profile.clubId.nullable(),
  playingHand: profile.playingHand.nullable(),
  grip: profile.grip.nullable(),
  blade: profile.blade.nullable(),
  rubberForehand: profile.rubberForehand.nullable(),
  rubberBackhand: profile.rubberBackhand.nullable(),
  bladeProductId: profile.bladeProductId.nullable(),
  rubberForehandProductId: profile.rubberForehandProductId.nullable(),
  rubberBackhandProductId: profile.rubberBackhandProductId.nullable(),
  bio: profile.bio.nullable(),
  coachPlayerId: profile.coachPlayerId.nullable(),
  coachName: profile.coachName.nullable(),
};

export const updatePlayerSchema = z
  .object({ ...profile, ...clearable })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' })
  .superRefine((value, ctx) => {
    agreeOnBirth(value, ctx);
    coachIsSingle(value, ctx);
  });
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

/** Граница рейтинга в фильтре — целое, как рейтинг читается на экране (ADR-053). */
const ratingBound = z.coerce.number().int().min(0).max(9999).optional();

export const listPlayersSchema = pageQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  /**
   * Город или несколько через запятую — ADR-054, как у RTTF «регион / город»
   * с плюсом. Один город — частный случай списка.
   */
  cityId: z
    .string()
    .transform((value) => value.split(',').map((part) => part.trim()))
    .pipe(z.array(z.uuid()).min(1).max(20))
    .optional(),
  clubId: z.uuid().optional(),
  /**
   * Рейтинг «от» и «до» включительно — по тому числу, что видно на экране:
   * «до 384» находит и 384.10 (ADR-054).
   */
  ratingFrom: ratingBound,
  ratingTo: ratingBound,
  /** Без значения — оба пола. */
  gender: genderSchema.optional(),
  /** Игровая рука. Без значения — любая, включая не указанную. */
  playingHand: playingHandSchema.optional(),
  /** Порядок по рейтингу; без значения — сильнейшие первыми. */
  order: z.enum(['asc', 'desc']).optional(),
  /**
   * Только игроки без кабинета — нужен регистрации (ADR-034).
   *
   * Человек, пришедший сам, выбирает себя из заведённых тренером. Игроки,
   * у которых аккаунт уже есть, в этом списке — приглашение занять чужую
   * историю, поэтому фильтр отдельный, а не «все подряд с поиском».
   */
  withoutAccount: z.stringbool().optional(),
  /**
   * Только те, кого уже назвали тренером хотя бы раз.
   *
   * Роли тренера в продукте ещё нет, она развивается отдельно. Пока «тренер»
   * — это игрок, на которого уже сослались: список получается из самих
   * данных, а не из выдуманной колонки, и наполняется по мере того, как люди
   * заполняют профиль.
   */
  coachesOnly: z.stringbool().optional(),
  /** Играют этим основанием — «Кто играет» RTTF, ADR-058. */
  bladeId: z.uuid().optional(),
  /** Играют этой накладкой — справа или слева. */
  rubberId: z.uuid().optional(),
});
export type ListPlayersQuery = z.infer<typeof listPlayersSchema>;

/**
 * Запрос списка с клиента: город — один или несколько, в адрес уходит через
 * запятую. Отдельный тип, потому что разобранный запрос несёт массив.
 */
export type ListPlayersRequest = Omit<ListPlayersQuery, 'cityId'> & {
  readonly cityId?: string | readonly string[];
};

/**
 * Игрок в ответах API — краткий вид.
 *
 * Им встраиваются участники турнира, соперники в истории и состав зала на
 * втором экране. Спортивной анкеты здесь нет намеренно: этот вид уезжает в
 * офлайн-снимок консоли (ТС 6), и «о себе» на пятьсот знаков у каждого из
 * ста двадцати восьми участников — это десятки килобайт, которые судье в
 * зале не нужны ни разу. Полный профиль — `playerProfileViewSchema`.
 */
export const playerViewSchema = z.object({
  id: z.uuid(),
  /** `null` — заведён организатором, аккаунта нет. */
  userId: z.uuid().nullable(),
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  birthYear: z.number().int(),
  gender: z.string(),
  city: cityRefSchema,
  photoUrl: z.string().nullable(),
  clubId: z.uuid().nullable(),
  /**
   * Рейтинг строкой, а не числом.
   *
   * В базе это `Decimal(8,2)`. Число с плавающей точкой хранит не все такие
   * значения точно, и разница вылезет при сравнении локального расчёта
   * консоли с серверным — ровно то, что запрещает бриф, запрет №2.
   */
  rating: z.string(),
  ratedMatches: z.number().int(),
  isProvisional: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type PlayerView = z.infer<typeof playerViewSchema>;

/**
 * Строка списка игроков — ADR-054.
 *
 * Краткий вид и дата последнего изменения рейтинга — колонка «обновлён», как
 * у RTTF. В сам `PlayerView` дата не входит: он уезжает в офлайн-снимок и на
 * экран зала, где она не нужна. `null` — у игрока ещё нет ни одного события
 * рейтинга.
 */
/**
 * Инвентарь строкой для таблицы «основание / справа / слева», как у RTTF:
 * подпись товара каталога со ссылкой или строка анкеты без ссылки.
 */
export const equipmentLabelSchema = z.object({
  label: z.string(),
  /** Адрес товара в маркете; `null` — строка анкеты без товара. */
  slug: z.string().nullable(),
});
export type EquipmentLabel = z.infer<typeof equipmentLabelSchema>;

export const playerListItemSchema = playerViewSchema.extend({
  ratingUpdatedAt: z.iso.datetime().nullable(),
  blade: equipmentLabelSchema.nullable(),
  rubberForehand: equipmentLabelSchema.nullable(),
  rubberBackhand: equipmentLabelSchema.nullable(),
});
export type PlayerListItemView = z.infer<typeof playerListItemSchema>;

/**
 * Полный профиль игрока — ТЗ 2.2 целиком.
 *
 * Отдаётся страницей игрока и его правкой, то есть там, где анкету
 * действительно показывают. Списки и снимки обходятся кратким видом.
 */
export const playerProfileViewSchema = playerViewSchema.extend({
  /**
   * `YYYY-MM-DD` либо `null`.
   *
   * `null` означает и «дата не указана», и «показывать её посторонним
   * запрещено»: постороннему эти два случая обязаны выглядеть одинаково.
   * Различить их вправе только сам игрок и организатор его клуба — им
   * сервер отдаёт дату как есть.
   */
  birthDate: z.string().nullable(),
  /** Дата скрыта от посторонних. Сама дата при этом в ответ не попадает. */
  birthYearOnly: z.boolean(),
  playingHand: z.string().nullable(),
  grip: z.string().nullable(),
  blade: z.string().nullable(),
  rubberForehand: z.string().nullable(),
  rubberBackhand: z.string().nullable(),
  /** Инвентарь из каталога; строки выше — для того, чего в каталоге нет. */
  bladeProduct: productListItemViewSchema.nullable(),
  rubberForehandProduct: productListItemViewSchema.nullable(),
  rubberBackhandProduct: productListItemViewSchema.nullable(),
  bio: z.string().nullable(),
  /** Заполнен, если тренер выбран из списка. */
  coachPlayerId: z.uuid().nullable(),
  /**
   * Имя тренера — независимо от того, выбран он из списка или вписан руками.
   *
   * Выбранного из списка сервер подставляет сюда сам: экрану нужно одно поле
   * для показа, а не развилка в каждом месте, где тренер выводится. Чем
   * тренер задан, видно по `coachPlayerId`.
   */
  coachName: z.string().nullable(),
  /**
   * Последнее посещение сайта — ADR-050. Пишется не чаще раза в пять минут,
   * поэтому точнее этого окна не бывает. `null` — у игрока нет аккаунта или
   * он ещё ни разу не заходил после появления отметки.
   */
  lastSeenAt: z.iso.datetime().nullable(),
  /** «В сети»: посещение за последние пять минут. Считает сервер — часы клиента врут. */
  online: z.boolean(),
});
export type PlayerProfileView = z.infer<typeof playerProfileViewSchema>;

/** Окно «в сети» и шаг записи последнего посещения — одно число (ADR-050). */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
