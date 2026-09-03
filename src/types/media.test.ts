import { describe, expect, it } from 'vitest';

import { PHOTO_MAX_BYTES, rejectPhoto } from './media.js';

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
