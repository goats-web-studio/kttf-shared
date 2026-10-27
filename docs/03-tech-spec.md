# 03. Техническая спецификация

_Архитектура, стек, модель данных, контракты API, нефункциональные требования._

---

## 1. Архитектурные принципы

**1.1. Единая модель турнира.** Турнир — один объект от создания до публикации. Никаких экспортов между модулями, никаких файлов на диске, никакой ручной синхронизации. Это прямое следствие главной слабости конкурента.

**1.2. Офлайн-first для консоли судьи.** Модуль проведения турнира работает как локальное приложение с очередью синхронизации. Сеть — улучшение, а не условие работы.

**1.3. Разделение чтения и записи.** Публичная часть (рейтинги, результаты, календарь) читается миллионами запросов и агрессивно кэшируется. Консоль судьи пишет часто и мелко. Это разные профили нагрузки.

**1.4. Рейтинг — событийный журнал, не поле.** Рейтинг игрока не хранится как изменяемое число. Хранится журнал рейтинговых событий, текущее значение — материализованная проекция. Позволяет пересчитать историю при обнаружении ошибки или смене формулы.

**1.5. Данные в Казахстане.** Инфраструктура размещается на территории РК согласно требованиям законодательства о персональных данных.

**1.6. Один язык в кодовой базе.** TypeScript от базы до интерфейса. Команда маленькая, переключение контекста дороже теоретических выгод полиглотности.

---

## 2. Стек

### 2.1. Бэкенд

| Компонент     | Выбор                  | Обоснование                                                               |
| ------------- | ---------------------- | ------------------------------------------------------------------------- |
| Рантайм       | Node.js 24 LTS         | Текущий LTS, установлен на машине разработки                              |
| Фреймворк     | NestJS 11              | Структура из коробки, DI, модульность. Для CRUD-тяжёлого домена оптимален |
| Язык          | TypeScript 6.x, strict |                                                                           |
| ORM           | Prisma 6               | Типобезопасность, миграции, читаемая схема                                |
| БД            | PostgreSQL 17          |                                                                           |
| Кэш и очереди | Redis 7 + BullMQ       | Фоновые задачи: обсчёт рейтинга, уведомления, парсеры                     |
| Realtime      | Socket.IO              | Второй экран, живое обновление консоли                                    |
| Файлы         | MinIO (S3-совместимый) | Самохостинг, данные в РК                                                  |
| Валидация     | Zod                    | Общие схемы между фронтом и бэком                                         |

### 2.2. Фронтенд

| Компонент            | Выбор                                                  |
| -------------------- | ------------------------------------------------------ |
| Сборка               | Vite 8                                                 |
| Библиотека           | React 19 + TypeScript strict                           |
| Роутинг              | TanStack Router                                        |
| Серверное состояние  | TanStack Query                                         |
| Клиентское состояние | Zustand                                                |
| Стили                | Tailwind CSS 4                                         |
| Компоненты           | shadcn/ui, основание своё (ADR-039)                    |
| Формы                | React Hook Form + Zod                                  |
| Графики              | Собственный SVG (ADR-028)                              |
| Локальное хранилище  | Dexie (IndexedDB)                                      |
| PWA                  | vite-plugin-pwa (Workbox)                              |
| Локализация          | Собственный словарь (ADR-016)                          |
| Дизайн-система       | Токены в `styles.css` (ADR-038, `07-design-system.md`) |
| Гарнитуры            | Oswald и Inter, свои файлы через fontsource            |

### 2.3. Мобильное

**MVP:** PWA. Устанавливается на домашний экран, работает офлайн, push через Web Push. Консоль судьи — только здесь.

**Нативное приложение — Flutter, репозиторий `kttf-mobile` (ADR-078).** iOS и Android, стиль сайта: токены генерируются из `kttf-front/src/styles.css`, тема повторяет MUI-тему сайта.

**Движок на Dart — перенос `kttf-shared` в пакет `kttf_shared` (`kttf-mobile/shared/`, ADR-079).** Рейтинг, сетки, таблицы, места, допуск, коды ошибок и контракт API. Равенство с TypeScript проверяется бит в бит на ~14 тысячах эталонов, снятых с оригинала; эталоны привязаны к отпечатку исходников, и изменение движка без обновления переноса валит сборку. Консоль судьи остаётся в PWA (ADR-004).

**Дизайн:** светлая и тёмная темы из токенов сайта, гарнитура Inter, разделы «Рейтинг», «Турниры», «Клубы», «Ещё». **Языки:** русский, казахский, английский, корейский, китайский, японский.

**Чем платим:** App Store, Google Play, ревью и релизные циклы; каждое изменение движка — правка и в переносе.

### 2.4. Инфраструктура

| Компонент         | Выбор                                             |
| ----------------- | ------------------------------------------------- |
| Контейнеризация   | Docker + Docker Compose                           |
| Обратный прокси   | Caddy (автоматический TLS)                        |
| CI/CD             | GitHub Actions                                    |
| Реестр образов    | GitHub Container Registry (org: goats-web-studio) |
| Хостинг           | VPS на территории РК                              |
| Мониторинг ошибок | Sentry (self-hosted или облако)                   |
| Метрики           | Prometheus + Grafana                              |
| Логи              | Loki                                              |
| Бэкапы            | pg_dump ежедневно + WAL-архив, хранение 30 дней   |

**Kubernetes не используем** до момента, когда одного сервера объективно перестанет хватать. На старте это чистый оверхед.

### 2.5. Внешние сервисы

| Задача  | Сервис                                  |
| ------- | --------------------------------------- |
| Платежи | Kaspi Business API, резерв — ePay Halyk |
| Push    | Web Push (VAPID), позже FCM             |
| Карты   | 2GIS API                                |

**SMS-провайдера в списке больше нет.** Вход переведён на логин и пароль 03.09.2026, одноразовый код удалён целиком — ADR-034, ОВ-9.

### 2.6. Инструменты разработки

| Задача              | Выбор                                      | Обоснование                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Пакетный менеджер   | pnpm                                       | Экономия диска, строгий resolution                                                                                                                                                                                                                          |
| Оркестрация         | `pnpm` в каждом репозитории отдельно       | Монорепозитория нет, оркестрировать нечего (ADR-001)                                                                                                                                                                                                        |
| Линтер              | ESLint 10, flat config + typescript-eslint | **Type-aware правила.** Бриф 3.1 запрещает `any` и требует `unknown` с сужением — проверить это можно только правилами с доступом к типам (`no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access`). Синтаксического линтера здесь недостаточно |
| Форматтер           | Prettier                                   |                                                                                                                                                                                                                                                             |
| Тесты               | Vitest                                     | Один раннер на все три репозитория. ESM из коробки, совместим с Jest API                                                                                                                                                                                    |
| Версии зависимостей | Актуальные стабильные, кроме TypeScript    | Гринфилд. TypeScript закреплён на 6.x: typescript-eslint не поддерживает 7 (ADR-005)                                                                                                                                                                        |

---

## 3. Структура репозитория

**Три независимых репозитория, лежащих рядом.** Монорепозитория нет: у каждого свой `package.json`, свой `node_modules`, свой CI. Обоснование — ADR-001.

```
kttf/                           ← просто общая папка, не проект
├── kttf-back/                  ← репозиторий: NestJS API
├── kttf-front/                 ← репозиторий: React PWA
│   └── src/features/
│       ├── console/            # Модуль проведения турнира (offline-first)
│       ├── tournament/
│       ├── player/
│       ├── club/
│       └── rating/
└── kttf-shared/                ← репозиторий: всё общее
    ├── src/
    │   ├── rating/             # Движок рейтинга (чистые функции)
    │   ├── brackets/           # Генерация схем и сеток (чистые функции)
    │   ├── types/              # Общие типы, Zod-схемы, константы
    │   └── ui/                 # Общие компоненты
    ├── tests/                  # ADR-тесты: стерегут решения из 06-decisions.md
    ├── config/                 # tsconfig, ESLint, Prettier — экспортируются наружу
    ├── docs/                   # Вся документация проекта
    └── CLAUDE.md               # Точка входа агента
```

