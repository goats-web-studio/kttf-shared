import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, pageQuerySchema, pageSchema } from './pagination.js';

describe('pageQuerySchema', () => {
  it('строки из адресной строки приводятся к числам', () => {
    // Параметры запроса всегда приходят строками. Без приведения схема
    // отвергала бы любой реальный запрос со страницей.
    expect(pageQuerySchema.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });

  it('без параметров действуют умолчания', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, limit: DEFAULT_PAGE_SIZE });
  });

  it('потолок limit не обходится', () => {
    // Без границы `?limit=100000` кладёт базу одним запросом, а ТС 8.1
    // требует p95 меньше 200 мс.
    expect(pageQuerySchema.safeParse({ limit: MAX_PAGE_SIZE }).success).toBe(true);
    expect(pageQuerySchema.safeParse({ limit: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });

  it('страница и размер положительные', () => {
    expect(pageQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ limit: -1 }).success).toBe(false);
  });
});

describe('pageSchema', () => {
  it('строит конверт вокруг элемента', () => {
    const schema = pageSchema(z.object({ id: z.string() }));

    expect(schema.parse({ items: [{ id: 'a' }], total: 1, page: 1, limit: 20 })).toEqual({
      items: [{ id: 'a' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('чужой элемент в списке не проходит', () => {
    const schema = pageSchema(z.object({ id: z.string() }));

    expect(schema.safeParse({ items: [{ id: 1 }], total: 1, page: 1, limit: 20 }).success).toBe(
      false,
    );
  });
});
