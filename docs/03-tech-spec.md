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

| Компонент            | Выбор                         |
| -------------------- | ----------------------------- |
| Сборка               | Vite 8                        |
| Библиотека           | React 19 + TypeScript strict  |
| Роутинг              | TanStack Router               |
| Серверное состояние  | TanStack Query                |
| Клиентское состояние | Zustand                       |
| Стили                | Tailwind CSS 4                |
| Компоненты           | shadcn/ui                     |
| Формы                | React Hook Form + Zod         |
| Графики              | Recharts                      |
| Локальное хранилище  | Dexie (IndexedDB)             |
| PWA                  | vite-plugin-pwa (Workbox)     |
| Локализация          | Собственный словарь (ADR-016) |

### 2.3. Мобильное

**MVP:** PWA. Устанавливается на домашний экран, работает офлайн, push через Web Push.

**`[V3]`:** нативные приложения на Expo (React Native) при подтверждённом спросе. Переиспользование бизнес-логики из общих пакетов.

**Обоснование:** нативные приложения на старте — это App Store, Google Play, ревью, релизные циклы и вторая кодовая база при команде из двух человек. PWA закрывает 90% потребностей.

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

| Задача   | Сервис                                    |
| -------- | ----------------------------------------- |
| SMS-коды | Локальный провайдер РК (Mobizon, SMSC.kz) |
| Платежи  | Kaspi Business API, резерв — ePay Halyk   |
| Push     | Web Push (VAPID), позже FCM               |
| Карты    | 2GIS API                                  |

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
- Бюджет `< 400 КБ gzip` (раздел 8.1) относится к **набору чанков консоли**, а не ко всему приложению. Проверяется в CI, а не на глаз
- Тяжёлые зависимости публичной части (графики, карты) не должны попадать в чанки консоли. Нарушение бюджета в CI — красная сборка

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
  phoneVerified Boolean  @default(false)
  email         String?  @unique
  locale        Locale   @default(RU)
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
  birthYear      Int
  gender         Gender
  city           String
  photoUrl       String?
  clubId         String?
  club           Club?    @relation(fields: [clubId], references: [id])

  // Проекция рейтинга (материализованная, источник истины — RatingEvent)
  rating         Decimal  @default(250) @db.Decimal(8,2)
  ratedMatches   Int      @default(0)
  isProvisional  Boolean  @default(true)
  trustScore     Decimal  @default(100) @db.Decimal(5,2)

  registrations  Registration[]
  ratingEvents   RatingEvent[]

  @@index([rating(sort: Desc)])
  @@index([city, rating(sort: Desc)])
  @@index([lastName, firstName])
}

enum Gender { MALE FEMALE }

// ============ Клубы ============

model Club {
  id          String   @id @default(uuid())
  name        String
  shortName   String?
  city        String
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
  createdAt    DateTime @default(now())

  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  player       Player     @relation(fields: [playerId], references: [id])

  @@unique([tournamentId, playerId])
  @@index([tournamentId, status])
}

