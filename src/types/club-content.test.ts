import { describe, expect, it } from 'vitest';

import {
  addClubVideoSchema,
  createClubPostSchema,
  hideClubContentSchema,
  isPromoExpired,
  listClubPostsSchema,
  parseYoutubeId,
  reorderClubMediaSchema,
  updateClubPostSchema,
} from './club-content.js';

const IMAGE = '/api/v1/files/clubs/11111111-1111-4111-8111-111111111111.webp';

describe('запись клуба', () => {
  const news = { kind: 'NEWS', title: 'Открылись после ремонта', body: 'Ждём всех!' };

  it('новость без срока и картинки принимается', () => {
    expect(createClubPostSchema.safeParse(news).success).toBe(true);
  });

  it('акция со сроком и своей картинкой принимается', () => {
    expect(
      createClubPostSchema.safeParse({
        ...news,
        kind: 'PROMO',
        validUntil: '2026-10-31',
        imageUrl: IMAGE,
      }).success,
    ).toBe(true);
  });

  it('срок у новости и чужая картинка отвергаются', () => {
    expect(createClubPostSchema.safeParse({ ...news, validUntil: '2026-10-31' }).success).toBe(
      false,
    );
    expect(
      createClubPostSchema.safeParse({ ...news, imageUrl: 'https://x.kz/a.jpg' }).success,
    ).toBe(false);
  });

  it('пустой текст и пустая правка отвергаются, закреп — правкой', () => {
    expect(createClubPostSchema.safeParse({ ...news, body: '   ' }).success).toBe(false);
    expect(updateClubPostSchema.safeParse({}).success).toBe(false);
    expect(updateClubPostSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(updateClubPostSchema.safeParse({ validUntil: null }).success).toBe(true);
  });

  it('архив — флагом в адресе', () => {
    expect(listClubPostsSchema.parse({ archive: 'true' }).archive).toBe(true);
  });
});

describe('акция завершилась', () => {
  it('после последнего дня, но не в сам день', () => {
    const promo = { kind: 'PROMO', validUntil: '2026-10-31' } as const;

    expect(isPromoExpired(promo, '2026-10-31')).toBe(false);
    expect(isPromoExpired(promo, '2026-11-01')).toBe(true);
  });

  it('у новости и бессрочной акции срока нет', () => {
    expect(isPromoExpired({ kind: 'NEWS', validUntil: null }, '2030-01-01')).toBe(false);
    expect(isPromoExpired({ kind: 'PROMO', validUntil: null }, '2030-01-01')).toBe(false);
  });
});

describe('ссылка на YouTube', () => {
  const ID = 'dQw4w9WgXcQ';

  it('все привычные виды ссылки', () => {
    for (const url of [
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/watch?v=${ID}&t=42`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `http://youtube.com/watch?v=${ID}`,
    ]) {
      expect(parseYoutubeId(url)).toBe(ID);
    }
  });

  it('не ссылка, чужой сайт, канал и кривой идентификатор — null', () => {
    for (const url of [
      'просто текст',
      `ftp://youtu.be/${ID}`,
      `https://vimeo.com/${ID}`,
      'https://www.youtube.com/@kttf',
      'https://www.youtube.com/watch',
      'https://youtu.be/short',
      'https://www.youtube.com/shorts',
    ]) {
      expect(parseYoutubeId(url)).toBeNull();
    }
  });
});

describe('медиа и модерация', () => {
  it('видео — ссылка и подпись по желанию', () => {
    expect(addClubVideoSchema.safeParse({ url: 'https://youtu.be/x' }).success).toBe(true);
    expect(addClubVideoSchema.safeParse({ url: '' }).success).toBe(false);
  });

  it('порядок галереи — непустой список идентификаторов', () => {
    expect(reorderClubMediaSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it('скрыть можно с причиной и без', () => {
    expect(hideClubContentSchema.safeParse({ hidden: true }).success).toBe(true);
    expect(hideClubContentSchema.safeParse({ hidden: true, reason: 'Реклама' }).success).toBe(true);
  });
});
