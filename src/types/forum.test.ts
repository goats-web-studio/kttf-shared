import { describe, expect, it } from 'vitest';

import {
  createForumPostSchema,
  createForumReportSchema,
  createForumTopicSchema,
  FORUM_POST_IMAGES_MAX,
  FORUM_QUOTE_MAX,
  forumPostPage,
  forumWarningInputSchema,
  hideForumPostSchema,
  listForumFeedSchema,
  listForumPostsSchema,
  listForumTopicsSchema,
  moderateForumTopicSchema,
  updateForumSectionSchema,
  FORUM_AUTHORED_AS,
  forumTranslationInputSchema,
  forumTranslationSchema,
  isKttfVoice,
  setForumTopicLocaleSchema,
  updateForumPostSchema,
} from './forum.js';
import { SITE_LOCALES } from './locale.js';
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

  it('страница ответа по номеру: первое сообщение — статья над ответами', () => {
    expect(forumPostPage(1)).toBe(1);
    expect(forumPostPage(2)).toBe(1);
    expect(forumPostPage(21)).toBe(1);
    expect(forumPostPage(22)).toBe(2);
    expect(forumPostPage(42, 10)).toBe(5);
  });

  it('ответы — по порядку, если порядок не задан', () => {
    expect(listForumPostsSchema.parse({}).sort).toBe('OLD');
    expect(listForumPostsSchema.parse({ replies: 'true' }).replies).toBe(true);
  });

  it('лента — новые сверху, поиск от двух знаков', () => {
    expect(listForumFeedSchema.parse({}).sort).toBe('NEW');
    expect(listForumFeedSchema.safeParse({ q: 'а' }).success).toBe(false);
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

  it('предупреждение «другое» — с комментарием', () => {
    const userId = id;
    expect(forumWarningInputSchema.safeParse({ userId, rule: 'OTHER' }).success).toBe(false);
    expect(forumWarningInputSchema.safeParse({ userId, rule: 'FLOOD' }).success).toBe(true);
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

describe('forum — от чьего лица (ADR-098)', () => {
  it('три режима; голос KTTF — оба, кроме «от себя»', () => {
    expect(FORUM_AUTHORED_AS).toEqual(['SELF', 'KTTF', 'KTTF_WITH_COAUTHOR']);
    expect(isKttfVoice('SELF')).toBe(false);
    expect(isKttfVoice('KTTF')).toBe(true);
    expect(isKttfVoice('KTTF_WITH_COAUTHOR')).toBe(true);
  });

  it('режим необязателен у ответа, темы и правки и не принимает чужих значений', () => {
    expect(createForumPostSchema.parse({ body: 'да' }).authoredAs).toBeUndefined();
    expect(createForumPostSchema.parse({ body: 'да', authoredAs: 'KTTF' }).authoredAs).toBe('KTTF');
    expect(createForumPostSchema.safeParse({ body: 'да', authoredAs: 'CLUB' }).success).toBe(false);
    expect(
      updateForumPostSchema.parse({ body: 'да', authoredAs: 'KTTF_WITH_COAUTHOR' }).authoredAs,
    ).toBe('KTTF_WITH_COAUTHOR');
    const topic = { sectionId: id, title: 'Новость', body: 'текст' };
    expect(
      createForumTopicSchema.parse({ ...topic, authoredAs: 'KTTF', locale: 'kk' }),
    ).toMatchObject({ authoredAs: 'KTTF', locale: 'kk' });
  });
});

describe('forum — версии новости (ADR-098)', () => {
  it('языки сайта — шесть, в порядке переключателя', () => {
    expect(SITE_LOCALES).toEqual(['kk', 'en', 'ru', 'zh', 'ko', 'ja']);
  });

  it('язык оригинала у темы — только из языков сайта', () => {
    expect(
      createForumTopicSchema.safeParse({ sectionId: id, title: 'Новость', body: 'т', locale: 'de' })
        .success,
    ).toBe(false);
    expect(setForumTopicLocaleSchema.safeParse({ locale: 'ja' }).success).toBe(true);
    expect(setForumTopicLocaleSchema.safeParse({ locale: 'kz' }).success).toBe(false);
  });

  it('версия: заголовок и текст обязательны, обложка — одно фото форума или ничего', () => {
    expect(forumTranslationInputSchema.parse({ title: ' Жаңалық ', body: ' мәтін ' })).toEqual({
      title: 'Жаңалық',
      body: 'мәтін',
    });
    expect(forumTranslationInputSchema.safeParse({ title: 'Жа', body: 'мәтін' }).success).toBe(
      false,
    );
    expect(forumTranslationInputSchema.safeParse({ title: 'Жаңалық', body: '  ' }).success).toBe(
      false,
    );
    expect(
      forumTranslationInputSchema.safeParse({ title: 'Жаңалық', body: 'т', image }).success,
    ).toBe(true);
    expect(
      forumTranslationInputSchema.safeParse({ title: 'Жаңалық', body: 'т', image: null }).success,
    ).toBe(true);
    const foreign = { ...image, url: `/api/v1/files/clubs/${id}.webp` };
    expect(
      forumTranslationInputSchema.safeParse({ title: 'Жаңалық', body: 'т', image: foreign })
        .success,
    ).toBe(false);
  });

  it('версия в ответе — с языком и временем правки', () => {
    const view = {
      locale: 'en',
      title: 'KTTF is open',
      body: 'Text',
      image: null,
      updatedAt: '2026-11-20T10:00:00.000Z',
    };
    expect(forumTranslationSchema.parse(view)).toEqual(view);
    expect(forumTranslationSchema.safeParse({ ...view, locale: 'fr' }).success).toBe(false);
  });
});