enum RegistrationStatus {
  REGISTERED WAITLIST CONFIRMED PLAYING WITHDRAWN NO_SHOW
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

enum RatingEventType { MATCH INITIAL MANUAL_ADJUST RECALC }

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
  | { type: 'KNOCKOUT'; setsToWin: 2 | 3 | 4; thirdPlace: boolean; consolation: boolean }
  | {
      type: 'GROUPS_KNOCKOUT';
      groupCount?: number;
      groupSize?: number;
      advancePerGroup: number;
      groupSetsToWin: 2 | 3 | 4;
      koSetsToWin: 2 | 3 | 4;
      thirdPlace: boolean;
    }
  | {
      type: 'GROUPS_FINAL_GROUPS';
      groupCount?: number;
      groupSize?: number;
      advancePerGroup: number;
      // Финалы по местам: k-я группа — занявшие k-е место в своей группе.
      // Поэтому finalGroupCount === advancePerGroup, это проверяет схема.
      finalGroupCount: number;
      setsToWin: 2 | 3 | 4;
    };

type SeedingConfig = {
  method: 'RATING' | 'RANDOM' | 'MANUAL';
  separateByClub: boolean;
};
```

---

## 5. Движок рейтинга

Директория `src/rating` репозитория `kttf-shared`. Чистые функции, ноль зависимостей. Формула версии 2.0 — обоснование в `02-requirements.md`, раздел 7, и в `06-decisions.md`, ADR-003.

### 5.1. Контракт

```typescript
export type TournamentLevel = 'CLUB' | 'REGIONAL' | 'NATIONAL';
export type ResultType = 'NORMAL' | 'WALKOVER' | 'RETIRED';

/** Игрок на момент старта турнира. Рейтинги зафиксированы, см. 5.4. */
export interface PlayerSnapshot {
  rating: number;
  ratedMatches: number;
}

export interface MatchInput {
  winner: PlayerSnapshot;
  loser: PlayerSnapshot;
  winnerSets: number;
  loserSets: number;
  level: TournamentLevel;
  resultType: ResultType;
}

export interface MatchOutput {
  /** Прибавка победителю. Всегда >= 0. */
  winnerDelta: number;
  /** Убавка проигравшему, со знаком. Всегда <= 0. */
  loserDelta: number;
  /** Ненулевой, только если хотя бы один игрок провизорный. winnerDelta + loserDelta. */
  imbalance: number;
  /** Всё, из чего сложился результат. Пишется в RatingEvent для аудита. */
  factors: {
    expectedWinner: number;
    gapMultiplier: number;
    scoreMultiplier: number;
    levelFactor: number;
    kWinner: number;
    kLoser: number;
  };
}

export function calculateMatch(input: MatchInput): MatchOutput;

/** Применение с отсечкой по MIN_RATING. Возвращает фактические значения. */
export function applyDelta(
  rating: number,
  delta: number,
): {
  rating: number;
  appliedDelta: number;
  clamped: boolean;
};
```

### 5.2. Константы

```typescript
export const SCALE = 200;
export const GAP_ZERO = 100;
export const MIN_RATING = 1;
export const START_RATING = 250;
export const PROVISIONAL_THRESHOLD = 20;

export const K_BASE = 20;
export const K_PROV_WIN = 40;
export const K_PROV_LOSS = 20;

export const LEVEL_FACTOR: Record<TournamentLevel, number> = {
  CLUB: 0.8,
  REGIONAL: 1.0,
  NATIONAL: 1.2,
};

export const SCORE_MULTIPLIER = { ONE_SET: 0.8, TWO_SETS: 1.0, THREE_PLUS: 1.2 };
```

Значения стартовые, подлежат калибровке на реальных протоколах до пилота (`02-requirements.md`, 7.5). Все они собраны в одном модуле: калибровка — правка одного файла плюс пересчёт истории из журнала событий.

### 5.3. Реализация

```typescript
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / SCALE));
}

/** Затухание к нулю при разрыве GAP_ZERO в пользу победителя. */
function gapMultiplier(winnerRating: number, loserRating: number): number {
  const gap = Math.max(0, winnerRating - loserRating);
  return Math.max(0, 1 - gap / GAP_ZERO);
}

function scoreMultiplier(winnerSets: number, loserSets: number): number {
  const diff = winnerSets - loserSets;
  if (diff <= 1) return SCORE_MULTIPLIER.ONE_SET;
  if (diff === 2) return SCORE_MULTIPLIER.TWO_SETS;
  return SCORE_MULTIPLIER.THREE_PLUS;
}

function kFactor(player: PlayerSnapshot, won: boolean): number {
  if (player.ratedMatches >= PROVISIONAL_THRESHOLD) return K_BASE;
  return won ? K_PROV_WIN : K_PROV_LOSS;
}
```

Базовая величина встречи считается один раз, `K` применяется к ней отдельно для каждого игрока:

```
base = T × M × G × (1 − E_победителя)

