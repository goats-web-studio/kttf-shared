import { describe, expect, it } from 'vitest';

import { authSessionSchema, loginSchema, signUpSchema } from './auth.js';

const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  phone: '+77011234567',
  login: 'aslan',
  email: null,
  locale: 'ru',
  createdAt: '2026-08-30T00:00:00.000Z',
  playerId: null,
  clubRoles: [{ clubId: '00000000-0000-4000-8000-000000000002', role: 'OWNER' }],
};

describe('телефон', () => {
  it('принимается только формат +7XXXXXXXXXX', () => {
    // ТЗ 2.1: «один телефон = один аккаунт». Разные написания одного номера
    // означают два аккаунта у одного человека.
    expect(
      signUpSchema.safeParse({ login: 'aslan', password: 'parol123', phone: '+77011234567' })
        .success,
    ).toBe(true);

    for (const phone of ['87011234567', '+7 701 123 45 67', '+7701123456', '+770112345678']) {
      expect(
        signUpSchema.safeParse({ login: 'aslan', password: 'parol123', phone }).success,
        phone,
      ).toBe(false);
    }
  });
});

describe('логин', () => {
  it('латиница, цифры и разделители, от трёх знаков', () => {
    for (const login of ['aslan', 'a.s_l-an', 'A1', 'аслан', 'aslan aslan', '']) {
      const ok = signUpSchema.safeParse({
        login,
        password: 'parol123',
        phone: '+77011234567',
      }).success;

      // Кириллица и пробел отвергаются: их не видно глазами при вводе.
      expect(ok, login).toBe(login === 'aslan' || login === 'a.s_l-an');
    }
  });
});

describe('пароль', () => {
  it('при заведении короче восьми знаков не принимается', () => {
    expect(
      signUpSchema.safeParse({ login: 'aslan', password: 'korotk1', phone: '+77011234567' })
        .success,
    ).toBe(false);
  });

  it('при входе длина не проверяется: короткий — просто неверный', () => {
    // Проверка длины на входе рассказала бы, каким требованиям отвечает
    // чужой пароль.
    expect(loginSchema.safeParse({ identifier: 'aslan', password: 'x' }).success).toBe(true);
  });
});

describe('вход', () => {
  it('одно поле принимает и логин, и телефон', () => {
    expect(
      loginSchema.safeParse({ identifier: '+77011234567', password: 'parol123' }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ identifier: 'aslan', password: 'parol123' }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: '', password: 'parol123' }).success).toBe(false);
  });
});

describe('ответ входа', () => {
  it('разбирается схемой целиком', () => {
    const session = { accessToken: 'a', refreshToken: 'r', user: USER };

    expect(authSessionSchema.parse(session)).toEqual(session);
  });

  it('профиль игрока может отсутствовать, но поле обязано быть', () => {
    const withoutPlayer: Record<string, unknown> = { ...USER };
    delete withoutPlayer.playerId;

    expect(
      authSessionSchema.safeParse({ accessToken: 'a', refreshToken: 'r', user: withoutPlayer })
        .success,
    ).toBe(false);
  });

  it('логин пустой у аккаунтов, заведённых до перехода на пароль', () => {
    // ADR-034: колонка появилась позже самих аккаунтов.
    expect(
      authSessionSchema.safeParse({
        accessToken: 'a',
        refreshToken: 'r',
        user: { ...USER, login: null },
      }).success,
    ).toBe(true);
  });
});
