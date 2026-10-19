import { z } from 'zod';

/**
 * Характеристики товаров маркета — ADR-058, `docs/10` 4.3.
 *
 * Состав повторяет карточки RTTF. Хранятся в `Product.attrs` одним `Json`,
 * а проверяются здесь описанием категории: одна правда для формы, сервера,
 * фильтров и импорта. Значения — перечислениями, а не текстом: у RTTF «OFF-»
 * не совпадает ни с одним значением фильтра, и такой товар фильтр не находит.
 *
 * Подписи живут в словарях клиента, как подписи удобств клуба: здесь только
 * ключи.
 */

export const PRODUCT_CATEGORIES = [
  'BLADE',
  'RUBBER',
  'RACKET',
  'BALL',
  'CASE',
  'BAG',
  'TOP',
  'BOTTOM',
  'SOCKS',
  'SHOES',
  'TABLE',
  'OTHER',
] as const;
export const productCategorySchema = z.enum(PRODUCT_CATEGORIES);
export type ProductCategory = z.infer<typeof productCategorySchema>;

/** Категория в адресе: `/market/blades`. */
export const PRODUCT_CATEGORY_SLUGS: Readonly<Record<ProductCategory, string>> = {
  BLADE: 'blades',
  RUBBER: 'rubbers',
  RACKET: 'rackets',
  BALL: 'balls',
  CASE: 'cases',
  BAG: 'bags',
  TOP: 'tops',
  BOTTOM: 'bottoms',
  SOCKS: 'socks',
  SHOES: 'shoes',
  TABLE: 'tables',
  OTHER: 'other',
};

/** Категория по части адреса; `null` — такой категории нет. */
export function categoryBySlug(slug: string): ProductCategory | null {
  return PRODUCT_CATEGORIES.find((category) => PRODUCT_CATEGORY_SLUGS[category] === slug) ?? null;
}

export const COLORS = [
  'BLACK',
  'RED',
  'BLUE',
  'GREEN',
  'PINK',
  'PURPLE',
  'YELLOW',
  'ORANGE',
  'WHITE',
  'GREY',
  'BROWN',
  'NAVY',
  'BEIGE',
  'MULTI',
] as const;
export type Color = (typeof COLORS)[number];

/** Формы ручки. CS и JP — перо китайское и японское. */
export const HANDLES = ['FL', 'ST', 'AN', 'CO', 'FS', 'CS', 'JP'] as const;
export type Handle = (typeof HANDLES)[number];

/**
 * Описание характеристики.
 *
 * - `enum` — одно значение из списка, `enums` — несколько
 * - `number` — одно число, `numbers` — несколько (жёсткость губки «39 / 40 / 41»)
 * - `bool` — есть или нет
 * - `text` — строка там, где перечисление пока не сложилось (размер лопасти)
 *
 * `brandScale` — число по шкале производителя: сравнивать его можно только
 * внутри одной фирмы, и клиент так и пишет. `filter` — участвует ли в фильтрах.
 */
export type AttributeDef =
  | {
      readonly key: string;
      readonly kind: 'enum' | 'enums';
      readonly values: readonly string[];
      readonly filter: boolean;
    }
  | {
      readonly key: string;
      readonly kind: 'number' | 'numbers';
      readonly min: number;
      readonly max: number;
      readonly unit?: 'g' | 'mm' | 'deg' | 'kg' | 'pcs' | 'l';
      readonly brandScale?: true;
      readonly filter: boolean;
    }
  | { readonly key: string; readonly kind: 'bool'; readonly filter: boolean }
  | { readonly key: string; readonly kind: 'text'; readonly max: number; readonly filter: false };

const PLAY_STYLES = [
  'ATTACK',
  'FAST_ATTACK',
  'TOPSPIN',
  'ALLROUND',
  'CONTROL',
  'DEFENCE',
  'BLOCK',
] as const;
const BLADE_TYPES = ['OFF_PLUS', 'OFF', 'OFF_MINUS', 'ALL_PLUS', 'ALL', 'DEF', 'OFF_DEF'] as const;
const RUBBER_TYPES = ['INVERTED', 'SHORT_PIPS', 'MEDIUM_PIPS', 'LONG_PIPS', 'ANTI'] as const;
const AUDIENCES = ['MEN', 'WOMEN', 'UNISEX', 'KIDS'] as const;

