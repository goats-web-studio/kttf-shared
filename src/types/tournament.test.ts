import { describe, expect, it } from 'vitest';

import {
  createTournamentSchema,
  registrationViewSchema,
  updateRegistrationSchema,
  updateTournamentSchema,
} from './tournament.js';
import { formatConfigSchema } from './tournament-format.js';

const CLUB_ID = '00000000-0000-4000-8000-000000000001';

const valid = {
  clubId: CLUB_ID,
  name: 'Кубок клуба',
  startsAt: '2026-09-10T10:00:00.000Z',
  entryFee: 2000,
  level: 'CLUB',
  tableCount: 6,
  formatConfig: { type: 'ROUND_ROBIN', rounds: 1, setsToWin: 3 },
};

describe('схема проведения', () => {
  it('круговая различает один и два круга', () => {
    expect(
      formatConfigSchema.safeParse({ type: 'ROUND_ROBIN', rounds: 2, setsToWin: 3 }).success,
    ).toBe(true);
    // Трёх кругов в ТЗ 5.1 нет: схемы описываются параметрами, а не догадками.
    expect(
      formatConfigSchema.safeParse({ type: 'ROUND_ROBIN', rounds: 3, setsToWin: 3 }).success,
    ).toBe(false);
  });

  it('встреча идёт до двух, трёх или четырёх побед', () => {
    for (const setsToWin of [2, 3, 4]) {
      expect(
        formatConfigSchema.safeParse({ type: 'ROUND_ROBIN', rounds: 1, setsToWin }).success,
        String(setsToWin),
      ).toBe(true);
    }

    expect(
      formatConfigSchema.safeParse({ type: 'ROUND_ROBIN', rounds: 1, setsToWin: 5 }).success,
    ).toBe(false);
  });

  it('группы задаются либо числом групп, либо размером, но не обоими', () => {
    // ТЗ 5.2 перечисляет их как альтернативу. Оба сразу противоречат друг
    // другу при любом составе, кроме одного, и молча разойдутся с сеткой.
    const base = {
      type: 'GROUPS_KNOCKOUT',
      advancePerGroup: 2,
      groupSetsToWin: 3,
      koSetsToWin: 3,
      thirdPlace: true,
    };

    expect(formatConfigSchema.safeParse({ ...base, groupCount: 4 }).success).toBe(true);
    expect(formatConfigSchema.safeParse({ ...base, groupSize: 4 }).success).toBe(true);
    expect(formatConfigSchema.safeParse({ ...base, groupCount: 4, groupSize: 4 }).success).toBe(
      false,
    );
    expect(formatConfigSchema.safeParse(base).success).toBe(false);
  });

  it('то же правило действует для финальных групп', () => {
    const base = {
      type: 'GROUPS_FINAL_GROUPS',
      advancePerGroup: 2,
      finalGroupCount: 2,
      setsToWin: 3,
    };

    expect(formatConfigSchema.safeParse({ ...base, groupCount: 4 }).success).toBe(true);
    expect(formatConfigSchema.safeParse({ ...base, groupCount: 4, groupSize: 4 }).success).toBe(
      false,
    );
  });

  it('финальных групп столько же, сколько выходит из группы', () => {
    // «Финалы по местам» (ТЗ 5.1): k-я группа собирает занявших k-е место.
    // При другом числе групп кому-то из вышедших некуда идти.
    const base = { type: 'GROUPS_FINAL_GROUPS', groupCount: 4, setsToWin: 3 };

    expect(
      formatConfigSchema.safeParse({ ...base, advancePerGroup: 2, finalGroupCount: 2 }).success,
    ).toBe(true);
    expect(
      formatConfigSchema.safeParse({ ...base, advancePerGroup: 3, finalGroupCount: 2 }).success,
    ).toBe(false);
  });

  it('кругов в группе один или два, по умолчанию один', () => {
    // ТЗ 5.2: тот же параметр, что у круговой схемы. До этого у групп его
    // не было вовсе, и второй круг задать было нечем.
    const base = {
      type: 'GROUPS_KNOCKOUT',
      groupCount: 4,
      advancePerGroup: 2,
      groupSetsToWin: 3,
      koSetsToWin: 3,
      thirdPlace: true,
    };

    expect(formatConfigSchema.safeParse({ ...base, groupRounds: 2 }).success).toBe(true);
    expect(formatConfigSchema.safeParse({ ...base, groupRounds: 3 }).success).toBe(false);

    // Турнир, созданный до появления поля, лежит в базе без него и обязан
    // читаться дальше — ровно так, как он и разыгрывался.
    const parsed = formatConfigSchema.parse(base);

    expect(parsed).toMatchObject({ groupRounds: 1 });
  });

  it('то же поле есть у финальных групп', () => {
    const base = {
      type: 'GROUPS_FINAL_GROUPS',
      groupCount: 4,
      advancePerGroup: 2,
      finalGroupCount: 2,
      setsToWin: 3,
    };

    expect(formatConfigSchema.safeParse({ ...base, groupRounds: 2 }).success).toBe(true);
    expect(formatConfigSchema.parse(base)).toMatchObject({ groupRounds: 1 });
  });

  it('олимпийка знает про матч за третье место', () => {
    expect(
      formatConfigSchema.safeParse({
        type: 'KNOCKOUT',
        setsToWin: 3,
        thirdPlace: true,
        consolation: false,
      }).success,
    ).toBe(true);
  });

  it('утешительная сетка отвергается при создании, а не при жеребьёвке', () => {
    // Движок её не строит. Турнир с этим флагом создавался и разваливался
    // только при разложении сетки — через три экрана после выбора (ADR-024).
    expect(
      formatConfigSchema.safeParse({
        type: 'KNOCKOUT',
        setsToWin: 3,
        thirdPlace: false,
        consolation: true,
      }).success,
    ).toBe(false);
  });

  it('неизвестная схема не проходит', () => {
    expect(formatConfigSchema.safeParse({ type: 'SWISS', setsToWin: 3 }).success).toBe(false);
  });
});

