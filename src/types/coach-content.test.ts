import { describe, expect, it } from 'vitest';

import { createCoachPostSchema, updateCoachPostSchema } from './coach-content.js';

const ID = '0b6f3c4e-7a51-4b8a-9d2e-5f1c3a7b9e10';

const post = {
  kind: 'NEWS',
  title: 'Набор в детскую группу',
  body: 'С 1 ноября — новая группа 6–9 лет, пн/ср/пт в 17:00.',
};

describe('записи тренера', () => {
  it('новость без срока, акция со сроком', () => {
    expect(createCoachPostSchema.safeParse(post).success).toBe(true);
    expect(
      createCoachPostSchema.safeParse({ ...post, kind: 'PROMO', validUntil: '2026-11-01' }).success,
    ).toBe(true);
    expect(createCoachPostSchema.safeParse({ ...post, validUntil: '2026-11-01' }).success).toBe(
      false,
    );
  });

  it('картинка — только из папки тренера', () => {
    expect(
      createCoachPostSchema.safeParse({ ...post, imageUrl: `/api/v1/files/coaches/${ID}.webp` })
        .success,
    ).toBe(true);
    expect(
      createCoachPostSchema.safeParse({ ...post, imageUrl: `/api/v1/files/clubs/${ID}.webp` })
        .success,
    ).toBe(false);
  });

  it('правка — хотя бы одно поле, закреп отдельно', () => {
    expect(updateCoachPostSchema.safeParse({}).success).toBe(false);
    expect(updateCoachPostSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(
      updateCoachPostSchema.safeParse({ kind: 'NEWS', validUntil: '2026-11-01' }).success,
    ).toBe(false);
  });
});
