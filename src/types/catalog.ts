import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';
import {
  type ProductCategory,
  productAttrsSchema,
  productCategorySchema,
  productOptionsSchema,
} from './product-attributes.js';

/**
 * Контракт каталога маркета — ADR-058, `docs/10` 4.1.
 *
 * Каталог — общий справочник инвентаря продукта: товары и производители.
 * Заводит и правит его администратор платформы, наполняется он импортом
 * выгрузки RTTF. Предложения магазинов и инвентарь игроков ссылаются на него
 * и описаны в своих файлах.
 */

// ---------- адреса и картинки ----------

/** Часть адреса: латиница, цифры и дефисы. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CYRILLIC: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ә: 'a',
  ғ: 'g',
  қ: 'k',
  ң: 'n',
  ө: 'o',
  ұ: 'u',
  ү: 'u',
  һ: 'h',
  і: 'i',
};

/**
 * Адрес из названия: «Tibhar E. Lebesson» → `tibhar-e-lebesson`. Кириллица
 * переводится латиницей. Пустой результат — `item`: адрес нужен всегда, а
 * совпадения сервер разводит суффиксом.
 */
export function slugify(...parts: readonly string[]): string {
  // Кириллица — до разложения: NFKD превращает «й» в «и» со знаком, и знак снялся бы.
  const latin = Array.from(parts.join(' ').toLowerCase(), (letter) => CYRILLIC[letter] ?? letter);
  const slug = latin
    .join('')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');

  return slug.length > 0 ? slug : 'item';
}

/** Путь загруженной картинки товара или производителя, как его отдаёт сервер. */
export const CATALOG_IMAGE_PATH_PATTERN =
  /^\/api\/v1\/files\/(?:products|brands)\/[0-9a-f-]{36}\.webp$/;

/**
 * Ширины картинки товара. 240 — карточка в плитке, 640 — страница товара,
 * 1280 — во весь экран. Варианты лежат рядом с суффиксом, как у клуба.
 */
export const CATALOG_IMAGE_WIDTHS = [240, 640, 1280] as const;
export type CatalogImageWidth = (typeof CATALOG_IMAGE_WIDTHS)[number];

export function catalogImageVariant(url: string, width: CatalogImageWidth): string {
  if (!CATALOG_IMAGE_PATH_PATTERN.test(url) || width === 1280) return url;

  return url.replace(/\.webp$/, `-${String(width)}.webp`);
}

// ---------- производители ----------

const optionalText = z.string().trim().min(1).max(200);

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(100),
  country: optionalText.max(60).optional(),
  website: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .optional(),
  logoUrl: z.string().regex(CATALOG_IMAGE_PATH_PATTERN).optional(),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

const brand = createBrandSchema.shape;

/** `null` стирает необязательное поле (ADR-043). */
export const updateBrandSchema = createBrandSchema
  .extend({
    country: brand.country.unwrap().nullable(),
    website: brand.website.unwrap().nullable(),
    logoUrl: brand.logoUrl.unwrap().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' });
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

export const brandRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});
export type BrandRef = z.infer<typeof brandRefSchema>;

export const brandViewSchema = brandRefSchema.extend({
  country: z.string().nullable(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  /** Опубликованных товаров по категориям; категорий без товаров нет. */
  counts: z.partialRecord(productCategorySchema, z.number().int().positive()),
});
export type BrandView = z.infer<typeof brandViewSchema>;

// ---------- товары ----------

export const PRODUCT_STATUSES = ['PENDING', 'PUBLISHED'] as const;
export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const PRODUCT_DESCRIPTION_MAX = 4000;
export const PRODUCT_ALIASES_MAX = 10;
export const PRODUCT_IMAGES_MAX = 12;

const aliases = z
  .array(z.string().trim().min(1).max(100))
  .max(PRODUCT_ALIASES_MAX)
  .refine((list) => new Set(list.map((alias) => alias.toLowerCase())).size === list.length, {
    message: 'Написание повторяется',
  });

/**
 * Характеристики и варианты проверяются описанием своей категории. Поэтому
 * проверка — после разбора объекта целиком: без категории не понять, какие
 * ключи допустимы.
 */
function checkByCategory(
  value: { category?: ProductCategory | undefined; attrs?: unknown; options?: unknown },
  ctx: z.RefinementCtx,
): void {
  if (value.category === undefined) return;

  for (const [field, schema] of [
    ['attrs', productAttrsSchema(value.category)],
    ['options', productOptionsSchema(value.category)],
  ] as const) {
    if (value[field] === undefined) continue;
    const result = schema.safeParse(value[field]);
    for (const issue of result.error?.issues ?? []) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: [field, ...issue.path] });
    }
  }
}

