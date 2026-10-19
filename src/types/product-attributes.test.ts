import { describe, expect, it } from 'vitest';

import {
  categoryBySlug,
  PRODUCT_ATTRIBUTES,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_SLUGS,
  PRODUCT_OPTION_AXES,
  parseProductFilters,
  productAttrsSchema,
  productOptionsSchema,
} from './product-attributes.js';

describe('категории маркета', () => {
  it('у каждой категории свой адрес, и по адресу она находится обратно', () => {
    const slugs = PRODUCT_CATEGORIES.map((category) => PRODUCT_CATEGORY_SLUGS[category]);
    expect(new Set(slugs).size).toBe(PRODUCT_CATEGORIES.length);
    for (const category of PRODUCT_CATEGORIES) {
      expect(categoryBySlug(PRODUCT_CATEGORY_SLUGS[category])).toBe(category);
    }
    expect(categoryBySlug('rackets')).toBeNull();
  });

  it('ключи характеристик внутри категории не повторяются', () => {
    for (const category of PRODUCT_CATEGORIES) {
      const keys = PRODUCT_ATTRIBUTES[category].map((def) => def.key);
      expect(new Set(keys).size).toBe(keys.length);
      // Ключ характеристики и ось варианта делят один адрес списка.
      for (const axis of PRODUCT_OPTION_AXES[category]) expect(keys).not.toContain(axis);
    }
  });
});

describe('характеристики товара', () => {
  it('основание с характеристиками RTTF принимается', () => {
    expect(
      productAttrsSchema('BLADE').safeParse({
        bladeType: 'OFF_MINUS',
        construction: 'ALL_WOOD',
        plies: 5,
        weight: 85,
        thickness: 5.7,
        speed: 8,
        control: 8,
        headSize: '157 x 150',
        playStyle: 'FAST_ATTACK',
        sweetSpot: 'LARGE',
      }).success,
    ).toBe(true);
  });

  it('значение не из перечисления отвергается — иначе фильтр его не найдёт', () => {
    expect(productAttrsSchema('BLADE').safeParse({ bladeType: 'OFF-' }).success).toBe(false);
  });

  it('чужой ключ отвергается: у основания нет вращения', () => {
    expect(productAttrsSchema('BLADE').safeParse({ spin: 100 }).success).toBe(false);
    expect(productAttrsSchema('RUBBER').safeParse({ spin: 100 }).success).toBe(true);
  });

  it('число за пределами отвергается', () => {
    expect(productAttrsSchema('BLADE').safeParse({ weight: 1000 }).success).toBe(false);
  });

  it('несколько чисел — списком: жёсткость губки «39 / 40 / 41»', () => {
    const schema = productAttrsSchema('RUBBER');
    expect(schema.safeParse({ hardnessDeg: [39, 40, 41] }).success).toBe(true);
    expect(schema.safeParse({ hardnessDeg: [] }).success).toBe(false);
    expect(schema.safeParse({ hardnessDeg: 40 }).success).toBe(false);
  });

  it('да/нет и текст', () => {
    expect(productAttrsSchema('RUBBER').safeParse({ tensor: true }).success).toBe(true);
    expect(productAttrsSchema('RUBBER').safeParse({ tensor: 'да' }).success).toBe(false);
    expect(productAttrsSchema('CASE').safeParse({ material: ' ' }).success).toBe(false);
  });

  it('пустые характеристики допустимы: карточку можно завести и без них', () => {
    for (const category of PRODUCT_CATEGORIES) {
      expect(productAttrsSchema(category).safeParse({}).success).toBe(true);
    }
  });
});

describe('несколько значений из перечисления', () => {
  it('описание enums проверяется списком без повторов', () => {
    // В текущих описаниях `enums` нет, но схема строит его — проверка на
    // своём описании, чтобы новая характеристика такого вида не сломалась.
    const original = PRODUCT_ATTRIBUTES.OTHER;
    (PRODUCT_ATTRIBUTES as Record<string, unknown>).OTHER = [
      { key: 'kinds', kind: 'enums', values: ['GLUE', 'NET'], filter: true },
    ];
    try {
      const schema = productAttrsSchema('OTHER');
      expect(schema.safeParse({ kinds: ['GLUE', 'NET'] }).success).toBe(true);
      expect(schema.safeParse({ kinds: ['GLUE', 'GLUE'] }).success).toBe(false);
      expect(parseProductFilters('OTHER', { kinds: 'NET,ROBOT' }).attrs).toEqual([
        { key: 'kinds', kind: 'in', values: ['NET'] },
      ]);
    } finally {
      (PRODUCT_ATTRIBUTES as Record<string, unknown>).OTHER = original;
    }
  });
});