/** Характеристики по категориям. Порядок — порядок показа на карточке. */
export const PRODUCT_ATTRIBUTES: Readonly<Record<ProductCategory, readonly AttributeDef[]>> = {
  BLADE: [
    { key: 'bladeType', kind: 'enum', values: BLADE_TYPES, filter: true },
    { key: 'construction', kind: 'enum', values: ['COMPOSITE', 'ALL_WOOD'], filter: true },
    { key: 'plies', kind: 'number', min: 1, max: 9, filter: true },
    { key: 'compositePlies', kind: 'number', min: 0, max: 6, filter: false },
    { key: 'weight', kind: 'number', min: 40, max: 150, unit: 'g', filter: true },
    { key: 'thickness', kind: 'number', min: 3, max: 12, unit: 'mm', filter: true },
    { key: 'speed', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'control', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'vibration', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'headSize', kind: 'text', max: 40, filter: false },
    { key: 'handleSize', kind: 'text', max: 40, filter: false },
    { key: 'playStyle', kind: 'enum', values: PLAY_STYLES, filter: true },
    { key: 'sweetSpot', kind: 'enum', values: ['SMALL', 'MEDIUM', 'LARGE'], filter: false },
  ],
  RUBBER: [
    { key: 'rubberType', kind: 'enum', values: RUBBER_TYPES, filter: true },
    { key: 'tensor', kind: 'bool', filter: true },
    { key: 'speed', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'spin', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'control', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'hardness', kind: 'enum', values: ['SOFT', 'MEDIUM', 'HARD'], filter: true },
    { key: 'hardnessDeg', kind: 'numbers', min: 20, max: 65, unit: 'deg', filter: false },
    { key: 'spongeColor', kind: 'enum', values: COLORS, filter: false },
    { key: 'weight', kind: 'number', min: 20, max: 120, unit: 'g', filter: false },
    { key: 'playStyle', kind: 'enum', values: PLAY_STYLES, filter: true },
  ],
  /** Готовые ракетки и наборы — у RTTF скрытая категория «Наборы, ракетки». */
  RACKET: [
    { key: 'bladeType', kind: 'enum', values: BLADE_TYPES, filter: true },
    { key: 'rubberType', kind: 'enum', values: RUBBER_TYPES, filter: true },
    { key: 'speed', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'spin', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'control', kind: 'number', min: 0, max: 200, brandScale: true, filter: false },
    { key: 'spongeThickness', kind: 'number', min: 0, max: 3, unit: 'mm', filter: false },
    { key: 'weight', kind: 'number', min: 40, max: 400, unit: 'g', filter: false },
    { key: 'racketCount', kind: 'number', min: 1, max: 10, unit: 'pcs', filter: true },
    { key: 'ballsIncluded', kind: 'number', min: 0, max: 100, unit: 'pcs', filter: false },
    { key: 'caseIncluded', kind: 'bool', filter: true },
    { key: 'playStyle', kind: 'enum', values: PLAY_STYLES, filter: true },
  ],
  BALL: [
    { key: 'material', kind: 'enum', values: ['PLASTIC', 'CELLULOID'], filter: true },
    { key: 'stars', kind: 'number', min: 0, max: 3, filter: true },
    { key: 'seam', kind: 'enum', values: ['SEAMED', 'SEAMLESS'], filter: true },
    { key: 'packCount', kind: 'number', min: 1, max: 1000, unit: 'pcs', filter: true },
  ],
  CASE: [
    {
      key: 'caseType',
      kind: 'enum',
      values: ['SINGLE', 'DOUBLE', 'HARD', 'SHAPED', 'TUBE'],
      filter: true,
    },
    { key: 'material', kind: 'text', max: 60, filter: false },
    { key: 'dimensions', kind: 'text', max: 60, filter: false },
  ],
  BAG: [
    {
      key: 'bagType',
      kind: 'enum',
      values: ['SPORTS_BAG', 'BACKPACK', 'SHOE_BAG', 'WAIST_BAG'],
      filter: true,
    },
    { key: 'volume', kind: 'number', min: 1, max: 200, unit: 'l', filter: false },
    { key: 'dimensions', kind: 'text', max: 60, filter: false },
    { key: 'material', kind: 'text', max: 60, filter: false },
  ],
  TOP: [
    { key: 'topType', kind: 'enum', values: ['TSHIRT', 'POLO', 'TANK'], filter: true },
    { key: 'audience', kind: 'enum', values: AUDIENCES, filter: true },
    { key: 'material', kind: 'text', max: 60, filter: false },
  ],
  BOTTOM: [
    { key: 'bottomType', kind: 'enum', values: ['SHORTS', 'SKIRT'], filter: true },
    { key: 'audience', kind: 'enum', values: AUDIENCES, filter: true },
    { key: 'material', kind: 'text', max: 60, filter: false },
  ],
  SOCKS: [
    { key: 'socksType', kind: 'enum', values: ['SHORT', 'LONG'], filter: true },
    { key: 'material', kind: 'text', max: 60, filter: false },
  ],
  SHOES: [
    { key: 'shoesType', kind: 'enum', values: ['SNEAKERS', 'SLIDES', 'INSOLES'], filter: true },
    { key: 'audience', kind: 'enum', values: AUDIENCES, filter: true },
  ],
  TABLE: [
    { key: 'tableType', kind: 'enum', values: ['INDOOR', 'OUTDOOR', 'MINI'], filter: true },
    { key: 'foldable', kind: 'bool', filter: true },
    { key: 'topThickness', kind: 'number', min: 3, max: 60, unit: 'mm', filter: true },
    { key: 'material', kind: 'text', max: 60, filter: false },
    { key: 'weight', kind: 'number', min: 1, max: 400, unit: 'kg', filter: false },
    { key: 'packageSize', kind: 'text', max: 60, filter: false },
    { key: 'playSize', kind: 'text', max: 60, filter: false },
    { key: 'foldedSize', kind: 'text', max: 60, filter: false },
  ],
  OTHER: [],
};

