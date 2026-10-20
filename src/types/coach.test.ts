import { describe, expect, it } from 'vitest';

import { authUserViewSchema } from './auth.js';
import {
  COACH_PLAN_LIMITS,
  canSubmitCoach,
  coachCredentialFilePath,
  coachEventSchema,
  coachImageVariant,
  coachLimits,
  coachMissing,
  coachStatsQuerySchema,
  isCoachPublic,
  listCoachesSchema,
  listTrainingsSchema,
  rejectCoachSchema,
  setCoachAchievementsSchema,
  setCoachCredentialsSchema,
  setCoachHiddenSchema,
  setClubTrainingsSchema,
  setCoachTrainingsSchema,
  trainingOwner,
  updateCoachSchema,
} from './coach.js';

const ID = '0b6f3c4e-7a51-4b8a-9d2e-5f1c3a7b9e10';
const OTHER = '1c7e4d5f-8b62-4c9b-8e3f-6a2d4b8c0f21';

const group = {
  kind: 'KIDS_GROUP',
  audiences: ['KIDS'],
  kidsFromAge: 6,
  place: 'CLUB',
  clubId: OTHER,
  title: 'Детская группа',
  schedule: 'пн, ср, пт 18:00–19:30',
  priceKzt: 20_000,
  unit: 'MONTH',
};

describe('страница тренера', () => {
  it('поля правятся по одному, `null` стирает', () => {
    expect(updateCoachSchema.safeParse({ headline: 'Детский тренер' }).success).toBe(true);
    expect(updateCoachSchema.safeParse({ headline: null, cityId: null }).success).toBe(true);
  });

  it('пустая правка отвергается', () => {
    expect(updateCoachSchema.safeParse({}).success).toBe(false);
  });

  it('метки без повторов', () => {
    expect(updateCoachSchema.safeParse({ languages: ['KK', 'RU'] }).success).toBe(true);
    expect(updateCoachSchema.safeParse({ formats: ['VISIT', 'VISIT'] }).success).toBe(false);
  });

  it('фото и обложка — только загруженные к тренеру', () => {
    const own = `/api/v1/files/coaches/${ID}.webp`;

    expect(updateCoachSchema.safeParse({ photoUrl: own, coverUrl: own }).success).toBe(true);
    expect(
      updateCoachSchema.safeParse({ photoUrl: `/api/v1/files/clubs/${ID}.webp` }).success,
    ).toBe(false);
  });

  it('тренирует не с будущего года', () => {
    const next = new Date().getFullYear() + 1;

    expect(updateCoachSchema.safeParse({ coachingSince: 2015 }).success).toBe(true);
    expect(updateCoachSchema.safeParse({ coachingSince: next }).success).toBe(false);
  });
});

describe('тренировки', () => {
  const coachOf = (rows: unknown[]) =>
    setCoachTrainingsSchema.safeParse({ trainings: rows }).success;

  it('детская группа в клубе KTTF с возрастом и ценой', () => {
    expect(coachOf([group])).toBe(true);
  });

  it('цена необязательна — «по договорённости»', () => {
    const free: Partial<typeof group> = { ...group };
    delete free.priceKzt;

    expect(coachOf([free])).toBe(true);
    expect(coachOf([{ ...group, priceKzt: null }])).toBe(true);
  });

  it('возраст ребёнка — только у детей и подростков', () => {
    const adults = { ...group, kind: 'GROUP', audiences: ['AMATEURS'] };

    expect(coachOf([adults])).toBe(false);
    expect(coachOf([{ ...adults, kidsFromAge: null }])).toBe(true);
    expect(coachOf([{ ...group, audiences: ['TEENS'] }])).toBe(true);
  });

  it('хотя бы одна аудитория', () => {
    expect(coachOf([{ ...group, audiences: [] }])).toBe(false);
  });

  it('строк не больше защитного предела', () => {
    expect(coachOf(Array.from({ length: COACH_PLAN_LIMITS.PRO.trainings + 1 }, () => group))).toBe(
      false,
    );
  });

  it('в клубе — клуб KTTF или зал с адресом, ровно одно', () => {
    const venue = { ...group, clubId: null, venueName: 'СК «Арман»', venueAddress: 'пр. Абая, 10' };

    expect(coachOf([venue])).toBe(true);
    expect(coachOf([{ ...group, clubId: undefined }])).toBe(false);
    expect(coachOf([{ ...venue, clubId: OTHER }])).toBe(false);
    expect(coachOf([{ ...venue, venueAddress: null }])).toBe(false);
  });

  it('у выезда и онлайна места нет', () => {
    const visit = { ...group, place: 'VISIT', clubId: undefined };

    expect(coachOf([visit])).toBe(true);
    expect(coachOf([{ ...visit, clubId: OTHER }])).toBe(false);
    expect(coachOf([{ ...visit, venueAddress: 'пр. Абая, 10' }])).toBe(false);
  });

  it('одна тренировка дважды — отказ', () => {
    expect(
      coachOf([
        { ...group, id: ID },
        { ...group, id: ID },
      ]),
    ).toBe(false);
    expect(coachOf([{ ...group, id: ID }, group])).toBe(true);
  });

  it('тренировка клуба — с тренером или без', () => {
    const own: Partial<typeof group> = { ...group };
    delete own.place;
    delete own.clubId;
    const clubOf = (rows: unknown[]) =>
      setClubTrainingsSchema.safeParse({ trainings: rows }).success;

    expect(clubOf([own, { ...own, coachId: ID }])).toBe(true);
    expect(clubOf([{ ...own, audiences: ['AMATEURS'] }])).toBe(false);
    expect(
      clubOf([
        { ...own, id: ID },
        { ...own, id: ID },
      ]),
    ).toBe(false);
  });
});