winnerDelta = round2( K_победителя × base )
loserDelta  = −round2( K_проигравшего × base )
```

**Когда оба игрока рейтинговые, `K` совпадает, и дельты в точности противоположны.** Замкнутость не требует отдельного кода и не может сломаться округлением: величина округляется до умножения на знак.

Расхождение возникает **только** если хотя бы один игрок провизорный. Оно возвращается явным полем `imbalance` — не прячется, а измеряется.

При `resultType !== 'NORMAL'` (техническая победа, снятие) `M = 0`, обе дельты равны нулю. При `G = 0` (разрыв 100 и более в пользу победителя) — тоже.

### 5.4. Фиксация рейтингов на старте турнира

Все встречи турнира считаются против рейтингов, зафиксированных при переходе турнира в статус `RUNNING`.

**Изменение модели данных.** Требуется поле в `Registration`:

```prisma
ratingAtStart Decimal? @db.Decimal(8,2)   // снимок на момент старта турнира
matchesAtStart Int?                        // ratedMatches на тот же момент
```

Без этих полей корректность недостижима: движок обязан получить снимок, а не текущее значение игрока, иначе результат зависит от порядка обработки встреч и локальный расчёт консоли разойдётся с серверным.

Следствия:

- Расчёт идемпотентен и повторяем — пересчёт турнира даёт тот же результат
- Порядок обработки встреч не влияет ни на что
- Консоль в офлайне имеет все нужные данные в снимке турнира

### 5.5. Обязательные инварианты (тесты)

1. **Замкнутость для рейтинговых.** Если `ratedMatches >= 20` у обоих, то `winnerDelta + loserDelta === 0` при любых входных данных.
2. **Знаки.** `winnerDelta >= 0` и `loserDelta <= 0` всегда.
3. **Разрыв.** При `winnerRating - loserRating >= GAP_ZERO` обе дельты равны нулю.
4. **Техническая победа.** При `resultType !== 'NORMAL'` обе дельты равны нулю.
5. **Непрерывность.** `gapMultiplier` непрерывен: при разрыве 99.99 дельта близка к нулю, скачка у отметки 100 нет.
6. **Симметрия сенсации.** Победа снизу вверх даёт тем больше, чем больше разрыв, и монотонно.
7. **Отсечка.** Рейтинг никогда не опускается ниже `MIN_RATING`; при срабатывании `clamped === true` и `appliedDelta` отличается от запрошенной.
8. **Идемпотентность пересчёта.** Пересчёт всей истории `RatingEvent` даёт то же значение, что инкрементальный расчёт.
9. **Округление не создаёт очков.** Для рейтинговых пар сумма дельт по произвольной длинной серии встреч в точности равна нулю.
10. **Провизорный вброс измерим.** `imbalance` ненулевой тогда и только тогда, когда провизорен **победитель** и встреча двигает рейтинг. Провизорность проигравшего роли не играет: `K_PROV_LOSS` намеренно равен `K_BASE`, и `K` обеих сторон совпадает.

### 5.6. Метрика инфляции

Провизорный период — единственный канал, по которому в систему попадает рейтинг. Он обязан быть под наблюдением:

- Сумма всех `imbalance` за период — совокупный вброс
- Сумма рейтингов системы, разложенная на замкнутую часть и накопленный вброс
- Алерт при отклонении вброса от прогноза (прогноз выводится из числа новых игроков)

Без этой метрики утверждение «наш рейтинг не инфлирует» ничем не подкреплено, а это ровно тот аргумент, на котором конкурент отвергает формулу ФНТР.

## 6. Офлайн-режим консоли

### 6.1. Принцип

Консоль загружает полный снимок турнира в IndexedDB и дальше работает автономно. Все действия пишутся в локальную БД и одновременно в очередь исходящих операций.

### 6.2. Структура локального хранилища

```typescript
// Dexie
db.version(1).stores({
  tournaments: 'id, status',
  matches: 'id, tournamentId, status, [tournamentId+status]',
  registrations: 'id, tournamentId, playerId',
  players: 'id, lastName',
  outbox: '++seq, tournamentId, syncedAt',
});

