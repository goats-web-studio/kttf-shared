import { describe, expect, it } from 'vitest';

import { feedCurationSchema, feedItemSchema, feedQuerySchema, FEED_PAGE_MAX } from './feed.js';
import { followParamsSchema, followSuggestionsQuerySchema } from './follow.js';

const ID = '00000000-0000-4000-8000-000000000001';
const source = { kind: 'CLUB', id: ID, name: 'KTTF Тест', imageUrl: null, slug: null } as const;

describe('лента — ADR-073', () => {
  it('без параметров — вкладка «Все», первая страница', () => {
    expect(feedQuerySchema.parse({})).toEqual({ tab: 'ALL', page: 1, limit: 10 });
  });

  it('страница не больше потолка', () => {
    expect(feedQuerySchema.safeParse({ limit: FEED_PAGE_MAX + 1 }).success).toBe(false);
  });

  it('карточка различается типом', () => {
    const post = {
      id: `club-post:${ID}`,
      type: 'POST',
      at: '2026-10-25T10:00:00.000Z',
      source,
      discussion: null,
      pinned: false,
      hidden: false,
      kind: 'PROMO',
      title: 'Абонемент −20%',
      excerpt: 'До конца месяца',
      imageUrl: null,
      validUntil: '2026-10-31',
    };

    expect(feedItemSchema.safeParse(post).success).toBe(true);
    expect(feedItemSchema.safeParse({ ...post, type: 'NOPE' }).success).toBe(false);
  });

  it('новый уровень — от 1 до 10', () => {
    const item = {
      id: `level:${ID}`,
      type: 'ACHIEVEMENT',
      at: '2026-10-25T10:00:00.000Z',
      source: { ...source, kind: 'PLAYER' },
      discussion: null,
      pinned: false,
      hidden: false,
      achievement: { kind: 'LEVEL_UP', level: 11, rating: '1100.00', tournament: null },
    };

    expect(feedItemSchema.safeParse(item).success).toBe(false);
    expect(
      feedItemSchema.safeParse({ ...item, achievement: { ...item.achievement, level: 5 } }).success,
    ).toBe(true);
  });
});

describe('подписки — ADR-073', () => {
  it('подписаться можно на клуб, тренера и игрока', () => {
    expect(followParamsSchema.safeParse({ type: 'CLUB', id: ID }).success).toBe(true);
    expect(followParamsSchema.safeParse({ type: 'TOURNAMENT', id: ID }).success).toBe(false);
  });

  it('рекомендаций по умолчанию пять', () => {
    expect(followSuggestionsQuerySchema.parse({}).limit).toBe(5);
  });
});

describe('управление лентой — ADR-075', () => {
  it('решение по карточке — закрепить или скрыть, хоть одно', () => {
    expect(feedCurationSchema.safeParse({ itemId: 'club-post:1', pinned: true }).success).toBe(
      true,
    );
    expect(feedCurationSchema.safeParse({ itemId: 'club-post:1' }).success).toBe(false);
  });
});