**Имена репозиториев заданы владельцем продукта и не меняются.** Новое приложение — новая папка и новый репозиторий. На верхнем уровне не лежит ничего, кроме проектов.

**Документация и конфигурация живут в `kttf-shared`.** Это единственный репозиторий, от которого зависят оба приложения: контекст и правила едут вместе с ним и доступны агенту на любой машине. Приложения не заводят своих копий правил линтера и TypeScript — они импортируют `@kttf/shared/config/*`.

**Turborepo не используется.** Оркестрировать нечего: у каждого репозитория свои команды.

### Два приложения, не одно

`kttf-back` и `kttf-front` — **раздельные приложения и раздельные репозитории**. NestJS не отдаёт фронтенд: у бэкенда свой контейнер и свой деплой, фронтенд собирается Vite в статику и раздаётся Caddy. Общее у них — только зависимость от `kttf-shared`.

### Как приложения подключают общий код

`kttf-shared` подключается **git-зависимостью, закреплённой коммитом**:

```json
"dependencies": {
  "@kttf/shared": "github:goats-web-studio/kttf-shared#<полный SHA>"
}
```

**Ветка вместо SHA запрещена.** Оба приложения обязаны ссылаться на один и тот же коммит и обновляться одной парой синхронных правок. Иначе бэкенд и фронтенд разъедутся по версиям движка при первом же независимом `pnpm install`, и офлайн-консоль посчитает таблицу иначе, чем сервер, — молча. Это ровно то, что запрещает бриф, запрет №2.

### Фронтенд — одно приложение

**Одна точка входа, одна установка PWA, одна сессия.** Консоль судьи — крупный модуль внутри `kttf-front`, а не третье приложение. Обоснование — `06-decisions.md`, ADR-004.

Следствия, обязательные к соблюдению:

- Маршруты консоли грузятся лениво отдельными чанками
- Workbox **precache** этих чанков обязателен: судья обязан открыть консоль в зале без сети, а ленивый чанк без предзагрузки в офлайне недоступен
- Бюджет `< 400 КБ gzip` (раздел 8.1) относится к **набору чанков консоли**, а не ко всему приложению. Проверяется на каждом прогоне тестов, а не на глаз: `kttf-front/src/app/precache.test.ts` собирает приложение и считает замыкание чанков консоли по манифесту сборки (ADR-032)
- Тяжёлые зависимости публичной части (графики, карты) не должны попадать в чанки консоли. Нарушение бюджета — красный `pnpm test`

### Ключевое решение

Пакеты `rating` и `brackets` — **чистые функции без побочных эффектов и без зависимостей от инфраструктуры**. Один и тот же код исполняется на сервере и в браузере в офлайн-режиме. Это обязательное условие корректности офлайн-режима: локальный расчёт таблицы обязан совпадать с серверным.

Оба пакета покрываются юнит-тестами на 100%. Это единственные два места, где ошибка ломает доверие к продукту необратимо.

---

## 4. Модель данных

### 4.1. Схема (Prisma, сокращённо)

