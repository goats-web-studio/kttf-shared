import { describe, expect, it } from 'vitest';

import { changePasswordSchema, updateAccountSchema } from './account.js';

describe('настройки аккаунта', () => {
  it('пустое тело отвергается', () => {
    expect(updateAccountSchema.safeParse({}).success).toBe(false);
  });

  it('null очищает поле, отсутствие поля его не трогает', () => {
    // Без этой разницы однажды указанную почту нельзя убрать вовсе.
    expect(updateAccountSchema.safeParse({ email: null }).success).toBe(true);
    expect(updateAccountSchema.safeParse({ telegramId: null }).success).toBe(true);

    const parsed = updateAccountSchema.parse({ locale: 'KK' });

    expect(parsed).not.toHaveProperty('email');
  });

  it('Telegram ID — число, а не @имя', () => {
    // Бот пишет по числовому chat_id; по @имени он писать не может.
    expect(updateAccountSchema.safeParse({ telegramId: '6412640409' }).success).toBe(true);
    expect(updateAccountSchema.safeParse({ telegramId: '@znewk' }).success).toBe(false);
  });

  it('телефон настройками не меняется', () => {
    // ТЗ 2.1: один телефон — один аккаунт. Смена номера требует подтверждения
    // владения новым, которого без SMS взять неоткуда (ADR-034).
    const parsed = updateAccountSchema.parse({ locale: 'RU', phone: '+77015550101' });

    expect(parsed).not.toHaveProperty('phone');
  });

  it('логин проверяется теми же правилами, что при регистрации', () => {
    expect(updateAccountSchema.safeParse({ login: 'zane_k' }).success).toBe(true);
    expect(updateAccountSchema.safeParse({ login: 'зейн' }).success).toBe(false);
  });
});

describe('смена пароля', () => {
  it('текущий пароль обязателен', () => {
    expect(changePasswordSchema.safeParse({ newPassword: 'longenough1' }).success).toBe(false);
  });

  it('новый пароль подчиняется правилу длины', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old-one-here', newPassword: 'short' })
        .success,
    ).toBe(false);
  });

  it('новый пароль, равный текущему, отвергается', () => {
    // Иначе форма молча делает вид, что сработала.
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'samesame1', newPassword: 'samesame1' })
        .success,
    ).toBe(false);
  });

  it('разные пароли принимаются', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'samesame1', newPassword: 'othersame2' })
        .success,
    ).toBe(true);
  });
});
