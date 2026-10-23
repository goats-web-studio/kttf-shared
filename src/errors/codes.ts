/**
 * Коды ошибок API.
 *
 * Живут в общем коде, потому что их знают обе стороны: сервер кладёт код в
 * ответ, клиент подбирает по нему локализованный текст. Английские строки
 * пользователю не показываются никогда — бриф 3.4. Формат ответа — ТС 7.8.
 *
 * Здесь только транспортный уровень: то, что может произойти в любом
 * эндпоинте. Доменные коды вроде `TOURNAMENT_ALREADY_STARTED` добавляются
 * вместе с той функцией, которая их порождает, — придумывать их заранее
 * означает изобретать бизнес-правила, чего бриф 4.2 не разрешает.
 */
export const ERROR_CODES = {
  /** Тело или параметры запроса не прошли схему. `details` — список полей. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Запрошенный объект не существует или недоступен этому пользователю. */
  NOT_FOUND: 'NOT_FOUND',
  /** Нет токена, истёк или отозван. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Токен есть, прав на действие нет. */
  FORBIDDEN: 'FORBIDDEN',
  /** Превышен лимит запросов — ТС 8.3. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Необработанный отказ. Наружу не выносит ничего, кроме кода. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // ---------- встречи: ТС 7.6 ----------

  /** Турнир не идёт: счёт вводится только по ходу турнира. */
  TOURNAMENT_NOT_RUNNING: 'TOURNAMENT_NOT_RUNNING',
  /** Участник встречи ещё не определён — предыдущий круг не сыгран (ADR-019). */
  MATCH_NOT_READY: 'MATCH_NOT_READY',
  /** Результат уже введён: изменение идёт отдельным маршрутом (ТЗ 6.3). */
  MATCH_ALREADY_FINISHED: 'MATCH_ALREADY_FINISHED',
  /** Изменять нечего: результата у встречи нет. */
  MATCH_HAS_NO_RESULT: 'MATCH_HAS_NO_RESULT',
  /** Счёт не соответствует схеме встречи. `details.problem` — чем именно. */
  INVALID_SCORE: 'INVALID_SCORE',
  /**
   * Правка отменила бы уже сыгранное ниже по сетке. Откатывать чужие
   * результаты молча нельзя: сначала снимается нижняя встреча.
   */
  DOWNSTREAM_MATCH_PLAYED: 'DOWNSTREAM_MATCH_PLAYED',
  /** Решение судьи не соответствует ни одному неразрешённому равенству. */
  TIE_DECISION_INVALID: 'TIE_DECISION_INVALID',
  /**
   * Игрока нет в расстановке: он не участвует в жеребьёвке или снят.
   * Меняться местами такому не с кем — ТЗ 5.3.
   */
  DRAW_POSITION_NOT_FOUND: 'DRAW_POSITION_NOT_FOUND',
  /**
   * Стола с таким номером в зале нет: номер больше числа столов турнира.
   * `details.tableCount` — сколько их (ADR-061).
   */
  TABLE_OUT_OF_RANGE: 'TABLE_OUT_OF_RANGE',
  /**
   * За столом идёт другая встреча. `details.matchId` — какая. При уменьшении
   * числа столов — за одним из убираемых столов ещё играют (ADR-061).
   */
  TABLE_BUSY: 'TABLE_BUSY',
  /**
   * Длина встречи меняется только у тех, что ещё не начаты. `details.matchIds`
   * — начатые встречи, чью длину правка поменяла бы (ADR-061).
   */
  MATCH_LENGTH_LOCKED: 'MATCH_LENGTH_LOCKED',
  /**
   * Опоздавшего некуда поставить (ADR-062): следующий этап уже построен или
   * идёт сетка. `details.reason` — `NEXT_STAGE_BUILT` или `KNOCKOUT`. В сетку
   * игрок попадает только заменой.
   */
  LATE_ENTRY_CLOSED: 'LATE_ENTRY_CLOSED',
  /**
   * Заменить можно только того, кто ещё не сыграл ни одной встречи
   * (ADR-062). `details.matchIds` — сыгранные.
   */
  REPLACEMENT_LOCKED: 'REPLACEMENT_LOCKED',

  // ---------- завершение турнира: ТС 7.5 ----------

  /**
   * Не все встречи сыграны — турнир завершать рано (ТЗ 4.1).
   * `details.matchIds` — чего именно не хватает.
   */
  TOURNAMENT_NOT_COMPLETE: 'TOURNAMENT_NOT_COMPLETE',
  /**
   * В таблице осталось равенство, которое судья не разрешил (ADR-008).
   * Пока места не определены, турнир не завершается. `details.groups` — где.
   */
  TIES_UNRESOLVED: 'TIES_UNRESOLVED',
  /**
   * У участника сыгранной встречи нет рейтинга, зафиксированного на старте.
   * Считать по текущему вместо снимка нельзя — это тихо нарушило бы ТС 5.4.
   */
  RATING_SNAPSHOT_MISSING: 'RATING_SNAPSHOT_MISSING',

  // ---------- справочник стран и городов: ADR-046 ----------

  /**
   * Города нет в справочнике, он скрыт или скрыта его страна. Новый клуб
   * или игрок в такой город не записывается; у кого он уже указан, тот
   * с ним и остаётся.
   */
  CITY_UNAVAILABLE: 'CITY_UNAVAILABLE',
  /**
   * Такая запись уже есть: страна с этим кодом или город с этим названием
   * в той же стране. Два «Алматы» в одной стране — ровно то, от чего
   * справочник избавляет.
   */
  PLACE_ALREADY_EXISTS: 'PLACE_ALREADY_EXISTS',

  // ---------- страница клуба: ADR-055 ----------

  /**
   * Достигнут предел тарифа страницы: фото, видео, записей в месяц или
   * закреплённых. `details.limit` — какой, `details.max` — его величина.
   * Пока тарифы выключены, действует защитный предел (`clubLimits`).
   */
  CLUB_PLAN_LIMIT: 'CLUB_PLAN_LIMIT',
  /** Ссылка не на ролик YouTube, или ролик недоступен: обложку не скачать. */
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',

  // ---------- маркет: ADR-058 ----------

  /** Производитель с таким названием уже есть: два «Butterfly» — ровно то, от чего справочник избавляет. */
  BRAND_ALREADY_EXISTS: 'BRAND_ALREADY_EXISTS',

  // ---------- страница тренера: ADR-059 ----------

  /** У игрока уже есть страница тренера: одна на профиль. */
  COACH_ALREADY_EXISTS: 'COACH_ALREADY_EXISTS',
  /**
   * На проверку отправляется страница с городом и хотя бы одной тренировкой.
   * `details.missing` — чего не хватает (`coachMissing`).
   */
  COACH_INCOMPLETE: 'COACH_INCOMPLETE',
  /**
   * Действие не подходит к статусу заявки: отправить уже отправленную,
   * одобрить неотправленную. `details.status` — текущий.
   */
  COACH_STATUS_INVALID: 'COACH_STATUS_INVALID',
  /** Подтвердить или отклонить можно только связь, которая ждёт ответа этой стороны. */
  TRAINING_LINK_INVALID: 'TRAINING_LINK_INVALID',
  /** Подтвердить можно только связь со штабом, которая ждёт ответа этой стороны; дважды в штаб не берут. */
  CLUB_COACH_INVALID: 'CLUB_COACH_INVALID',
  /**
   * Предел тарифа страницы тренера: фото, видео, записей в месяц или
   * закреплённых (`coachLimits`). `details.limit`, `details.max` — как у клуба.
   */
  COACH_PLAN_LIMIT: 'COACH_PLAN_LIMIT',
  /**
   * Тренер участника правится только до старта турнира: после него запись
   * — история, по ней считаются медали учеников (T3).
   */
  REGISTRATION_COACH_LOCKED: 'REGISTRATION_COACH_LOCKED',

  // ---------- заявка на пробную: ADR-059, T3 ----------

  /** У человека уже есть новая заявка на эту тренировку: ждёт ответа. */
  TRIAL_REQUEST_EXISTS: 'TRIAL_REQUEST_EXISTS',
  /** Предел заявок за сутки (`TRIAL_REQUESTS_PER_DAY`). `details.max` — его величина. */
  TRIAL_REQUEST_LIMIT: 'TRIAL_REQUEST_LIMIT',
  /** Ответить или отозвать можно только новую заявку. `details.status` — текущий. */
  TRIAL_REQUEST_INVALID: 'TRIAL_REQUEST_INVALID',

  // ---------- форум: ADR-064 ----------

  /** Писать на форуме можно только с профилем игрока: автор — это профиль. */
  FORUM_PROFILE_REQUIRED: 'FORUM_PROFILE_REQUIRED',
  /** Администратор запретил писать. `details.until`, `details.reason`. */
  FORUM_MUTED: 'FORUM_MUTED',
  /** Тема закрыта: ответить, править и отмечать в ней нельзя. */
  FORUM_TOPIC_LOCKED: 'FORUM_TOPIC_LOCKED',
  /**
   * Лимит форума исчерпан. `details.kind` — `TOPICS`, `POSTS` или `REPORTS`,
   * `details.limit` — сколько можно.
   */
  FORUM_LIMIT: 'FORUM_LIMIT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Известен ли код. Нужен на границе: коды приходят из JSON и от чужого кода. */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}