```prisma
// ============ Пользователи ============

model User {
  id            String   @id @default(uuid())
  phone         String   @unique          // E.164, +7XXXXXXXXXX
  login         String?  @unique          // второй способ войти (ADR-034)
  passwordHash  String?                   // scrypt с солью на пользователя
  phoneVerified Boolean  @default(false)
  email         String?  @unique
  locale        Locale   @default(RU)
  telegramId    String?                   // числовой chat_id, под уведомления
  isAdmin       Boolean  @default(false)  // администратор платформы, ADR-046
  lastSeenAt    DateTime?                 // последнее посещение, не чаще раза в 5 мин (ADR-050)
  createdAt     DateTime @default(now())

  player        Player?
  clubRoles     ClubMember[]
  sessions      Session[]
}

enum Locale { KK RU EN }

// ============ Игроки ============

model Player {
  id             String   @id @default(uuid())
  userId         String?  @unique          // null = заведён организатором, аккаунта нет
  user           User?    @relation(fields: [userId], references: [id])

  lastName       String
  firstName      String
  middleName     String?                   // необязательно
  birthYear      Int                       // источник истины для допуска
  birthDate      DateTime? @db.Date        // необязательна, обязана совпадать с годом
  birthYearOnly  Boolean  @default(true)   // показывать посторонним только год (ADR-037)
  gender         Gender
  cityId         String                    // справочник, ADR-046
  city           City     @relation(fields: [cityId], references: [id])
  photoUrl       String?
  clubId         String?
  club           Club?    @relation(fields: [clubId], references: [id])

  // Анкета ТЗ 2.2 (ADR-035). Инвентарь строкой, а не справочником
  playingHand    PlayingHand?
  grip           Grip?
  blade          String?
  rubberForehand String?
  rubberBackhand String?
  bio            String?

  // Тренер: связь либо строка, но не оба сразу
  coachPlayerId  String?
  coach          Player?  @relation("PlayerCoach", fields: [coachPlayerId], references: [id])
  students       Player[] @relation("PlayerCoach")
  coachName      String?

  // Проекция рейтинга (материализованная, источник истины — RatingEvent)
  rating         Decimal  @default(250) @db.Decimal(8,2)
  ratedMatches   Int      @default(0)
  isProvisional  Boolean  @default(true)
  trustScore     Decimal  @default(100) @db.Decimal(5,2)

  registrations  Registration[]
  ratingEvents   RatingEvent[]

  @@index([rating(sort: Desc)])
  @@index([cityId, rating(sort: Desc)])
  @@index([lastName, firstName])
  @@index([coachPlayerId])              // список тренеров — выборка по ссылке
}

enum Gender { MALE FEMALE }
enum PlayingHand { RIGHT LEFT }
enum Grip { SHAKEHAND PENHOLD }           // европейский и азиатский («перо»)

// ============ Заявки клубов (ADR-047) ============

// Форма «Напишите нам». Отправляет кто угодно, читает администратор.
model ClubApplication {
  id          String                @id @default(uuid())
  name        String
  contact     String                       // телефон или email, как написали
  clubName    String
  city        String                       // строкой: города может не быть в справочнике
  address     String?
  tableCount  Int?
  tournaments String?
  message     String?
  status      ClubApplicationStatus @default(NEW)
  userId      String?                      // вошедший отправитель
  ipHash      String                       // HMAC адреса — для лимита, сам адрес не хранится
  createdAt   DateTime              @default(now())
  handledAt   DateTime?

  @@index([status, createdAt(sort: Desc)])
  @@index([ipHash, createdAt])
}

enum ClubApplicationStatus { NEW DONE }

// ============ Справочник стран и городов (ADR-046) ============

// Ведёт администратор платформы. Записи скрываются, а не удаляются.
model Country {
  id        String  @id @default(uuid())
  code      String  @unique              // ISO 3166-1 alpha-2
  name      String                       // по-русски
  nameKk    String?                      // по-казахски, без него — русское
  sortOrder Int     @default(100)
  isActive  Boolean @default(true)
  cities    City[]
}

model City {
  id        String  @id @default(uuid())
  countryId String
  country   Country @relation(fields: [countryId], references: [id])
  name      String
  nameKk    String?
  sortOrder Int     @default(100)        // столицы впереди
  isActive  Boolean @default(true)
  clubs     Club[]
  players   Player[]

  @@unique([countryId, name])
}

// ============ Клубы ============

model Club {
  id          String   @id @default(uuid())
  name        String
  shortName   String?
  cityId      String                     // справочник, ADR-046
  city        City     @relation(fields: [cityId], references: [id])
  address     String?
  lat         Float?
  lng         Float?
  tableCount  Int      @default(1)
  phone       String?
  whatsapp    String?
  instagram   String?
  logoUrl     String?
  description String?

  balance     Decimal  @default(0) @db.Decimal(12,2)
  tariffId    String?

  members     ClubMember[]
  tournaments Tournament[]
  players     Player[]
  transactions Transaction[]
}

model ClubMember {
  id     String   @id @default(uuid())
  clubId String
  userId String
  role   ClubRole
  club   Club @relation(fields: [clubId], references: [id])
  user   User @relation(fields: [userId], references: [id])

  @@unique([clubId, userId])
}

enum ClubRole { OWNER ORGANIZER REFEREE }

// ============ Турниры ============

model Tournament {
  id              String   @id @default(uuid())
  clubId          String
  club            Club     @relation(fields: [clubId], references: [id])

  name            String
  startsAt        DateTime
  registrationEndsAt DateTime?
  status          TournamentStatus @default(DRAFT)

  entryFee        Int      @default(0)      // тенге
  maxParticipants Int?
  ratingCapMax    Decimal? @db.Decimal(8,2)
  ratingCapMin    Decimal? @db.Decimal(8,2)
  reviewOutOfRating Boolean @default(false) // заявки вне планки — ADR-044
  birthYearFrom   Int?
  birthYearTo     Int?
  genderLimit     Gender?

  level           TournamentLevel @default(CLUB)  // коэффициент T
  tableCount      Int

  formatConfig    Json                        // конфигурация схемы, см. 4.2

  description     String?
  prizeInfo       String?

  publicToken     String   @unique            // для второго экрана

  createdAt       DateTime @default(now())
  startedAt       DateTime?
  finishedAt      DateTime?
  ratedAt         DateTime?
  placesAt        DateTime?                   // места записаны в заявки, ADR-048

  registrations   Registration[]
  stages          Stage[]
  matches         Match[]

  @@index([status, startsAt])
  @@index([clubId, startsAt(sort: Desc)])
}

enum TournamentStatus {
  DRAFT PUBLISHED REG_OPEN REG_CLOSED RUNNING FINISHED RATED CANCELLED
}

enum TournamentLevel { CLUB REGIONAL NATIONAL }

model Registration {
  id           String   @id @default(uuid())
  tournamentId String
  playerId     String
  status       RegistrationStatus @default(REGISTERED)
  seed         Int?                        // посев
  isRated      Boolean  @default(true)     // false = вне зачёта
  paidAt       DateTime?
  paymentId    String?
  place        Int?                        // итоговое место, ADR-048
  placeTo      Int?                        // конец делённого места: «5–8»
  createdAt    DateTime @default(now())

  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  player       Player     @relation(fields: [playerId], references: [id])

  @@unique([tournamentId, playerId])
  @@index([tournamentId, status])
}

enum RegistrationStatus {
  REGISTERED PENDING WAITLIST CONFIRMED PLAYING WITHDRAWN NO_SHOW REJECTED
  // PENDING — заявка вне рейтинговой планки ждёт решения, REJECTED — отказ по ней (ADR-044)
}

// ============ Этапы и встречи ============

model Stage {
  id           String   @id @default(uuid())
  tournamentId String
  order        Int
  type         StageType
  name         String
  config       Json

  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  groups       Group[]
  matches      Match[]

  @@unique([tournamentId, order])
}

enum StageType { GROUPS KNOCKOUT ROUND_ROBIN CONSOLATION }

model Group {
  id       String @id @default(uuid())
  stageId  String
  label    String              // "гр. 1"
  order    Int
  stage    Stage  @relation(fields: [stageId], references: [id])
  matches  Match[]
}

model Match {
  id            String   @id @default(uuid())
  tournamentId  String
  stageId       String
  groupId       String?

  // Участник может быть ещё не определён: в сетке полуфинал — это
  // «победитель такой-то встречи». Источник — в sourceA/sourceB (ADR-019).
  playerAId     String?
  playerBId     String?
  sourceA       Json?                    // { kind: 'WINNER'|'LOSER', matchId }
  sourceB       Json?

  status        MatchStatus @default(PENDING)
  tableNumber   Int?

  setsA         Int?
  setsB         Int?
  setScores     Json?                    // [[11,9],[9,11],[11,7]]
  resultType    ResultType?

  bracketRound  Int?
  bracketSlot   Int?

  startedAt     DateTime?
  finishedAt    DateTime?

  // Офлайн-синхронизация
  clientId      String?  @unique         // UUID, сгенерированный клиентом
  clientVersion Int      @default(0)

  tournament    Tournament @relation(fields: [tournamentId], references: [id])
  stage         Stage      @relation(fields: [stageId], references: [id])
  group         Group?     @relation(fields: [groupId], references: [id])

  @@index([tournamentId, status])
  @@index([stageId, groupId])
}

enum MatchStatus { PENDING QUEUED PLAYING FINISHED CANCELLED }
enum ResultType { NORMAL WALKOVER RETIRED }

// ============ Рейтинг ============

model RatingEvent {
  id            String   @id @default(uuid())
  playerId      String
  matchId       String?
  tournamentId  String?

  type          RatingEventType
  ratingBefore  Decimal  @db.Decimal(8,2)
  delta         Decimal  @db.Decimal(8,2)
  ratingAfter   Decimal  @db.Decimal(8,2)

  // Параметры расчёта — сохраняются для аудита и пересчёта
  opponentRating Decimal? @db.Decimal(8,2)
  kFactor        Decimal? @db.Decimal(5,2)
  tFactor        Decimal? @db.Decimal(5,2)
  mFactor        Decimal? @db.Decimal(5,2)
  expected       Decimal? @db.Decimal(6,4)

  reason        String?                   // для ручных корректировок
  createdBy     String?
  createdAt     DateTime @default(now())

  player        Player @relation(fields: [playerId], references: [id])

  @@index([playerId, createdAt(sort: Desc)])
  @@index([tournamentId])
}

enum RatingEventType { MATCH BONUS INITIAL MANUAL_ADJUST RECALC }  // BONUS — бонус призёру, ADR-069

// ============ Финансы ============

model Transaction {
  id           String   @id @default(uuid())
  clubId       String
  type         TransactionType
  amount       Decimal  @db.Decimal(12,2)
  balanceAfter Decimal  @db.Decimal(12,2)
  tournamentId String?
  description  String
  createdAt    DateTime @default(now())

  club         Club @relation(fields: [clubId], references: [id])

  @@index([clubId, createdAt(sort: Desc)])
}

enum TransactionType { TOPUP TOURNAMENT_FEE REFUND ADJUSTMENT PAYOUT }

model Tariff {
  id              String  @id @default(uuid())
  name            String
  perParticipant  Int                       // тенге за участника
  perTournamentCap Int?                     // потолок за турнир
  monthlyFee      Int?                      // подписка
  isDefault       Boolean @default(false)
}

// ============ Аномалии рейтинга ============

model RatingAnomaly {
  id          String   @id @default(uuid())
  playerId    String
  matchId     String?
  type        AnomalyType
  severity    Int                           // 1-10
  details     Json
  status      AnomalyStatus @default(OPEN)
  reviewedBy  String?
  reviewNote  String?
  createdAt   DateTime @default(now())
}

enum AnomalyType {
  LOSS_STREAK_BEFORE_CAPPED
  UPSET_LOSS
  PATTERN_DROP_WIN_RETURN
  UNUSUAL_SCORE
}

enum AnomalyStatus { OPEN REVIEWING CONFIRMED DISMISSED }
```

### 4.2. Конфигурация схемы турнира

Поле `Tournament.formatConfig` — JSON, валидируется Zod-схемой из `kttf-shared`.

