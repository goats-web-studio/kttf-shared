import { describe, expect, it } from 'vitest';

import {
  catalogImageVariant,
  createBrandSchema,
  createProductSchema,
  importProductRowSchema,
  listProductsSchema,
  reorderProductImagesSchema,
  slugify,
  suggestProductsSchema,
  updateBrandSchema,
  updateProductSchema,
} from './catalog.js';

const BRAND_ID = '00000000-0000-4000-8000-0000000000b1';
const IMAGE = '/api/v1/files/products/00000000-0000-4000-8000-000000000001.webp';

describe('адрес из названия', () => {
  it('латиница, цифры и дефисы', () => {
    expect(slugify('Tibhar', 'E. Lebesson')).toBe('tibhar-e-lebesson');
    expect(slugify('Butterfly', 'Tenergy 05 Hard')).toBe('butterfly-tenergy-05-hard');
    expect(slugify('Sauer&Troger', 'Hellfire X')).toBe('sauer-troger-hellfire-x');
  });

  it('диакритика снимается, кириллица и казахские буквы переводятся', () => {
    expect(slugify('DHS', 'Hurricane 3 Néo')).toBe('dhs-hurricane-3-neo');
    expect(slugify('Ракетка Щука')).toBe('raketka-schuka');
    expect(slugify('Мой клуб, ёлка')).toBe('moy-klub-elka');
    expect(slugify('Қазақ әлем')).toBe('kazak-alem');
  });

  it('пустой результат — item, длинный обрезается без хвостового дефиса', () => {
    expect(slugify('***')).toBe('item');
    const long = slugify('a'.repeat(79), 'b');
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('варианты картинки каталога', () => {
  it('своя картинка — по ширине, самая широкая — сам файл', () => {
    expect(catalogImageVariant(IMAGE, 240)).toBe(IMAGE.replace('.webp', '-240.webp'));
    expect(catalogImageVariant(IMAGE, 1280)).toBe(IMAGE);
  });

  it('чужая ссылка остаётся как есть', () => {
    expect(catalogImageVariant('https://example.com/a.png', 240)).toBe('https://example.com/a.png');
  });
});

describe('производитель', () => {
  it('название обязательно, сайт — только http(s)', () => {
    expect(createBrandSchema.safeParse({ name: 'Tibhar' }).success).toBe(true);
    expect(createBrandSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(
      createBrandSchema.safeParse({ name: 'Tibhar', website: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('правка: null стирает, пустое тело отвергается', () => {
    expect(updateBrandSchema.safeParse({ country: null }).success).toBe(true);
    expect(updateBrandSchema.safeParse({}).success).toBe(false);
  });
});

describe('товар', () => {
  const base = { category: 'BLADE', brandId: BRAND_ID, name: 'E. Lebesson' } as const;

  it('категория, производитель и название обязательны', () => {
    expect(createProductSchema.safeParse(base).success).toBe(true);
    expect(createProductSchema.safeParse({ ...base, name: '' }).success).toBe(false);
  });

  it('характеристики и варианты проверяются по категории', () => {
    expect(
      createProductSchema.safeParse({
        ...base,
        attrs: { bladeType: 'OFF', weight: 85 },
        options: { handle: ['FL', 'ST'] },
      }).success,
    ).toBe(true);

    const wrong = createProductSchema.safeParse({
      ...base,
      attrs: { spin: 100 },
      options: { thickness: ['2.1'] },
    });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues.map((issue) => issue.path[0])).toEqual(['attrs', 'options']);
  });

  it('русские написания без повторов с точностью до регистра', () => {
    expect(createProductSchema.safeParse({ ...base, aliases: ['Лебессон'] }).success).toBe(true);
    expect(
      createProductSchema.safeParse({ ...base, aliases: ['Лебессон', 'лебессон'] }).success,
    ).toBe(false);
  });

  it('правка: без категории характеристики не проверить — проверит сервер по сохранённой', () => {
    expect(updateProductSchema.safeParse({ attrs: { spin: 1 } }).success).toBe(true);
    expect(updateProductSchema.safeParse({ category: 'BLADE', attrs: { spin: 1 } }).success).toBe(
      false,
    );
    expect(updateProductSchema.safeParse({ description: null }).success).toBe(true);
    expect(updateProductSchema.safeParse({}).success).toBe(false);
  });
});

describe('список и подсказки', () => {
  it('по умолчанию — популярные, производители через запятую', () => {
    const parsed = listProductsSchema.parse({ brandId: `${BRAND_ID}, ${BRAND_ID}` });
    expect(parsed.sort).toBe('popular');
    expect(parsed.brandId).toEqual([BRAND_ID, BRAND_ID]);
    expect(listProductsSchema.safeParse({ sort: 'price' }).success).toBe(false);
  });

  it('подсказка — от двух знаков', () => {
    expect(suggestProductsSchema.safeParse({ q: 'л' }).success).toBe(false);
    expect(suggestProductsSchema.parse({ q: 'леб' }).limit).toBe(8);
  });

  it('порядок фото — без повторов', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(reorderProductImagesSchema.safeParse({ ids: [id] }).success).toBe(true);
    expect(reorderProductImagesSchema.safeParse({ ids: [id, id] }).success).toBe(false);
  });
});

describe('строка импорта', () => {
  const row = {
    rttfId: 946,
    category: 'BLADE',
    brand: { rttfId: 15, name: 'Tibhar' },
    name: 'E. Lebesson',
    attrs: { bladeType: 'OFF_MINUS' },
    options: { handle: ['FL'] },
    images: [{ url: 'https://rttf.ru/public/img/items/946/lebesson.jpg' }],
    imageCredit: 'rttf.ru',
  };

  it('полная строка принимается, пустые списки по умолчанию', () => {
    expect(importProductRowSchema.safeParse(row).success).toBe(true);
    const bare = importProductRowSchema.parse({
      ...row,
      attrs: undefined,
      options: undefined,
      images: undefined,
    });
    expect(bare.attrs).toEqual({});
    expect(bare.images).toEqual([]);
    expect(bare.popularity).toBe(0);
  });

  it('фото — только по https, характеристики — по категории', () => {
    expect(
      importProductRowSchema.safeParse({ ...row, images: [{ url: 'http://rttf.ru/a.jpg' }] })
        .success,
    ).toBe(false);
    expect(importProductRowSchema.safeParse({ ...row, attrs: { spin: 1 } }).success).toBe(false);
  });
});
