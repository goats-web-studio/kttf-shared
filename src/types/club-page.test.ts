import { describe, expect, it } from 'vitest';

import {
  CLUB_PRICES_MAX,
  PRICE_KZT_MAX,
  clubEventSchema,
  clubStatsQuerySchema,
  setClubPricesSchema,
} from './club-page.js';
import { CLUB_PLAN_LIMITS, clubLimits } from './club-plan.js';

const rent = { kind: 'TABLE_RENT', title: 'Аренда стола', priceKzt: 3000, unit: 'HOUR' };

describe('прайс клуба', () => {
  it('строка без примечания принимается', () => {
    expect(setClubPricesSchema.safeParse({ prices: [rent] }).success).toBe(true);
  });

  it('цена — целые тенге в разумных пределах', () => {
    expect(setClubPricesSchema.safeParse({ prices: [{ ...rent, priceKzt: 99.5 }] }).success).toBe(
      false,
    );
    expect(
      setClubPricesSchema.safeParse({ prices: [{ ...rent, priceKzt: PRICE_KZT_MAX + 1 }] }).success,
    ).toBe(false);
  });

  it('строк не больше потолка', () => {
    const prices = Array.from({ length: CLUB_PRICES_MAX + 1 }, () => rent);

    expect(setClubPricesSchema.safeParse({ prices }).success).toBe(false);
  });
});

describe('событие страницы клуба', () => {
  it('вид и источник — из перечня', () => {
    expect(clubEventSchema.safeParse({ kind: 'WHATSAPP', source: 'CAMPAIGN' }).success).toBe(true);
    expect(clubEventSchema.safeParse({ kind: 'EMAIL', source: 'ORGANIC' }).success).toBe(false);
  });
});

describe('статистика клуба', () => {
  it('по умолчанию — 30 дней, не больше защитного предела', () => {
    expect(clubStatsQuerySchema.parse({})).toEqual({ days: 30 });
    expect(clubStatsQuerySchema.safeParse({ days: '366' }).success).toBe(false);
  });
});

describe('тарифы клуба', () => {
  it('пока тарифы выключены, всем действует защитный предел', () => {
    expect(clubLimits('FREE')).toBe(CLUB_PLAN_LIMITS.PRO);
  });

  it('включённые тарифы различают план', () => {
    expect(clubLimits('FREE', true)).toBe(CLUB_PLAN_LIMITS.FREE);
    expect(clubLimits('PRO', true)).toBe(CLUB_PLAN_LIMITS.PRO);
  });
});