const productFields = z.object({
  category: productCategorySchema,
  brandId: z.uuid(),
  /** Без слова категории и производителя: «E. Lebesson». */
  name: z.string().trim().min(1).max(120),
  aliases: aliases.optional(),
  description: z.string().trim().min(1).max(PRODUCT_DESCRIPTION_MAX).optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const createProductSchema = productFields.superRefine(checkByCategory);
export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Правка товара. Категория меняется вместе с характеристиками: сервер
 * проверяет итог по новой категории. `null` у описания стирает его.
 */
export const updateProductSchema = productFields
  .extend({ description: productFields.shape.description.unwrap().nullable() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нужно указать хотя бы одно поле' })
  .superRefine(checkByCategory);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const PRODUCT_SORTS = ['popular', 'name', 'new'] as const;
export const productSortSchema = z.enum(PRODUCT_SORTS);
export type ProductSort = z.infer<typeof productSortSchema>;

const commaSeparated = z.string().transform((value) => value.split(',').map((part) => part.trim()));

/**
 * Список товаров. Фильтры по характеристикам приходят своими параметрами
 * (`?bladeType=OFF&weight=80-90`) и разбираются `parseProductFilters`:
 * их состав зависит от категории, и схемой списка его не описать.
 */
export const listProductsSchema = pageQuerySchema.extend({
  category: productCategorySchema.optional(),
  brandId: commaSeparated.pipe(z.array(z.uuid()).min(1).max(20)).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: productSortSchema.default('popular'),
});
export type ListProductsQuery = z.infer<typeof listProductsSchema>;

/** Подсказки при вводе: короткий ответ без постраничности. */
export const suggestProductsSchema = z.object({
  q: z.string().trim().min(2).max(100),
  category: productCategorySchema.optional(),
  limit: z.coerce.number().int().positive().max(20).default(8),
});
export type SuggestProductsQuery = z.infer<typeof suggestProductsSchema>;

export const productImageViewSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  credit: z.string().nullable(),
});
export type ProductImageView = z.infer<typeof productImageViewSchema>;

export const productListItemViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  category: productCategorySchema,
  name: z.string(),
  brand: brandRefSchema,
  image: productImageViewSchema.omit({ credit: true }).nullable(),
});
export type ProductListItemView = z.infer<typeof productListItemViewSchema>;

export const productViewSchema = productListItemViewSchema.omit({ image: true }).extend({
  aliases: z.array(z.string()),
  description: z.string().nullable(),
  attrs: z.record(z.string(), z.unknown()),
  options: z.record(z.string(), z.array(z.string())),
  images: z.array(productImageViewSchema),
  status: productStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProductView = z.infer<typeof productViewSchema>;

/** Порядок фото: полный список идентификаторов товара. */
export const reorderProductImagesSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(PRODUCT_IMAGES_MAX)
    .refine((list) => new Set(list).size === list.length, { message: 'Фото повторяется' }),
});

export const setProductHiddenSchema = z.object({ hidden: z.boolean() });

// ---------- импорт ----------

/**
 * Строка импорта каталога — `docs/10`, раздел 6.
 *
 * Выгрузку RTTF к этому формату приводит скрипт сведения. Ключ повторного
 * импорта — `rttfId`: тот же товар обновляется, а не заводится вторым. Фото
 * сервер скачивает сам, только с разрешённых адресов, и только товару без фото.
 */
export const importProductRowSchema = z
  .object({
    rttfId: z.number().int().positive(),
    category: productCategorySchema,
    brand: z.object({
      rttfId: z.number().int().positive(),
      name: createBrandSchema.shape.name,
    }),
    name: productFields.shape.name,
    aliases: aliases.optional(),
    description: productFields.shape.description,
    attrs: z.record(z.string(), z.unknown()).default({}),
    options: z.record(z.string(), z.unknown()).default({}),
    images: z
      .array(z.object({ url: z.url({ protocol: /^https$/ }).max(500) }))
      .max(PRODUCT_IMAGES_MAX)
      .default([]),
    /** Откуда фото — пишется в `credit`. */
    imageCredit: optionalText.max(60).optional(),
    /**
     * Начальная популярность — порядок «популярные» до того, как накопятся
     * свои просмотры. Не показывается: это не наши просмотры.
     */
    popularity: z.number().int().nonnegative().default(0),
  })
  .superRefine(checkByCategory);
export type ImportProductRow = z.infer<typeof importProductRowSchema>;

/** Пачка импорта. Небольшая: сервер скачивает фото каждой строки. */
export const IMPORT_BATCH_MAX = 50;

export const importProductsSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(IMPORT_BATCH_MAX),
});

/** Итог строки: заведён, обновлён или отвергнут с причиной. */
export const importRowResultSchema = z.object({
  rttfId: z.number().int().nullable(),
  outcome: z.enum(['created', 'updated', 'rejected']),
  reason: z.string().optional(),
});
export type ImportRowResult = z.infer<typeof importRowResultSchema>;
