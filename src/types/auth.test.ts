import { describe, expect, it } from 'vitest';

import {
  authSessionSchema,
  requestCodeResultSchema,
  requestCodeSchema,
  verifyCodeSchema,
} from './auth.js';

describe('телефон', () => {
  it('принимается только формат +7XXXXXXXXXX', () => {
    // ТЗ 2.1: «один телефон = один аккаунт». Разные написания одного номера
    // означают два аккаунта у одного человека.
    expect(requestCodeSchema.safeParse({ phone: '+77011234567' }).success).toBe(true);

    for (const phone of ['87011234567', '+7 701 123 45 67', '+7701123456', '+770112345678']) {
      expect(requestCodeSchema.safeParse({ phone }).success, phone).toBe(false);
    }
  });

  it('пробелы по краям обрезаются, а не отвергаются', () => {
    expect(requestCodeSchema.parse({ phone: '  +77011234567  ' })).toEqual({
      phone: '+77011234567',
    });
  });
});

describe('код', () => {
  it('ровно шесть цифр', () => {
    expect(verifyCodeSchema.safeParse({ phone: '+77011234567', code: '123456' }).success).toBe(
      true,
    );

    for (const code of ['12345', '1234567', 'abcdef', '12345a']) {
      expect(verifyCodeSchema.safeParse({ phone: '+77011234567', code }).success, code).toBe(false);
    }
  });
});

describe('ответ входа', () => {
  it('разбирается схемой целиком', () => {
    const session = {
      accessToken: 'a',
      refreshToken: 'r',
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        phone: '+77011234567',
        email: null,
        locale: 'ru',
        createdAt: '2026-08-30T00:00:00.000Z',
        playerId: null,
        clubRoles: [{ clubId: '00000000-0000-4000-8000-000000000002', role: 'OWNER' }],
      },
    };

    expect(authSessionSchema.parse(session)).toEqual(session);
  });

  it('профиль игрока может отсутствовать, но поле обязано быть', () => {
    const user = {
      id: '00000000-0000-4000-8000-000000000001',
      phone: '+77011234567',
      email: null,
      locale: 'ru',
      createdAt: '2026-08-30T00:00:00.000Z',
      clubRoles: [],
    };

    expect(authSessionSchema.safeParse({ accessToken: 'a', refreshToken: 'r', user }).success).toBe(
      false,
    );
  });
});

describe('ответ на запрос кода', () => {
  it('отдаёт срок жизни и не отдаёт сам код', () => {
    const parsed = requestCodeResultSchema.parse({ expiresInSeconds: 300, code: '123456' });

    expect(parsed).toEqual({ expiresInSeconds: 300 });
  });

  it('нулевой и отрицательный срок бессмысленны', () => {
    expect(requestCodeResultSchema.safeParse({ expiresInSeconds: 0 }).success).toBe(false);
    expect(requestCodeResultSchema.safeParse({ expiresInSeconds: -1 }).success).toBe(false);
  });
});
