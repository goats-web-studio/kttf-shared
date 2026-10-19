import { describe, expect, it } from 'vitest';

import { CLUB_IMAGE_MAX_BYTES, PHOTO_MAX_BYTES, clubImageVariant, rejectPhoto } from './media.js';

describe('приём фото', () => {
  it('обычный портрет принимается', () => {
    expect(rejectPhoto({ type: 'image/jpeg', size: 400_000 })).toBeNull();
  });

  it('SVG отвергается по типу', () => {
    // SVG — это документ со скриптом внутри, а не картинка.
    expect(rejectPhoto({ type: 'image/svg+xml', size: 1000 })).toBe('TYPE');
  });

  it('сырой кадр с телефона отвергается по размеру', () => {
    expect(rejectPhoto({ type: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 })).toBe('SIZE');
  });

  it('ровно потолок ещё принимается', () => {
    expect(rejectPhoto({ type: 'image/png', size: PHOTO_MAX_BYTES })).toBeNull();
  });

  it('тип проверяется раньше размера', () => {
    // Иначе человеку сообщат про размер файла, который не приняли бы никаким.
    expect(rejectPhoto({ type: 'application/pdf', size: PHOTO_MAX_BYTES + 1 })).toBe('TYPE');
  });
});

describe('картинки клуба', () => {
  const IMAGE = '/api/v1/files/clubs/11111111-1111-4111-8111-111111111111.webp';

  it('потолок задаётся вызывающим', () => {
    expect(
      rejectPhoto({ type: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 }, CLUB_IMAGE_MAX_BYTES),
    ).toBeNull();
  });

  it('вариант ширины лежит рядом с суффиксом', () => {
    expect(clubImageVariant(IMAGE, 480)).toBe(
      '/api/v1/files/clubs/11111111-1111-4111-8111-111111111111-480.webp',
    );
    expect(clubImageVariant(IMAGE, 1600)).toBe(IMAGE);
  });

  it('у внешней ссылки вариантов нет', () => {
    expect(clubImageVariant('https://x.kz/logo.png', 480)).toBe('https://x.kz/logo.png');
  });
});
