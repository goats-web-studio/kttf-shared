import { describe, expect, it } from 'vitest';

import { HOME_STATS_PERIODS, HOME_STATS_PERIOD_DAYS, homeStatsQuerySchema } from './home-stats.js';

describe('статистика главной', () => {
  it('период по умолчанию — месяц', () => {
    expect(homeStatsQuerySchema.parse({})).toEqual({ period: 'MONTH' });
  });

  it('чужой период отклоняется', () => {
    expect(homeStatsQuerySchema.safeParse({ period: 'ALL' }).success).toBe(false);
  });

  it('у каждого периода есть длина, и они растут', () => {
    const days = HOME_STATS_PERIODS.map((period) => HOME_STATS_PERIOD_DAYS[period]);

    expect(days).toEqual([...days].sort((left, right) => left - right));
    expect(new Set(days).size).toBe(days.length);
  });
});