describe('квалификация', () => {
  const diploma = { kind: 'DIPLOMA', title: 'КазАСТ, тренер-преподаватель' };

  it('документ со сканом и без', () => {
    const file = `/api/v1/files/coach-docs/${ID}.webp`;

    expect(
      setCoachCredentialsSchema.safeParse({
        credentials: [{ ...diploma, id: ID, file, filePublic: true }, diploma],
      }).success,
    ).toBe(true);
  });

  it('скан — только из своей папки документов', () => {
    const file = `/api/v1/files/coaches/${ID}.webp`;

    expect(
      setCoachCredentialsSchema.safeParse({ credentials: [{ ...diploma, file }] }).success,
    ).toBe(false);
  });

  it('один документ дважды — отказ', () => {
    expect(
      setCoachCredentialsSchema.safeParse({
        credentials: [
          { ...diploma, id: ID },
          { ...diploma, id: ID },
        ],
      }).success,
    ).toBe(false);
    expect(
      setCoachCredentialsSchema.safeParse({
        credentials: [
          { ...diploma, id: ID },
          { ...diploma, id: OTHER },
        ],
      }).success,
    ).toBe(true);
  });

  it('заслуги игроком и тренером', () => {
    expect(
      setCoachAchievementsSchema.safeParse({
        achievements: [
          { role: 'AS_PLAYER', year: 2012, title: 'Чемпион РК в паре' },
          { role: 'AS_COACH', title: 'Ученик — призёр первенства РК U15' },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('заявка', () => {
  it('отправить нельзя без города и тренировки', () => {
    expect(coachMissing({ city: null, trainings: [] })).toEqual(['city', 'trainings']);
    expect(coachMissing({ city: { id: ID }, trainings: [group] })).toEqual([]);
  });

  it('отправляются черновик и отклонённая', () => {
    expect(canSubmitCoach('DRAFT')).toBe(true);
    expect(canSubmitCoach('REJECTED')).toBe(true);
    expect(canSubmitCoach('PENDING')).toBe(false);
    expect(canSubmitCoach('APPROVED')).toBe(false);
  });

  it('публична только одобренная и не скрытая', () => {
    expect(isCoachPublic({ status: 'APPROVED', hidden: false })).toBe(true);
    expect(isCoachPublic({ status: 'APPROVED', hidden: true })).toBe(false);
    expect(isCoachPublic({ status: 'PENDING', hidden: false })).toBe(false);
  });

  it('отказ — с причиной', () => {
    expect(rejectCoachSchema.safeParse({ reason: 'Нет тренировок с ценой' }).success).toBe(true);
    expect(rejectCoachSchema.safeParse({ reason: ' ' }).success).toBe(false);
  });

  it('скрытие — с причиной, возврат — без', () => {
    expect(setCoachHiddenSchema.safeParse({ hidden: true }).success).toBe(false);
    expect(setCoachHiddenSchema.safeParse({ hidden: true, reason: 'Жалоба' }).success).toBe(true);
    expect(setCoachHiddenSchema.safeParse({ hidden: false }).success).toBe(true);
  });
});

describe('списки', () => {
  it('фильтры тренировок — списками через запятую', () => {
    expect(
      listTrainingsSchema.parse({
        kind: 'GROUP,KIDS_GROUP',
        audience: 'KIDS',
        place: 'CLUB,ONLINE',
        cityId: `${ID},${OTHER}`,
        age: '9',
        priceTo: '20000',
        language: 'KK',
      }),
    ).toEqual({
      page: 1,
      limit: 20,
      kind: ['GROUP', 'KIDS_GROUP'],
      audience: ['KIDS'],
      place: ['CLUB', 'ONLINE'],
      cityId: [ID, OTHER],
      age: 9,
      priceTo: 20_000,
      language: 'KK',
    });
  });

  it('чужое значение в фильтре — отказ', () => {
    expect(listTrainingsSchema.safeParse({ kind: 'TENNIS' }).success).toBe(false);
    expect(listTrainingsSchema.safeParse({ age: '30' }).success).toBe(false);
  });

  it('тренеры — по городу и языку', () => {
    expect(listCoachesSchema.parse({ cityId: ID, language: 'RU' })).toEqual({
      page: 1,
      limit: 20,
      cityId: [ID],
      language: 'RU',
    });
  });
});

describe('картинки и сканы', () => {
  it('вариант ширины — у своей картинки, чужая остаётся как есть', () => {
    const own = `/api/v1/files/coaches/${ID}.webp`;

    expect(coachImageVariant(own, 480)).toBe(`/api/v1/files/coaches/${ID}-480.webp`);
    expect(coachImageVariant(own, 1600)).toBe(own);
    expect(coachImageVariant('/api/v1/files/players/x.jpg', 480)).toBe(
      '/api/v1/files/players/x.jpg',
    );
  });

  it('скан открывается маршрутом документа, а не общей выдачей файлов', () => {
    expect(coachCredentialFilePath(ID, OTHER)).toBe(
      `/api/v1/coaches/${ID}/credentials/${OTHER}/file`,
    );
  });
});

describe('статистика и тариф', () => {
  it('события — просмотр и способы связи', () => {
    expect(coachEventSchema.safeParse({ kind: 'INSTAGRAM', source: 'CAMPAIGN' }).success).toBe(
      true,
    );
    expect(coachEventSchema.safeParse({ kind: 'ROUTE', source: 'ORGANIC' }).success).toBe(false);
  });

  it('окно — 30 дней по умолчанию, не глубже предела', () => {
    expect(coachStatsQuerySchema.parse({})).toEqual({ days: 30 });
    expect(coachStatsQuerySchema.safeParse({ days: '366' }).success).toBe(false);
  });

  it('тарифы выключены — всем защитный предел', () => {
    expect(coachLimits('FREE')).toBe(COACH_PLAN_LIMITS.PRO);
    expect(coachLimits('FREE', true)).toBe(COACH_PLAN_LIMITS.FREE);
  });
});

describe('сессия', () => {
  const user = {
    id: ID,
    phone: '+77010000000',
    login: 'coach',
    email: null,
    locale: 'RU',
    telegramId: null,
    createdAt: '2026-10-20T10:00:00.000Z',
    playerId: OTHER,
    clubRoles: [],
    isAdmin: false,
  };

  it('запись на диске без поля тренера читается: страницы нет', () => {
    expect(authUserViewSchema.parse(user).coach).toBeNull();
  });

  it('своя страница — со статусом заявки', () => {
    const coach = { id: OTHER, slug: 'ivanov-ivan', status: 'PENDING' };

    expect(authUserViewSchema.parse({ ...user, coach }).coach).toEqual(coach);
  });
});

describe('владелец тренировки', () => {
  const club = { id: ID, name: 'Клуб «Спин»' };
  const coach = { id: OTHER, slug: 'petrov-aleksey' };
  const as = (value: unknown) => value as Parameters<typeof trainingOwner>[0];

  it('группа клуба — пишут клубу, даже если в ней указан тренер', () => {
    expect(trainingOwner(as({ author: 'CLUB', club, coach }))).toEqual({ kind: 'CLUB', club });
  });

  it('своя тренировка тренера — пишут тренеру, клуб в ней только место', () => {
    expect(trainingOwner(as({ author: 'COACH', club, coach }))).toEqual({ kind: 'COACH', coach });
  });

  it('владельца не видно — писать некому', () => {
    expect(trainingOwner(as({ author: 'CLUB', club: null, coach }))).toBeNull();
    expect(trainingOwner(as({ author: 'COACH', club, coach: null }))).toBeNull();
  });

  it('«Подробнее» — до тысячи знаков', () => {
    expect(
      setCoachTrainingsSchema.safeParse({
        trainings: [{ ...group, description: 'Берите сменную обувь' }],
      }).success,
    ).toBe(true);
    expect(
      setCoachTrainingsSchema.safeParse({
        trainings: [{ ...group, description: 'а'.repeat(1001) }],
      }).success,
    ).toBe(false);
  });
});