/**
 * Оси вариантов: ручка у основания, толщина и цвет у накладки, размер у
 * одежды. Вариант — не отдельный товар: магазин отмечает, какие есть у него.
 */
export const OPTION_AXES = ['handle', 'thickness', 'color', 'size'] as const;
export type OptionAxis = (typeof OPTION_AXES)[number];

export const PRODUCT_OPTION_AXES: Readonly<Record<ProductCategory, readonly OptionAxis[]>> = {
  BLADE: ['handle'],
  RUBBER: ['thickness', 'color'],
  RACKET: ['handle'],
  BALL: ['color'],
  CASE: ['color'],
  BAG: ['color'],
  TOP: ['color', 'size'],
  BOTTOM: ['color', 'size'],
  SOCKS: ['color', 'size'],
  SHOES: ['color', 'size'],
  TABLE: ['color'],
  OTHER: [],
};

/**
 * Толщина губки: миллиметры с десятыми или `max` и `OX` — без губки. Строкой,
 * потому что «max» у каждой фирмы своё и числом не является.
 */
export const THICKNESS_PATTERN = /^(?:max|OX|[0-3]\.\d)$/;

const optionValue: Readonly<Record<OptionAxis, z.ZodType<string>>> = {
  handle: z.enum(HANDLES),
  thickness: z.string().regex(THICKNESS_PATTERN),
  color: z.enum(COLORS),
  size: z.string().trim().min(1).max(20),
};

function uniqueList<T extends z.ZodType<string>>(item: T, max: number) {
  return z
    .array(item)
    .min(1)
    .max(max)
    .refine((list) => new Set(list).size === list.length, { message: 'Значение повторяется' });
}

