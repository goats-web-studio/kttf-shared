import { describe, expect, it } from 'vitest';

import {
  createForumPostSchema,
  createForumReportSchema,
  createForumTopicSchema,
  FORUM_POST_IMAGES_MAX,
  FORUM_QUOTE_MAX,
  forumPostPage,
  hideForumPostSchema,
  listForumTopicsSchema,
  moderateForumTopicSchema,
  updateForumSectionSchema,
} from './forum.js';
import { notificationViewSchema } from './notification.js';

const id = '7f0c2c5e-4c8b-4d7a-9a51-0d6f0c1a2b3c';
const image = { url: `/api/v1/files/forum/${id}.webp`, width: 1280, height: 960 };

describe('forum — сообщения', () => {
  it('текст обрезается по краям и не бывает пустым', () => {
    expect(createForumPostSchema.parse({ body: '  привет  ' }).body).toBe('привет');
    expect(createForumPostSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('цитата — фрагмент не длиннее предела', () => {
    const quote = { postId: id, text: 'а'.repeat(FORUM_QUOTE_MAX + 1) };
    expect(createForumPostSchema.safeParse({ body: 'да', quote }).success).toBe(false);
  });

  it('фото — только загруженные на форум и не больше четырёх', () => {
    expect(createForumPostSchema.safeParse({ body: 'фото', images: [image] }).success).toBe(true);
    const foreign = { ...image, url: `/api/v1/files/clubs/${id}.webp` };
    expect(createForumPostSchema.safeParse({ body: 'фото', images: [foreign] }).success).toBe(
      false,
    );
    const many = Array.from({ length: FORUM_POST_IMAGES_MAX + 1 }, () => image);
    expect(createForumPostSchema.safeParse({ body: 'фото', images: many }).success).toBe(false);
  });

  it('тема — заголовок от трёх знаков', () => {
    expect(
      createForumTopicSchema.safeParse({ sectionId: id, title: 'ок', body: 'x' }).success,
    ).toBe(false);
  });

  it('страница сообщения по номеру', () => {
    expect(forumPostPage(1)).toBe(1);
    expect(forumPostPage(20)).toBe(1);
    expect(forumPostPage(21)).toBe(2);
    expect(forumPostPage(41, 10)).toBe(5);
  });
});

describe('forum — списки', () => {
  it('по умолчанию — по последней активности', () => {
    expect(listForumTopicsSchema.parse({}).sort).toBe('ACTIVE');
  });

  it('поиск — от двух знаков', () => {
    expect(listForumTopicsSchema.safeParse({ q: 'а' }).success).toBe(false);
  });
});

describe('forum — модерация', () => {
  it('скрыть без причины нельзя, вернуть — можно', () => {
    expect(hideForumPostSchema.safeParse({ hidden: true }).success).toBe(false);
    expect(hideForumPostSchema.safeParse({ hidden: false }).success).toBe(true);
  });

  it('скрытие темы требует причины, закрепление — нет', () => {
    expect(moderateForumTopicSchema.safeParse({ hidden: true }).success).toBe(false);
    expect(moderateForumTopicSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(moderateForumTopicSchema.safeParse({}).success).toBe(false);
  });

  it('жалоба «другое» — с комментарием', () => {
    expect(createForumReportSchema.safeParse({ reason: 'OTHER' }).success).toBe(false);
    expect(createForumReportSchema.safeParse({ reason: 'SPAM' }).success).toBe(true);
  });

  it('раздел — правка хотя бы одного поля', () => {
    expect(updateForumSectionSchema.safeParse({}).success).toBe(false);
    expect(updateForumSectionSchema.safeParse({ archived: true }).success).toBe(true);
  });
});

describe('forum — уведомления', () => {
  const base = { id, readAt: null, createdAt: '2026-10-24T10:00:00.000Z' };

  it('ответ, новые сообщения и скрытие разбираются контрактом', () => {
    const topic = { topicId: id, topicTitle: 'Накладки на 2027', postId: id, number: 3 };
    expect(
      notificationViewSchema.safeParse({
        ...base,
        type: 'FORUM_REPLY',
        data: { ...topic, authorName: 'Иванов Иван' },
      }).success,
    ).toBe(true);
    expect(
      notificationViewSchema.safeParse({
        ...base,
        type: 'FORUM_TOPIC_UPDATE',
        data: { ...topic, authorName: 'Иванов Иван', count: 2 },
      }).success,
    ).toBe(true);
    expect(
      notificationViewSchema.safeParse({
        ...base,
        type: 'FORUM_POST_HIDDEN',
        data: { ...topic, postId: null, number: null, reason: 'реклама' },
      }).success,
    ).toBe(true);
  });
});
