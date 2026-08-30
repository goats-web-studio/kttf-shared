import { describe, expect, it } from 'vitest';

import { createPlayerSchema, playerViewSchema, updatePlayerSchema } from './player.js';

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

describe('изменение игрока', () => {
  it('пустое тело отвергается', () => {
    expect(updatePlayerSchema.safeParse({}).success).toBe(false);
  });

  it('одного поля достаточно', () => {
    expect(updatePlayerSchema.safeParse({ city: 'Астана' }).success).toBe(true);
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
});