describe('варианты товара', () => {
  it('у основания — ручка', () => {
    const schema = productOptionsSchema('BLADE');
    expect(schema.safeParse({ handle: ['FL', 'ST', 'AN'] }).success).toBe(true);
    expect(schema.safeParse({ handle: ['XX'] }).success).toBe(false);
    expect(schema.safeParse({ handle: ['FL', 'FL'] }).success).toBe(false);
    expect(schema.safeParse({ color: ['RED'] }).success).toBe(false);
  });

  it('у накладки — толщина и цвет; max и OX — тоже толщина', () => {
    const schema = productOptionsSchema('RUBBER');
    expect(
      schema.safeParse({ thickness: ['2.1', '1.9', 'max', 'OX'], color: ['RED', 'BLACK'] }).success,
    ).toBe(true);
    expect(schema.safeParse({ thickness: ['21'] }).success).toBe(false);
  });

  it('у одежды — размер строкой', () => {
    expect(productOptionsSchema('TOP').safeParse({ size: ['XL', '52'] }).success).toBe(true);
  });
});

describe('фильтры из адреса', () => {
  it('перечисление — любое из списка, чужие значения отброшены', () => {
    expect(parseProductFilters('BLADE', { bladeType: 'OFF, ALL,XXX' }).attrs).toEqual([
      { key: 'bladeType', kind: 'in', values: ['OFF', 'ALL'] },
    ]);
    expect(parseProductFilters('BLADE', { bladeType: 'XXX' }).attrs).toEqual([]);
  });

  it('число — диапазоном с одной или двумя границами', () => {
    expect(parseProductFilters('BLADE', { weight: '80-90' }).attrs).toEqual([
      { key: 'weight', kind: 'range', min: 80, max: 90 },
    ]);
    expect(parseProductFilters('BLADE', { weight: '80-' }).attrs).toEqual([
      { key: 'weight', kind: 'range', min: 80 },
    ]);
    expect(parseProductFilters('BLADE', { thickness: '-5.8' }).attrs).toEqual([
      { key: 'thickness', kind: 'range', max: 5.8 },
    ]);
    expect(parseProductFilters('BLADE', { weight: '-' }).attrs).toEqual([]);
    expect(parseProductFilters('BLADE', { weight: 'тяжёлое' }).attrs).toEqual([]);
  });

  it('несколько чисел фильтруются тем же диапазоном', () => {
    const original = PRODUCT_ATTRIBUTES.RUBBER;
    (PRODUCT_ATTRIBUTES as Record<string, unknown>).RUBBER = original.map((def) =>
      def.key === 'hardnessDeg' ? { ...def, filter: true } : def,
    );
    try {
      expect(parseProductFilters('RUBBER', { hardnessDeg: '40-45' }).attrs).toEqual([
        { key: 'hardnessDeg', kind: 'range', min: 40, max: 45 },
      ]);
    } finally {
      (PRODUCT_ATTRIBUTES as Record<string, unknown>).RUBBER = original;
    }
  });

  it('да/нет — 1 или 0', () => {
    expect(parseProductFilters('RUBBER', { tensor: '1' }).attrs).toEqual([
      { key: 'tensor', kind: 'bool', value: true },
    ]);
    expect(parseProductFilters('TABLE', { foldable: '0' }).attrs).toEqual([
      { key: 'foldable', kind: 'bool', value: false },
    ]);
    expect(parseProductFilters('RUBBER', { tensor: 'yes' }).attrs).toEqual([]);
  });

  it('нефильтруемое, пустое и не строка — отброшены', () => {
    expect(
      parseProductFilters('BLADE', { speed: '5-9', bladeType: '', plies: ['5'] }).attrs,
    ).toEqual([]);
  });

  it('варианты — по оси категории', () => {
    expect(parseProductFilters('BLADE', { handle: 'FL,XX', color: 'RED' }).options).toEqual([
      { axis: 'handle', values: ['FL'] },
    ]);
    expect(parseProductFilters('BLADE', { handle: 'XX' }).options).toEqual([]);
    expect(parseProductFilters('BLADE', { handle: 5 }).options).toEqual([]);
  });
});
