import { describe, expect, it } from 'vitest';

import {
  createPlayerSchema,
  playerProfileViewSchema,
  playerViewSchema,
  updatePlayerSchema,
} from './player.js';

const PLAYER_ID = '00000000-0000-4000-8000-000000000001';

const valid = {
  lastName: 'Ахметов',
  firstName: 'Данияр',
  birthYear: 2001,
  gender: 'MALE',
  city: 'Алматы',
};

describe('создание игрока', () => {
  it('отчество не обязательно', () => {
    // Бриф, запрет №6: обязательное отчество не соответствует практике
    // именования в Казахстане.
    expect(createPlayerSchema.safeParse(valid).success).toBe(true);
    expect(createPlayerSchema.safeParse({ ...valid, middleName: 'Ерланович' }).success).toBe(true);
  });

  it('игроков из будущего не бывает', () => {
    expect(
      createPlayerSchema.safeParse({ ...valid, birthYear: new Date().getFullYear() + 1 }).success,
    ).toBe(false);
    expect(createPlayerSchema.safeParse({ ...valid, birthYear: 1899 }).success).toBe(false);
  });

  it('рейтинг полем не задаётся', () => {
    // Он проекция журнала RatingEvent (ТС 1.4), а не хранимое число.
    const parsed = createPlayerSchema.parse({ ...valid, rating: '500' });

    expect(parsed).not.toHaveProperty('rating');
  });
});

describe('дата рождения рядом с годом', () => {
  it('дата без года не принимается', () => {
    // Год — источник истины для допуска (birthYearFrom/birthYearTo). Дата,
    // пришедшая одна, оставила бы год прежним и развела их.
    expect(updatePlayerSchema.safeParse({ city: 'Астана', birthDate: '2001-04-12' }).success).toBe(
      false,
    );
  });

  it('дата, спорящая с годом, отвергается', () => {
    expect(createPlayerSchema.safeParse({ ...valid, birthDate: '1999-04-12' }).success).toBe(false);
  });

  it('дата, согласная с годом, принимается', () => {
    expect(createPlayerSchema.safeParse({ ...valid, birthDate: '2001-04-12' }).success).toBe(true);
  });

  it('без даты профиль остаётся действительным', () => {
    // Дата необязательна: профили, заведённые до её появления, живут дальше.
    expect(createPlayerSchema.safeParse(valid).success).toBe(true);
  });
});

describe('тренер', () => {
  it('выбор из списка и вписанное имя разом отвергаются', () => {
    expect(
      createPlayerSchema.safeParse({
        ...valid,
        coachPlayerId: PLAYER_ID,
        coachName: 'Сериков Тимур',
      }).success,
    ).toBe(false);
  });

  it('каждый способ по отдельности принимается', () => {
    expect(createPlayerSchema.safeParse({ ...valid, coachPlayerId: PLAYER_ID }).success).toBe(true);
    expect(createPlayerSchema.safeParse({ ...valid, coachName: 'Сериков Тимур' }).success).toBe(
      true,
    );
  });
});

describe('инвентарь и хват', () => {
  it('хват ограничен двумя значениями', () => {
    expect(createPlayerSchema.safeParse({ ...valid, grip: 'PENHOLD' }).success).toBe(true);
    expect(createPlayerSchema.safeParse({ ...valid, grip: 'ЕВРОПЕЙСКИЙ' }).success).toBe(false);
  });

  it('инвентарь — свободная строка в пределах длины', () => {
    expect(
      createPlayerSchema.safeParse({ ...valid, blade: 'Butterfly Lin Gaoyuan ALC' }).success,
    ).toBe(true);
    expect(createPlayerSchema.safeParse({ ...valid, blade: 'x'.repeat(121) }).success).toBe(false);
  });

  it('фото принимается и своим путём, и внешней ссылкой', () => {
    // Своя загрузка отдаёт путь (ADR-036), заведённые раньше профили —
    // ссылку наружу.
    expect(
      createPlayerSchema.safeParse({ ...valid, photoUrl: '/api/v1/files/players/a.jpg' }).success,
    ).toBe(true);
    expect(
      createPlayerSchema.safeParse({ ...valid, photoUrl: 'https://example.kz/a.jpg' }).success,
    ).toBe(true);
    expect(createPlayerSchema.safeParse({ ...valid, photoUrl: 'a.jpg' }).success).toBe(false);
  });
});

describe('изменение игрока', () => {
  it('пустое тело отвергается', () => {
    expect(updatePlayerSchema.safeParse({}).success).toBe(false);
  });

  it('одного поля достаточно', () => {
    expect(updatePlayerSchema.safeParse({ city: 'Астана' }).success).toBe(true);
  });

  it('null очищает необязательное поле', () => {
    // Иначе однажды вписанный инвентарь остаётся в анкете навсегда.
    expect(updatePlayerSchema.safeParse({ blade: null }).success).toBe(true);
    expect(updatePlayerSchema.safeParse({ coachPlayerId: null }).success).toBe(true);
    expect(updatePlayerSchema.safeParse({ birthDate: null }).success).toBe(true);
  });

  it('обязательное поле очистить нельзя', () => {
    expect(updatePlayerSchema.safeParse({ city: null }).success).toBe(false);
    expect(updatePlayerSchema.safeParse({ lastName: null }).success).toBe(false);
  });

  it('очистка одного способа задать тренера не спорит с другим', () => {
    // Переключение «из списка» → «вписать руками» приходит именно так:
    // связь очищается, имя задаётся.
    expect(
      updatePlayerSchema.safeParse({ coachPlayerId: null, coachName: 'Сериков Тимур' }).success,
    ).toBe(true);
  });
});

describe('игрок в ответе', () => {
  it('рейтинг приходит строкой, а не числом', () => {
    // Decimal(8,2) представим не всякий раз в двоичной плавающей точке, и
    // расхождение вылезет при сверке локального расчёта консоли с серверным —
    // бриф, запрет №2.
    const player = {
      id: PLAYER_ID,
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
    };

    expect(playerViewSchema.parse(player)).toEqual(player);
    expect(playerViewSchema.safeParse({ ...player, rating: 250 }).success).toBe(false);
  });

  it('анкеты в кратком виде нет', () => {
    // Краткий вид уезжает в офлайн-снимок консоли (ТС 6). Инвентарь и «о
    // себе» судье в зале не нужны, а место в снимке занимают.
    expect(playerViewSchema.shape).not.toHaveProperty('bio');
    expect(playerViewSchema.shape).not.toHaveProperty('blade');
    expect(playerProfileViewSchema.shape).toHaveProperty('bio');
  });

  it('полный профиль — это краткий плюс анкета', () => {
    const player = {
      id: PLAYER_ID,
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
      birthDate: '2001-04-12',
      playingHand: 'RIGHT',
      grip: 'SHAKEHAND',
      blade: 'Butterfly Lin Gaoyuan ALC',
      rubberForehand: 'Nittaku Hurricane PRO 3',
      rubberBackhand: 'DHS Hurricane 8 Soft',
      bio: 'hate tensor, love sticky',
      coachPlayerId: null,
      coachName: 'Сериков Тимур',
    };

    expect(playerProfileViewSchema.parse(player)).toEqual(player);
  });
});