```typescript
type FormatConfig =
  | { type: 'ROUND_ROBIN'; rounds: 1 | 2; setsToWin: 2 | 3 | 4 }
  // consolation описан, но схема принимает только false: движка утешительной
  // сетки нет, а собирать её в приложении запрещает запрет №2 брифа.
  // Отказ стоит при создании турнира, а не при жеребьёвке — ADR-024.
  | {
      type: 'KNOCKOUT';
      setsToWin: 2 | 3 | 4;
      playoffSetsToWin?: PlayoffSetsToWin;
      thirdPlace: boolean;
      consolation: boolean;
    }
  | {
      type: 'GROUPS_KNOCKOUT';
      groupCount?: number;
      groupSize?: number;
      advancePerGroup: number;
      // Кругов в группе. Необязателен при записи, по умолчанию один:
      // турниры, созданные до появления поля, читаются дальше.
      groupRounds: 1 | 2;
      groupSetsToWin: 2 | 3 | 4;
      koSetsToWin: 2 | 3 | 4;
      playoffSetsToWin?: PlayoffSetsToWin;
      thirdPlace: boolean;
      // Не вышедшие из групп играют сетку за места — этап CONSOLATION
      // после плей-офф (ADR-045). По умолчанию false: прежние турниры
      // играются как раньше.
      exitBracket: boolean;
    }
  | {
      type: 'GROUPS_FINAL_GROUPS';
      groupCount?: number;
      groupSize?: number;
      advancePerGroup: number;
      // Одно поле на оба этапа, как и setsToWin у этой схемы.
      groupRounds: 1 | 2;
      // Финалы по местам: k-я группа — занявшие k-е место в своей группе.
      // Поэтому finalGroupCount === advancePerGroup, это проверяет схема.
      finalGroupCount: number;
      setsToWin: 2 | 3 | 4;
    };

// Длина встреч по кругам плей-офф — ADR-044. Всё необязательно: не заданный
// круг играется общей длиной плей-офф. Какой встрече какая длина — правило
// playoffSetsToWin в brackets, по кругу и позиции встречи.
type PlayoffSetsToWin = Partial<
  Record<
    'final' | 'thirdPlace' | 'semifinal' | 'quarterfinal' | 'roundOf16' | 'roundOf32' | 'roundOf64',
    2 | 3 | 4
  >
>;

type SeedingConfig = {
  method: 'RATING' | 'RANDOM' | 'MANUAL';
  separateByClub: boolean;
};
```

---

## 5. Движок рейтинга

Директория `src/rating` репозитория `kttf-shared`. Чистые функции, ноль зависимостей. Формула версии 3.0 — формула RTTF; обоснование в `02-requirements.md`, раздел 7, и в `06-decisions.md`, ADR-069. Уровни 1–10 — ADR-070.

### 5.1. Контракт

```typescript
export type ResultType = 'NORMAL' | 'WALKOVER' | 'RETIRED';

/** Игрок на момент старта турнира. Рейтинги зафиксированы, см. 5.4. */
export interface PlayerSnapshot {
  rating: number;
  ratedMatches: number;
  /** Сыграно рейтинговых турниров. Меньше пяти — новичок. */
  ratedTournaments: number;
}

export interface MatchInput {
  winner: PlayerSnapshot;
  loser: PlayerSnapshot;
  winnerSets: number;
  loserSets: number;
  /** Коэффициент турнира k = tournamentFactor(средний рейтинг участников). */
  tournamentFactor: number;
  resultType: ResultType;
}

export interface MatchOutput {
  winnerDelta: number; // >= 0
  loserDelta: number; // <= 0
  /** winnerDelta + loserDelta. Ненулевой только когда во встрече новичок. */
  imbalance: number;
  factors: { base; tournamentFactor; kWinner; kLoser; dWinner; dLoser };
}

export function calculateMatch(input: MatchInput): MatchOutput;
export function applyDelta(rating: number, delta: number): { rating; appliedDelta; clamped };

/** Турнир целиком: встречи, затем бонусы призёрам. */
export function calculateTournamentRating(input: {
  players: ReadonlyMap<string, { atStart: PlayerSnapshot; current: PlayerSnapshot }>;
  matches: readonly RatedMatch[];
  placements: readonly { playerId: string; place: number }[];
}): { events; players; averageRating; tournamentFactor; imbalance };

/** Уровень 1–10. */
export function ratingLevel(rating: number): RatingLevel;
```

`players` обязан содержать **всех** участников в зачёте, а не только сыгравших: по ним считаются средний рейтинг (k), число участников и топ-12 для бонуса.

### 5.2. Константы

```typescript
export const GAP_ZERO = 100;
export const DELTA_DIVISOR = 10;
export const MIN_RATING = 1;
export const START_RATING = 250;

export const NOVICE_TOURNAMENTS = 5;
export const NOVICE_K_WIN = 1;
export const NOVICE_K_LOSS = 0.5;
export const NOVICE_SCORE_MULTIPLIER = 1;

// k по среднему рейтингу: < 250 → 0.2, < 350 → 0.25, < 450 → 0.3, < 550 → 0.35, иначе 0.4
export const TOURNAMENT_FACTOR = [...];
export const TOURNAMENT_FACTOR_TOP = 0.4;

export const SCORE_MULTIPLIER = { ONE_SET: 0.8, TWO_SETS: 1.0, THREE_PLUS: 1.2 };

export const BONUS_MIN_PARTICIPANTS = 16;
export const BONUS_TOP_PLAYERS = 12;
// < 100 → 2.5/1.5/1 %, < 150 → 2/1/0.5 %, ≤ 200 → 1/0.5/0 %
export const BONUS_PERCENT = [...];
```

Значения — с первоисточника RTTF, калибровке не подлежат.

### 5.3. Реализация

```
base = max(0, (GAP_ZERO − (R_победителя − R_проигравшего)) / DELTA_DIVISOR)

k, D обычного игрока = коэффициент турнира, коэффициент счёта
k, D новичка         = 1 при победе / 0.5 при поражении, D = 1

winnerDelta =  round2(base × k_победителя  × D_победителя)
loserDelta  = −round2(base × k_проигравшего × D_проигравшего)
```

**Когда новичков во встрече нет, множители совпадают, и дельты в точности противоположны.** Замкнутость не требует отдельного кода и не ломается округлением.

При `resultType !== 'NORMAL'` обе дельты равны нулю. При разрыве 100 и более в пользу победителя `base = 0` — тоже, в том числе у новичков.

**Бонус призёрам** считается после всех встреч от рейтинга на старте: `round2(rating × percent / 100)`, где `percent` уже поделён между делящими место. Бонус меньше сотой не пишется. Событие журнала `BONUS` без встречи; `place` и процент — в `reason`.

**Счётчики.** `ratedMatches` растёт на каждую рейтинговую встречу, `ratedTournaments` — на единицу, если в турнире сыграна хотя бы одна. Бонус счётчиков не двигает. `isProvisional` в проекции игрока означает «новичок».

### 5.4. Фиксация рейтингов на старте турнира

Все встречи турнира считаются против рейтингов, зафиксированных при переходе турнира в статус `RUNNING`.

**Модель данных.** Поля `Registration`:

```prisma
ratingAtStart      Decimal? @db.Decimal(8,2)   // снимок на момент старта турнира
matchesAtStart     Int?                        // ratedMatches на тот же момент
tournamentsAtStart Int?                        // ratedTournaments на тот же момент, ADR-069
```

Без этих полей корректность недостижима: движок обязан получить снимок, а не текущее значение игрока, иначе результат зависит от порядка обработки встреч и локальный расчёт консоли разойдётся с серверным.

Следствия:

- Расчёт идемпотентен и повторяем — пересчёт турнира даёт тот же результат
- Порядок обработки встреч не влияет ни на что
- Консоль в офлайне имеет все нужные данные в снимке турнира

### 5.5. Обязательные инварианты (тесты)

