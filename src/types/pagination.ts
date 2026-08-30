import { z } from 'zod';

/**
 * Постраничность списков.
 *
 * Потолок обязателен: без него `?limit=100000` превращает публичный список в
 * способ положить базу одним запросом. ТС 8.1 требует p95 меньше 200 мс —
 * выборка без границы это требование не выполнит никогда.
 */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * Конверт списка.
 *
 * Тип описан вручную, потому что он обобщённый: вывести `Page<T>` из схемы
 * нельзя, схема существует только для конкретного элемента. Сам элемент при
 * этом всегда DTO, выведенный из схемы, — требование брифа 3.1 соблюдено там,
 * где оно про данные, а не про обёртку.
 */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/** Схема конверта для конкретного элемента: нужна клиенту, если он разбирает ответ. */
export function pageSchema<TItem extends z.ZodType>(
  item: TItem,
): z.ZodObject<{
  items: z.ZodArray<TItem>;
  total: z.ZodNumber;
  page: z.ZodNumber;
  limit: z.ZodNumber;
}> {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  });
}