function attributeSchema(def: AttributeDef): z.ZodType {
  switch (def.kind) {
    case 'enum':
      return z.enum(def.values as [string, ...string[]]);
    case 'enums':
      return uniqueList(z.enum(def.values as [string, ...string[]]), def.values.length);
    case 'number':
      return z.number().min(def.min).max(def.max);
    case 'numbers':
      return z.array(z.number().min(def.min).max(def.max)).min(1).max(10);
    case 'bool':
      return z.boolean();
    case 'text':
      return z.string().trim().min(1).max(def.max);
  }
}

/** Схема `attrs` категории: каждая характеристика необязательна, чужие ключи отвергаются. */
export function productAttrsSchema(category: ProductCategory): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const def of PRODUCT_ATTRIBUTES[category]) {
    shape[def.key] = attributeSchema(def).optional();
  }

  return z.strictObject(shape);
}

/** Схема `options` категории: ось — список значений, чужие оси отвергаются. */
export function productOptionsSchema(
  category: ProductCategory,
): z.ZodType<Partial<Record<OptionAxis, string[]>>> {
  const shape: Record<string, z.ZodType> = {};
  for (const axis of PRODUCT_OPTION_AXES[category]) {
    shape[axis] = uniqueList(optionValue[axis], 40).optional();
  }

  return z.strictObject(shape);
}

/**
 * Фильтр по характеристике из адреса списка.
 *
 * - перечисление и вариант — `?bladeType=OFF,ALL` (любое из)
 * - число — `?weight=80-90`, одна граница — `80-` или `-90`
 * - да/нет — `?tensor=1`
 */
export type AttributeFilter =
  | { readonly key: string; readonly kind: 'in'; readonly values: readonly string[] }
  | { readonly key: string; readonly kind: 'range'; readonly min?: number; readonly max?: number }
  | { readonly key: string; readonly kind: 'bool'; readonly value: boolean };

export interface OptionFilter {
  readonly axis: OptionAxis;
  readonly values: readonly string[];
}

export interface ProductFilters {
  readonly attrs: readonly AttributeFilter[];
  readonly options: readonly OptionFilter[];
}

const RANGE_PATTERN = /^(\d+(?:\.\d+)?)?-(\d+(?:\.\d+)?)?$/;

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Фильтры из параметров адреса. Неизвестные ключи и неверные значения молча
 * отбрасываются: ссылку на подборку могли собрать руками или со старой
 * версией описаний, и список по ней должен открыться, а не упасть.
 */
export function parseProductFilters(
  category: ProductCategory,
  query: Readonly<Record<string, unknown>>,
): ProductFilters {
  const attrs: AttributeFilter[] = [];
  for (const def of PRODUCT_ATTRIBUTES[category]) {
    const raw = query[def.key];
    if (!def.filter || typeof raw !== 'string' || raw.length === 0) continue;

    if (def.kind === 'enum' || def.kind === 'enums') {
      const values = splitList(raw).filter((value) => def.values.includes(value));
      if (values.length > 0) attrs.push({ key: def.key, kind: 'in', values });
    } else if (def.kind === 'number' || def.kind === 'numbers') {
      const match = RANGE_PATTERN.exec(raw);
      if (!match || (match[1] === undefined && match[2] === undefined)) continue;
      attrs.push({
        key: def.key,
        kind: 'range',
        ...(match[1] === undefined ? {} : { min: Number(match[1]) }),
        ...(match[2] === undefined ? {} : { max: Number(match[2]) }),
      });
    } else if (raw === '1' || raw === '0') {
      attrs.push({ key: def.key, kind: 'bool', value: raw === '1' });
    }
  }

  const options: OptionFilter[] = [];
  for (const axis of PRODUCT_OPTION_AXES[category]) {
    const raw = query[axis];
    if (typeof raw !== 'string') continue;
    const values = splitList(raw).filter((value) => optionValue[axis].safeParse(value).success);
    if (values.length > 0) options.push({ axis, values });
  }

  return { attrs, options };
}