1. **Замкнутость без новичков.** Если оба игрока сыграли не меньше пяти турниров, `winnerDelta + loserDelta === 0` при любых входных данных.
2. **Знаки.** `winnerDelta >= 0` и `loserDelta <= 0` всегда.
3. **Разрыв.** При `winnerRating - loserRating >= GAP_ZERO` обе дельты равны нулю.
4. **Техническая победа.** При `resultType !== 'NORMAL'` обе дельты равны нулю.
5. **Непрерывность.** База непрерывна: при разрыве 99.99 близка к нулю, скачка у отметки 100 нет.
6. **Сенсация.** Победа снизу вверх даёт тем больше, чем больше разрыв, монотонно и без потолка.
7. **Отсечка.** Рейтинг никогда не опускается ниже `MIN_RATING`; при срабатывании `clamped === true` и `appliedDelta` отличается от запрошенной.
8. **Идемпотентность пересчёта.** Пересчёт всей истории `RatingEvent` даёт то же значение, что инкрементальный расчёт.
9. **Округление не создаёт очков.** Для пар обычных игроков сумма дельт по произвольной длинной серии встреч в точности равна нулю.
10. **Вброс только от новичков и бонусов.** Ненулевой `imbalance` встречи означает, что в ней новичок.
11. **Совпадение с первоисточником.** Примеры из правил RTTF (500 над 450 при k = 0.3 и 3:1 → ±1.5; 450 над 500 при 3:2 → ±3.6) дают те же числа до сотых.

### 5.6. Метрика инфляции

Каналов, по которым в систему попадает рейтинг, два: новички и бонусы призёрам. Отсечка по минимуму — третий, механический. Они обязаны быть под наблюдением:

- Сумма всех `imbalance` за период — совокупный вброс (новичок может дать и отрицательный: проигравший новичок теряет больше, чем получает соперник)
- Сумма рейтингов системы, разложенная на замкнутую часть и накопленный вброс
- Алерт при отклонении вброса от прогноза (прогноз выводится из числа новых игроков и турниров с бонусами)

## 6. Офлайн-режим консоли

### 6.1. Принцип

Консоль загружает полный снимок турнира в IndexedDB и дальше работает автономно. Все действия пишутся в локальную БД и одновременно в очередь исходящих операций.

### 6.2. Структура локального хранилища

```typescript
// Dexie
db.version(1).stores({
  snapshots: 'tournamentId',
  outbox: '++seq, tournamentId, syncedAt, [tournamentId+syncedAt]',
});

interface OutboxItem {
  seq: number; // автоинкремент, порядок применения
  tournamentId: string;
  clientOpId: string; // UUID, идемпотентность
  type:
    | 'MATCH_RESULT'
    | 'MATCH_ASSIGN'
    | 'MATCH_CANCEL'
    | 'MATCH_EDIT'
    | 'TIE_DECISION'
    | 'PLAYER_WITHDRAW';
  payload: unknown;
  createdAt: number;
  syncedAt: number | null;
  rejectedReason: string | null; // код отказа сервера, ТС 7.8
  attempts: number;
}
```

**Снимок хранится целиком, а не разложенным по таблицам.** Первая редакция раскладывала его на `tournaments`, `matches`, `registrations` и `players`, но консоль читает снимок только целиком: раскладка потребовала бы собирать его обратно при каждом чтении и раскладывать заново после каждой синхронизации, а сервер и так присылает готовый объект. Обоснование — ADR-027.

Очередь осталась отдельной таблицей: у неё своя жизнь, свой порядок и свой признак отправленного.

### 6.3. Синхронизация

```
POST /api/v1/tournaments/:id/sync
{
  "lastServerVersion": 142,
  "operations": [
    { "clientOpId": "uuid", "seq": 1, "type": "MATCH_RESULT", "payload": {...} },
    ...
  ]
}

→ 200 OK
{
  "serverVersion": 148,
  "applied": ["uuid1", "uuid2"],
  "rejected": [{ "clientOpId": "uuid3", "reason": "MATCH_ALREADY_FINISHED" }],
  "snapshot": { ... }        // актуальное состояние турнира
}
```

**Правила:**

- Операции применяются строго по `seq`
- `clientOpId` обеспечивает идемпотентность: повторная отправка не создаёт дубль. Журнал применённых операций — таблица `SyncOperation`
- **Конфликт разрешается по правилу «последняя запись побеждает»**: позднейшая по `seq` операция перекрывает раннюю, право проверяется тем же guard'ом, что и у онлайн-маршрутов. Модель `RefereeSession` не заводится — обоснование в ADR-026
- `lastServerVersion` ничего не блокирует: она записывается в журнал и отвечает на вопрос, против какого состояния судья вводил операцию
- Отклонённая операция не останавливает пачку: остальные применяются, отказ приходит списком `rejected`
- При отклонении операции консоль показывает уведомление и подтягивает актуальный снимок
- Синхронизация запускается: при восстановлении сети, каждые 15 секунд при наличии сети, вручную

**`TIE_DECISION` в перечне операций** появился после того, как выяснилось: без него турнир со схемой «группы плюс сетка» в зале без сети не закрыть. Равенство очков в круговой на четверых возникает регулярно, разрешает его судья (ADR-008), и пока оно не разрешено, места не определены и плей-офф не достраивается. Требование ТЗ 6.4 «турнир на 32 участника целиком без интернета» без этого типа невыполнимо.

### 6.4. Индикация

Постоянный индикатор в интерфейсе консоли:

- 🟢 Онлайн, всё синхронизировано
- 🟡 Онлайн, синхронизируется (N операций в очереди)
- 🔴 Офлайн (N операций в очереди)

Кнопка «Синхронизировать сейчас» всегда доступна.

---

## 7. API

REST, версионирование через префикс `/api/v1`. Формат — JSON. Аутентификация — Bearer JWT.

### 7.1. Аутентификация

```
POST   /api/v1/auth/login            { identifier, password } → { accessToken, refreshToken, user }
POST   /api/v1/auth/sign-up          { login, password, phone, playerId? } → то же
POST   /api/v1/auth/refresh          { refreshToken }
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
PATCH  /api/v1/auth/me               { login?, email?, locale?, telegramId? } → user
POST   /api/v1/auth/change-password  { currentPassword, newPassword } → { accessToken, refreshToken }
```

**Настройки аккаунта отделены от профиля игрока** — ADR-035. `null` в поле `PATCH /auth/me` очищает его, отсутствие поля не трогает. Смена пароля обрывает остальные сессии и выдаёт новую пару токенов взамен. Телефон не меняется ни тем, ни другим: подтверждать владение новым номером нечем (ADR-034).

### 7.2. Игроки

```
GET    /api/v1/players               ?search&cityId&clubId&withoutAccount&coachesOnly&page&limit
GET    /api/v1/players/:id
PATCH  /api/v1/players/:id
GET    /api/v1/players/:id/rating-history   ?from&to
GET    /api/v1/players/:id/matches          ?page&limit
GET    /api/v1/players/:id/head-to-head/:opponentId
GET    /api/v1/players/:id/summary          ?period=QUARTER|HALF|YEAR|ALL
GET    /api/v1/players/:id/best-wins        ?period=QUARTER|HALF|YEAR|ALL
GET    /api/v1/players/:id/tournaments      ?page&limit
POST   /api/v1/players                      # создание организатором
```

**Сводка и результаты профиля — ADR-048, ADR-050.** `summary` — место в рейтинге страны, максимальный рейтинг и дата его первого достижения (`maxRatingAt`), турниры, победы и поражения, первый турнир, частый клуб и призовые места с клубом; место, максимум, первый турнир и награды — за всё время, остальное — за период. `best-wins` — до пяти побед над самыми сильными соперниками за свой период: оба рейтинга на момент встречи из журнала, время вызова к столу, длительность в минутах. `tournaments` — турниры игрока свежими сверху: уровень, место (`place`–`placeTo` у делённого), участников, рейтинг до и после, изменение и встречи с кругом сетки от финала (`roundFromFinal`, `0` — финал), временем вызова, длительностью, своим рейтингом до встречи и рейтингом соперника (из журнала, до обсчёта — на старте турнира). Длительность — `finishedAt − startedAt`, `null` без вызова к столу.