describe('создание турнира', () => {
  it('обязательного минимума достаточно', () => {
    expect(createTournamentSchema.safeParse(valid).success).toBe(true);
  });

  it('взнос может быть нулевым, но не отрицательным', () => {
    expect(createTournamentSchema.safeParse({ ...valid, entryFee: 0 }).success).toBe(true);
    expect(createTournamentSchema.safeParse({ ...valid, entryFee: -1 }).success).toBe(false);
  });

  it('турнир без столов не проводится', () => {
    expect(createTournamentSchema.safeParse({ ...valid, tableCount: 0 }).success).toBe(false);
  });

  it('дедлайн регистрации не бывает позже начала', () => {
    expect(
      createTournamentSchema.safeParse({
        ...valid,
        registrationEndsAt: '2026-09-09T10:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      createTournamentSchema.safeParse({
        ...valid,
        registrationEndsAt: '2026-09-11T10:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('планки и годы рождения не выворачиваются наизнанку', () => {
    expect(
      createTournamentSchema.safeParse({ ...valid, ratingCapMin: 400, ratingCapMax: 300 }).success,
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({ ...valid, birthYearFrom: 2010, birthYearTo: 2000 })
        .success,
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({ ...valid, birthYearFrom: 2000, birthYearTo: 2010 })
        .success,
    ).toBe(true);
  });
});

describe('изменение турнира', () => {
  it('пустое тело отвергается', () => {
    expect(updateTournamentSchema.safeParse({}).success).toBe(false);
  });

  it('клуб сменить нельзя', () => {
    // Турнир принадлежит клубу, в котором создан: переезд означал бы смену
    // и прав на него, и принадлежности уже записанных участников.
    const parsed = updateTournamentSchema.parse({ name: 'Другое', clubId: CLUB_ID });

    expect(parsed).not.toHaveProperty('clubId');
  });

  it('границы проверяются и при частичной правке', () => {
    expect(updateTournamentSchema.safeParse({ ratingCapMin: 400, ratingCapMax: 300 }).success).toBe(
      false,
    );
    // Одна половина пары — вторая лежит в базе, её сверит сервис.
    expect(updateTournamentSchema.safeParse({ ratingCapMin: 400 }).success).toBe(true);
  });
});

describe('правка участника', () => {
  it('пустое тело отвергается', () => {
    expect(updateRegistrationSchema.safeParse({}).success).toBe(false);
  });

  it('в «играет» руками не переводят', () => {
    // Этот статус проставляет старт турнира: он идёт вместе со снимком
    // рейтингов (ТС 5.4), а не отдельным действием человека.
    expect(updateRegistrationSchema.safeParse({ status: 'PLAYING' }).success).toBe(false);
    expect(updateRegistrationSchema.safeParse({ status: 'WITHDRAWN' }).success).toBe(true);
  });

  it('посев можно снять', () => {
    expect(updateRegistrationSchema.safeParse({ seed: null }).success).toBe(true);
    expect(updateRegistrationSchema.safeParse({ seed: 0 }).success).toBe(false);
  });
});

describe('участник в ответе', () => {
  it('снимок рейтинга приходит строкой и до старта пуст', () => {
    const registration = {
      id: CLUB_ID,
      tournamentId: CLUB_ID,
      status: 'CONFIRMED',
      isRated: true,
      seed: null,
      ratingAtStart: null,
      matchesAtStart: null,
      createdAt: '2026-08-30T00:00:00.000Z',
      player: {
        id: CLUB_ID,
        userId: null,
        lastName: 'Ахметов',
        firstName: 'Данияр',
        middleName: null,
        birthYear: 2001,
        gender: 'MALE',
        city: 'Алматы',
        photoUrl: null,
        clubId: null,
        rating: '250.00',
        ratedMatches: 0,
        isProvisional: true,
        createdAt: '2026-08-30T00:00:00.000Z',
      },
    };

    expect(registrationViewSchema.parse(registration)).toEqual(registration);
    expect(registrationViewSchema.safeParse({ ...registration, ratingAtStart: 250 }).success).toBe(
      false,
    );
  });
});