interface OutboxItem {
  seq: number; // автоинкремент, порядок применения
  tournamentId: string;
  clientOpId: string; // UUID, идемпотентность
  type: 'MATCH_RESULT' | 'MATCH_ASSIGN' | 'MATCH_CANCEL' | 'PLAYER_WITHDRAW' | 'MATCH_EDIT';
  payload: unknown;
  createdAt: number;
  syncedAt: number | null;
  attempts: number;
}
```

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
- `clientOpId` обеспечивает идемпотентность: повторная отправка не создаёт дубль
- Конфликт разрешается в пользу операции судьи, который ведёт турнир (`RefereeSession`)
- При отклонении операции консоль показывает уведомление и подтягивает актуальный снимок
- Синхронизация запускается: при восстановлении сети, каждые 15 секунд при наличии сети, вручную

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
POST   /api/v1/auth/request-code     { phone }
POST   /api/v1/auth/verify-code      { phone, code } → { accessToken, refreshToken, user }
POST   /api/v1/auth/refresh          { refreshToken }
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### 7.2. Игроки

```
GET    /api/v1/players               ?search&city&clubId&page&limit
GET    /api/v1/players/:id
PATCH  /api/v1/players/:id
GET    /api/v1/players/:id/rating-history   ?from&to
GET    /api/v1/players/:id/matches          ?page&limit
GET    /api/v1/players/:id/head-to-head/:opponentId
POST   /api/v1/players                      # создание организатором
```

### 7.3. Рейтинги

```
GET    /api/v1/ratings               ?city&clubId&gender&birthYearFrom&birthYearTo&page
GET    /api/v1/ratings/top           ?limit=100
```

### 7.4. Клубы

```
GET    /api/v1/clubs                 ?city&search
GET    /api/v1/clubs/:id
POST   /api/v1/clubs
PATCH  /api/v1/clubs/:id
GET    /api/v1/clubs/:id/members
POST   /api/v1/clubs/:id/members
DELETE /api/v1/clubs/:id/members/:userId
GET    /api/v1/clubs/:id/balance
GET    /api/v1/clubs/:id/transactions ?from&to&page
```

### 7.5. Турниры

```
GET    /api/v1/tournaments           ?city&clubId&status&from&to&page
POST   /api/v1/tournaments
GET    /api/v1/tournaments/:id
PATCH  /api/v1/tournaments/:id
DELETE /api/v1/tournaments/:id
POST   /api/v1/tournaments/:id/duplicate      # «повторить прошлый»

POST   /api/v1/tournaments/:id/publish
POST   /api/v1/tournaments/:id/open-registration
POST   /api/v1/tournaments/:id/close-registration
POST   /api/v1/tournaments/:id/draw           # жеребьёвка
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

Правка отклоняется кодом `DOWNSTREAM_MATCH_PLAYED`, если на этом результате
держится уже сыгранная встреча ниже по сетке либо плей-офф, в котором играли.

### 7.7. Публичный экран

```
GET    /api/v1/public/screen/:publicToken       # без авторизации
WS     /ws/screen/:publicToken                  # realtime-обновления
```

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

Фронтенд единый (раздел 3), поэтому бюджет относится к **набору лениво загружаемых чанков консоли**, а не ко всей сборке. Проверяется автоматически в CI: превышение — красная сборка, а не замечание в ревью.

**Ключевое:** ввод счёта в консоли не должен ждать сети никогда. Оптимистичное обновление обязательно.

**Второе ключевое:** чанки консоли обязаны быть в Workbox precache. Ленивый чанк без предзагрузки в офлайне недоступен — судья откроет консоль в зале без сети и получит пустой экран. Это самый вероятный способ сломать офлайн-режим в единой сборке, и он обязан быть закрыт автотестом.

### 8.2. Доступность

- Целевой аптайм: 99.5% (допустимо ~3,6 часа простоя в месяц)
- Плановые работы — только в интервале с 02:00 до 06:00 по времени Астаны
- Турниры чаще всего идут вечером — деплой в это время запрещён

### 8.3. Безопасность

- Все соединения по HTTPS, TLS 1.3
- Пароли отсутствуют как класс, коды по SMS живут 5 минут
- Rate limiting: 5 запросов кода на телефон в час, 100 запросов API в минуту на пользователя
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
- Аутентификация по SMS
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