**Последнее посещение — ADR-050.** Глобальный перехватчик пишет `User.lastSeenAt` на запросах с проверенным токеном не чаще раза в пять минут. `GET /players/:id` отдаёт `lastSeenAt` и `online` (посещение за последние пять минут); краткий вид игрока их не несёт.

**Полную дату рождения видят сам игрок и организаторы его клуба** — ADR-037. Остальным она не приходит вовсе: маршрут берёт токен необязательным, а скрытая дата неотличима от незаполненной.

**Два вида игрока в ответах.** Списки, состав турнира, история встреч и снимок консоли несут краткий вид без анкеты; `GET /players/:id`, `POST /players` и `PATCH /players/:id` отдают полный профиль вместе с анкетой ТЗ 2.2. Обоснование — ADR-035: анкета каждого участника раздула бы офлайн-снимок судьи.

`null` в поле `PATCH /players/:id` очищает его, отсутствие поля не трогает. Обязательные поля очистить нельзя.

### 7.3. Рейтинги

```
GET    /api/v1/ratings               ?cityId&clubId&gender&birthYearFrom&birthYearTo&page
GET    /api/v1/ratings/top           ?limit=100
```

### 7.4. Клубы

```
GET    /api/v1/clubs                 ?cityId&search
GET    /api/v1/clubs/:id
POST   /api/v1/clubs                          # только администратор платформы, ADR-049
PATCH  /api/v1/clubs/:id                     # null у необязательного поля — стереть (ADR-043)
GET    /api/v1/clubs/:id/members
POST   /api/v1/clubs/:id/members             # { identifier: логин | телефон, role } (ADR-043)
DELETE /api/v1/clubs/:id/members/:userId
GET    /api/v1/clubs/:id/balance
GET    /api/v1/clubs/:id/transactions ?from&to&page
```

### 7.4а. Справочник стран и городов

```
GET    /api/v1/countries                          # только доступные
GET    /api/v1/cities                ?countryId   # доступные: город и страна не скрыты
GET    /api/v1/admin/countries                    # со скрытыми, только администратор
POST   /api/v1/admin/countries       { code, name, nameKk?, sortOrder? }
PATCH  /api/v1/admin/countries/:id   { code?, name?, nameKk?, sortOrder?, isActive? }
GET    /api/v1/admin/cities          ?countryId
POST   /api/v1/admin/cities          { countryId, name, nameKk?, sortOrder? }
PATCH  /api/v1/admin/cities/:id      { name?, nameKk?, sortOrder?, isActive? }
```

ADR-046. Удаления нет: скрытая запись не предлагается в формах, но остаётся у клубов и игроков, у которых уже указана. Клуб и игрок принимают `cityId`, недоступный город — `CITY_UNAVAILABLE`, дубликат кода страны или названия города в стране без учёта регистра — `PLACE_ALREADY_EXISTS`. В ответах город — объект `{ id, name, nameKk }`.

Маршруты `/admin/*` закрыты guard'ом администратора: признак `User.isAdmin` читается из базы на каждый запрос. Роль выдаётся скриптом `pnpm set-admin <телефон|логин> [--revoke]`, маршрута для этого нет.

### 7.4б. Заявки клубов

```
POST   /api/v1/club-applications              { name, contact, clubName, city, address?, tableCount?, tournaments?, message?, website? }  → 204
GET    /api/v1/admin/club-applications        ?status&page&limit   # свежие сверху, только администратор
PATCH  /api/v1/admin/club-applications/:id    { status: NEW | DONE }
```

ADR-047. Отправка открыта всем, токен необязателен: вошедший привязывается к заявке. `website` — ловушка для ботов: заполнена — ответ тот же 204, заявка не сохраняется. Больше пяти заявок в час с одного адреса — `RATE_LIMITED` (429); адрес — последний элемент `X-Forwarded-For` от Caddy, в базе только его HMAC. `DONE` ставит `handledAt`, возврат в `NEW` его снимает.

### 7.4в. Тренеры и тренировки

```
GET    /api/v1/coaches                          ?search&cityId&language&page&limit   # опубликованные
GET    /api/v1/coaches/by-slug/:slug            # публичная; непубличную — владелец и администратор
GET    /api/v1/trainings                        ?kind&audience&age&place&clubId&cityId&priceTo&language&day&time&open&page&limit   # блоками по месту
GET    /api/v1/trainings/:id                    # «Подробнее»: тренировка и другие у того же владельца
GET    /api/v1/clubs/:id/trainings              # свои и подтверждённые тренерские
GET    /api/v1/clubs/:id/trainings/manage       # OWNER, ORGANIZER: свои, входящие, подтверждённые
PUT    /api/v1/clubs/:id/trainings              { trainings }   # OWNER, ORGANIZER
POST   /api/v1/trainings/:id/confirm            # вторая сторона: клуб или тренер
POST   /api/v1/trainings/:id/decline            # отказ или разрыв связи
POST   /api/v1/coaches/:id/events               { kind, source } → 204
GET    /api/v1/coaches/:id/credentials/:credentialId/file   # скан документа

POST   /api/v1/coaches                          # своя страница из профиля игрока, DRAFT
GET    /api/v1/coaches/:id
PATCH  /api/v1/coaches/:id                      # null — стереть
PUT    /api/v1/coaches/:id/trainings            { trainings }   # свои; «в клубе» — clubId или venueName+venueAddress
PUT    /api/v1/coaches/:id/credentials          { credentials }   # id строки сохраняет отметку «проверено»
PUT    /api/v1/coaches/:id/achievements         { achievements }
POST   /api/v1/coaches/:id/reviewed             # «Всё актуально»
POST   /api/v1/coaches/:id/submit               # на проверку: COACH_INCOMPLETE, COACH_STATUS_INVALID
GET    /api/v1/coaches/:id/stats                ?days
POST   /api/v1/files/coaches/:id                multipart file → { url, width, height }
POST   /api/v1/files/coach-docs/:id             multipart file → { url }

GET    /api/v1/clubs/:id/staff                  # штаб: ACTIVE с опубликованной страницей
GET    /api/v1/clubs/:id/staff/manage           # OWNER, ORGANIZER: состав, приглашённые, запросы
POST   /api/v1/clubs/:id/staff                  { coachId, position? }   # клуб приглашает
PATCH  /api/v1/clubs/:id/staff/:coachId         { position }
POST   /api/v1/coaches/:id/clubs                { clubId, position? }    # тренер просится
POST   /api/v1/club-coaches/:clubId/:coachId/confirm   # вторая сторона
DELETE /api/v1/club-coaches/:clubId/:coachId           # любая сторона
GET    /api/v1/coaches/:id/students             # ученики: числа, топ с 14 лет, медали, рост
GET    /api/v1/coaches/:id/students/manage      ?page&limit   # владелец: все текущие
DELETE /api/v1/coaches/:id/students/:playerId   # тренер убирает ссылку на себя
POST   /api/v1/coaches/:id/students/me          # «Я ученик»
DELETE /api/v1/coaches/:id/students/me          # больше не ученик

GET    /api/v1/coaches/:id/posts             ?archive&page&limit   # публичные; /posts/all — владельцу
POST   /api/v1/coaches/:id/posts             { kind, title, body, imageUrl?, validUntil? }
PATCH  /api/v1/coaches/:id/posts/:postId     # и pinned
DELETE /api/v1/coaches/:id/posts/:postId
GET    /api/v1/coaches/:id/media             # публичные; /media/all — владельцу
POST   /api/v1/coaches/:id/media/photos      multipart file
POST   /api/v1/coaches/:id/media/videos      { url, caption? }
PUT    /api/v1/coaches/:id/media/order       { ids }
PATCH  /api/v1/coaches/:id/media/:mediaId    { caption }
DELETE /api/v1/coaches/:id/media/:mediaId
GET    /api/v1/admin/coach-content           ?page&limit   # лента для модерации
PATCH  /api/v1/admin/coach-content/posts/:postId   { hidden, reason? }
PATCH  /api/v1/admin/coach-content/media/:mediaId  { hidden, reason? }

GET    /api/v1/admin/coaches                    ?status&page&limit
POST   /api/v1/admin/coaches/:id/approve
POST   /api/v1/admin/coaches/:id/reject         { reason }
PATCH  /api/v1/admin/coaches/:id/hidden         { hidden, reason? }
PATCH  /api/v1/admin/coaches/:id/credentials/:credentialId   { verified }
```

