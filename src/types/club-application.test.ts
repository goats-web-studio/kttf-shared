import { describe, expect, it } from 'vitest';

import {
  createClubApplicationSchema,
  listClubApplicationsSchema,
  updateClubApplicationSchema,
} from './club-application.js';

const MINIMAL = {
  name: 'Арман',
  contact: '+7 701 123 45 67',
  clubName: 'Спин',
  city: 'Караганда',
};

describe('заявка клуба', () => {
  it('обязательны имя, контакт, клуб и город', () => {
    expect(createClubApplicationSchema.safeParse(MINIMAL).success).toBe(true);

    for (const field of ['name', 'contact', 'clubName', 'city'] as const) {
      expect(createClubApplicationSchema.safeParse({ ...MINIMAL, [field]: '  ' }).success).toBe(
        false,
      );
    }
  });

  it('контакт короче пяти знаков — не телефон и не email', () => {
    expect(createClubApplicationSchema.safeParse({ ...MINIMAL, contact: '123' }).success).toBe(
      false,
    );
  });

  it('пустое необязательное поле — то же, что не заполнено', () => {
    const parsed = createClubApplicationSchema.parse({
      ...MINIMAL,
      address: '   ',
      tableCount: '',
      tournaments: '',
      message: '',
    });

    expect(parsed.address).toBeUndefined();
    expect(parsed.tableCount).toBeUndefined();
    expect(parsed.tournaments).toBeUndefined();
    expect(parsed.message).toBeUndefined();
  });

  it('число столов — целое от 1 до 200, строка из формы приводится', () => {
    expect(createClubApplicationSchema.parse({ ...MINIMAL, tableCount: '6' }).tableCount).toBe(6);
    expect(createClubApplicationSchema.safeParse({ ...MINIMAL, tableCount: 0 }).success).toBe(
      false,
    );
    expect(createClubApplicationSchema.safeParse({ ...MINIMAL, tableCount: 2.5 }).success).toBe(
      false,
    );
    expect(createClubApplicationSchema.safeParse({ ...MINIMAL, tableCount: 500 }).success).toBe(
      false,
    );
  });

  it('свободный текст ограничен — заявка не превращается в склад', () => {
    expect(
      createClubApplicationSchema.safeParse({ ...MINIMAL, message: 'а'.repeat(2001) }).success,
    ).toBe(false);
  });

  it('ловушка для ботов разбирается, решение принимает сервер', () => {
    // Пустая ловушка у человека — то же, что поля нет: в запрос не попадает.
    expect(createClubApplicationSchema.parse({ ...MINIMAL, website: '' }).website).toBeUndefined();
    expect(createClubApplicationSchema.parse({ ...MINIMAL, website: 'spam.example' }).website).toBe(
      'spam.example',
    );
  });
});

describe('список и правка у администратора', () => {
  it('список постраничный, статус по желанию', () => {
    expect(listClubApplicationsSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(listClubApplicationsSchema.parse({ status: 'NEW' }).status).toBe('NEW');
    expect(listClubApplicationsSchema.safeParse({ status: 'SPAM' }).success).toBe(false);
  });

  it('правка меняет только статус', () => {
    expect(updateClubApplicationSchema.safeParse({ status: 'DONE' }).success).toBe(true);
    expect(updateClubApplicationSchema.safeParse({}).success).toBe(false);
  });
});