ADR-059, `docs/11`. Владелец страницы — `Coach.userId`; чужой получает `FORBIDDEN`, администратор правит любую (в кабинете — `/cabinet/coach?id=`). Маршруты администратора отвечают `CoachApplicationView`. Общая выдача `GET /files/:folder/:name` папку `coach-docs` не отдаёт. Публичны только `APPROVED` и не скрытые. Схемы — `src/types/coach.ts`.

### 7.5. Турниры

```
GET    /api/v1/tournaments           ?cityId&clubId&playerId&status&from&to&order&page   # playerId — «Мои турниры», ADR-048; status — один или через запятую, ADR-051; order=asc|desc, ADR-052
POST   /api/v1/tournaments
GET    /api/v1/tournaments/:id
PATCH  /api/v1/tournaments/:id
DELETE /api/v1/tournaments/:id
POST   /api/v1/tournaments/:id/duplicate      # «повторить прошлый»

POST   /api/v1/tournaments/:id/publish
POST   /api/v1/tournaments/:id/open-registration
POST   /api/v1/tournaments/:id/close-registration
POST   /api/v1/tournaments/:id/draw           # жеребьёвка
POST   /api/v1/tournaments/:id/draw/swap      # обмен двумя игроками, ТЗ 5.3 (ADR-033)
POST   /api/v1/tournaments/:id/start
POST   /api/v1/tournaments/:id/finish
POST   /api/v1/tournaments/:id/cancel

GET    /api/v1/tournaments/:id/registrations
POST   /api/v1/tournaments/:id/registrations  # запись игрока
DELETE /api/v1/tournaments/:id/registrations/:id
PATCH  /api/v1/tournaments/:id/registrations/:id  # статус, вне зачёта, посев

GET    /api/v1/tournaments/:id/snapshot       # полное состояние для консоли
POST   /api/v1/tournaments/:id/sync           # синхронизация офлайн-операций

GET    /api/v1/tournaments/:id/standings      # таблицы и места
POST   /api/v1/tournaments/:id/tie-decisions  # решение судьи по равенству, ADR-008
GET    /api/v1/tournaments/:id/results        # публичные результаты
```

**Правка идущего турнира — ADR-061.** `PATCH /tournaments/:id` в статусе `RUNNING` принимает только `tableCount`, `description` и `formatConfig`, отличающийся от прежнего одними длинами встреч (`setsToWin`, `groupSetsToWin`, `koSetsToWin`, `playoffSetsToWin`). Остальное — `FORBIDDEN`, как и любая правка после завершения. Стол, за которым идёт встреча, не убрать — `TABLE_BUSY`. Длина меняется только у не начатых встреч: если правка задевает начатую или сыгранную, отказ `MATCH_LENGTH_LOCKED` с `details.matchIds`. Принятые длины ложатся и в `formatConfig`, и в `Stage.config` построенных этапов. Жеребьёвка не сбрасывается.

**Снятие по ходу турнира — ADR-061.** `PATCH /tournaments/:id/registrations/:id` со статусом `WITHDRAWN` или `NO_SHOW` после старта лист ожидания не трогает. В той же транзакции достраивается плей-офф, если группам больше нечего доигрывать, а встречам сетки, где снявшийся встречает известного соперника, записывается техническая победа соперника. `CONFIRMED` после старта возвращает в игру только участника расстановки (статус становится `PLAYING`), иначе `VALIDATION_FAILED`. Тем же путём идёт операция синхронизации `PLAYER_WITHDRAW`.

**Поздняя запись и замена — ADR-062.** `POST /tournaments/:id/registrations` с чужим `playerId` организатор шлёт и после закрытия записи, и после старта (`REG_CLOSED`, `RUNNING`, `REG_OPEN` после дедлайна). Без жеребьёвки игрок просто встаёт в состав. После неё — в группу текущего этапа: `groupId` в теле или самая малая (из равных — самая слабая) группа, со встречами со всеми в ней; после старта запись сразу `PLAYING` со снимком рейтинга. Следующий этап построен или идёт сетка — `LATE_ENTRY_CLOSED` (409) с `details.reason`. `POST /tournaments/:id/registrations/:id/replace { playerId }` ставит нового игрока на место заменённого: встречи и посев переходят к нему, заменённый — `WITHDRAWN`. Заменённый уже сыграл — `REPLACEMENT_LOCKED` (409).

**Оплата — ADR-062.** `PATCH /tournaments/:id/registrations/:id { paid }` ставит и снимает отметку «Оплатил» (`Registration.paidAt`), каждое изменение — в `AuditLog` (`registration.paid`). `RegistrationView.paid` — `true`/`false` организатору клуба, `null` остальным.

**Стартовый рейтинг — ADR-062.** `POST /players` принимает `startRating` (100–1000, кратно 25) — только для профиля, который организатор заводит другому человеку в своём клубе. Проекция получает это значение, журнал — событие `INITIAL` от 250.

**Правило равенства — ADR-062.** `formatConfig.tieBreak` у схем с таблицами: `SET_DIFF` (по умолчанию, ТЗ 6.6) или `SET_RATIO` (после личной встречи — только отношение сетов среди равных). Жеребьёвка кладёт его в `Stage.config`.

**Список турниров — календарь и список, ADR-052.** Элемент списка несёт сверх вида турнира `averageRating` (средний рейтинг участников, целое, `null` без участников) и `matchesPlayed` (сыгранные встречи). `order` задаёт порядок по дате старта, при равной дате — по идентификатору: страницы не переставляют турниры одного часа.

### 7.6. Встречи

```
GET    /api/v1/matches/:id
POST   /api/v1/matches/:id/assign     { tableNumber }
POST   /api/v1/matches/:id/result     { setsA, setsB, setScores?, resultType }
POST   /api/v1/matches/:id/cancel
PATCH  /api/v1/matches/:id            # корректировка результата
```

`result`, `cancel` и `PATCH` возвращают не только саму встречу:

```typescript
type MatchUpdateResult = {
  match: MatchView;
  updated: MatchView[]; // встречи, чей состав изменился следом (ADR-019)
  nextStage: StageView | null; // плей-офф, достроенный по итогам групп (ADR-020)
  blockedByTies: string[]; // группы, где равенство не разрешено судьёй
};
```

`cancel` возвращает встречу в очередь: снимаются результат и стол, статус
`CANCELLED` при этом не выставляется — ТЗ 6.3, ADR-021.

`MatchView` несёт `startedAt` и `finishedAt` — момент выхода на стол и момент
закрытия. Они нужны консоли: очередь сортируется по тому, кто дольше не играл
(ТЗ 6.1), а подсказка «ждёт дольше всех» (ТЗ 6.3) без времени не существует.
Вывести их из порядка встреч нельзя — он описывает сетку, а не зал.

Правка отклоняется кодом `DOWNSTREAM_MATCH_PLAYED`, если на этом результате
держится уже сыгранная встреча ниже по сетке либо плей-офф, в котором играли.

`assign` проверяет стол (ADR-061): номер больше `tableCount` — `TABLE_OUT_OF_RANGE`
(400), за столом идёт другая встреча — `TABLE_BUSY` (409). Стол с закрытой
встречей свободен. Ввод, правка и отмена результата заодно записывают
технические победы за снявшихся, которых продвижение посадило напротив
известного соперника, — они приходят в `updated`.

### 7.7. Публичный экран

```
GET    /api/v1/public/screen/:publicToken           # без авторизации
GET    /api/v1/public/screen/:publicToken/stream    # поток SSE, без авторизации
```

Состояние несёт `withdrawn` — идентификаторы снявшихся и не явившихся (ADR-061): экран убирает их встречи из «Кто следующий» тем же правилом, что и консоль.

Поток отдаёт события `state` — состояние экрана целиком, тем же телом, что и первый маршрут, — и `ping` каждые 25 секунд, чтобы посредники не закрывали молчащее соединение.

Вебсокета здесь нет: поток односторонний, экран зала ничего не отправляет. Обоснование и отменённый вариант `WS /ws/screen/:publicToken` — ADR-025.

### 7.8. Ответы об ошибках

Единый формат:

```json
{
  "error": {
    "code": "TOURNAMENT_ALREADY_STARTED",
    "message": "Турнир уже начат, изменение состава невозможно",
    "details": { "tournamentId": "..." }
  }
}
```

Коды ошибок — строковые константы из `kttf-shared`, локализуются на клиенте.

### 7.9. Файлы

```
POST   /api/v1/files/player-photo    multipart, поле file → { url }
GET    /api/v1/files/:folder/:name
```

Загрузка под входом, чтение открыто: фото игрока видно на публичной странице. Файл идёт **через API**, а не предподписанной ссылкой в MinIO — ADR-036: подпись S3 несёт в себе имя хоста, а у хранилища оно внутри сети и снаружи разное.

Принимаются JPEG, PNG и WebP до 5 МБ. Правило одно на форму и на сервер — функция `rejectPhoto` в общем коде, по образцу допуска на турнир (ADR-029). Ключ файла — папка, UUID и расширение по типу содержимого: имя файла от клиента в него не попадает.

Логотип клуба и фото зала (ТЗ 3.1) этим маршрутом пока не закрыты.

---

## 8. Нефункциональные требования

### 8.1. Производительность

| Метрика                                   | Требование                   |
| ----------------------------------------- | ---------------------------- |
| Время ответа API, p95                     | < 200 мс                     |
| Время ответа API, p99                     | < 500 мс                     |
| Обсчёт рейтинга турнира на 32 участника   | < 5 с                        |
| Первая отрисовка публичной страницы (LCP) | < 2 с на 3G                  |
| Отклик кнопки ввода счёта в консоли       | < 50 мс (локально, без сети) |
| Размер чанков модуля консоли              | < 400 КБ gzip                |

Фронтенд единый (раздел 3), поэтому бюджет относится к **набору лениво загружаемых чанков консоли**, а не ко всей сборке. Считается замыкание: сами маршруты консоли и всё, что они импортируют, включая общий чанк приложения. Проверяется автоматически на каждом прогоне тестов (ADR-032): превышение — красный прогон, а не замечание в ревью.

**Ключевое:** ввод счёта в консоли не должен ждать сети никогда. Оптимистичное обновление обязательно.

**Второе ключевое:** чанки консоли обязаны быть в Workbox precache. Ленивый чанк без предзагрузки в офлайне недоступен — судья откроет консоль в зале без сети и получит пустой экран. Это самый вероятный способ сломать офлайн-режим в единой сборке, и он закрыт автотестом `kttf-front/src/app/precache.test.ts` (ADR-032).

### 8.2. Доступность

- Целевой аптайм: 99.5% (допустимо ~3,6 часа простоя в месяц)
- Плановые работы — только в интервале с 02:00 до 06:00 по времени Астаны
- Турниры чаще всего идут вечером — деплой в это время запрещён

### 8.3. Безопасность

- Все соединения по HTTPS, TLS 1.3
- Пароль хранится как `scrypt` с солью на пользователя (ADR-034). Смена пароля требует текущего и обрывает остальные сессии (ADR-035)
- Rate limiting (ADR-056): 100 запросов API в минуту на пользователя, без входа — 600 в минуту на адрес (в зале все за одним Wi-Fi). Картинки, экран зала и проверка здоровья вне предела. Вход: 10 неудач за 15 минут на логин или телефон и 20 — на адрес, сверх предела отказ без сверки пароля. Заявка клуба — свой предел, пять в час с адреса (ADR-047). Счётчики в памяти API: при нескольких экземплярах переедут в Redis
- Ролевая модель проверяется на уровне guard'ов, не на уровне интерфейса
- Персональные данные шифруются at rest средствами БД
- Журнал действий: все изменения рейтинга, финансовые операции, изменения результатов
- Публичные токены второго экрана — 32 символа, ротация по требованию клуба

### 8.4. Соответствие законодательству

- Хранение персональных данных граждан РК на серверах, физически размещённых в РК
- Согласие на обработку персональных данных при регистрации
- Возможность удаления аккаунта с анонимизацией истории (результаты матчей сохраняются обезличенно — они спортивный факт)
- Отдельное согласие законного представителя для игроков младше 18 лет

### 8.5. Наблюдаемость

- Все ошибки — в Sentry с контекстом пользователя и турнира
- Метрики: количество активных турниров, операций синхронизации, отказов оплаты
- Алерты: падение API, рост ошибок синхронизации, застрявшая очередь обсчёта рейтинга

---

## 9. Порядок разработки

### Спринт 0 — фундамент

- Монорепозиторий, линтеры, форматтер, CI
- Схема Prisma, первые миграции
- Docker Compose для локальной разработки
- Аутентификация: вход по логину и паролю (ADR-034)
- Базовый деплой на staging

### Спринт 1 — движки

- `kttf-shared/src/rating` с полным тестовым покрытием
- `kttf-shared/src/brackets`: круговая, олимпийка, группы + плей-офф
- Расчёт таблиц и разрешение равенства очков
- Тесты на реальных турнирных данных

### Спринт 2 — CRUD

- Клубы, игроки, турниры
- Регистрация на турнир
- Публичные страницы: календарь, рейтинги, профиль

### Спринт 3 — консоль судьи (онлайн)

- Экран проведения: столы, очередь, назначение
- Ввод счёта с быстрыми кнопками
- Групповые таблицы в реальном времени
- Второй экран

### Спринт 4 — офлайн

- Локальное хранилище, снимок турнира
- Очередь операций, синхронизация
- Разрешение конфликтов
- **Полевые испытания на реальном турнире с выключенным Wi-Fi**

### Спринт 5 — рейтинг в проде

- Применение рейтинга по завершении турнира
- История рейтинга, графики
- Публикация результатов

### Спринт 6 — подготовка к пилоту

- Локализация: русский, казахский
- PWA, установка на домашний экран
- Административная панель
- Нагрузочное тестирование
- Документация для организатора

**Оплата, уведомления, WTT, CRM клуба — после подтверждения пилота.**

---

## 10. Что запрещено

| Запрет                                              | Причина                                                     |
| --------------------------------------------------- | ----------------------------------------------------------- |
| Хранить рейтинг только как поле без журнала событий | Невозможно пересчитать и разобрать спор                     |
| Требовать сеть для ввода счёта                      | Мы объективно проиграем десктопной программе конкурента     |
| Дублировать логику расчёта на клиенте и сервере     | Расхождения неизбежны, доверие теряется необратимо          |
| Хранить персональные данные вне РК                  | Нарушение законодательства и потеря главного аргумента      |
| Деплоить в вечернее время                           | В это время идут турниры                                    |
| Обязательное поле «отчество»                        | Не соответствует практике именования в РК                   |
| Автоматически банить за аномалию рейтинга           | Ложное срабатывание разрушает отношения с клубом            |
| Добавлять поле «Оплатил» с ручной галочкой          | Это ровно та боль, ради устранения которой делается продукт |
