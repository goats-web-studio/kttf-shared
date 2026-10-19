import { z } from 'zod';

/**
 * Контракт загрузки файлов — ТС 7.9, ADR-036.
 *
 * Правило приёма файла живёт здесь по образцу допуска на турнир (ADR-029):
 * форма обязана отказать ровно тому файлу, которому откажет сервер. Иначе
 * человек ждёт загрузку десяти мегабайт по залу с плохим Wi-Fi, чтобы
 * получить отказ, который был виден сразу.
 */

/**
 * Потолок размера фото.
 *
 * Пять мегабайт — это заведомо больше любого разумного портрета и заведомо
 * меньше того, что кладёт в хранилище сырой кадр с телефона.
 */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Допустимые типы.
 *
 * Ни SVG, ни GIF: SVG — это документ со скриптом внутри, а анимация в
 * аватаре не нужна никому, кроме того, кто хочет ею мешать.
 */
export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/** Причина отказа. `null` — файл принимается. */
export type PhotoRejection = 'TYPE' | 'SIZE' | null;

/**
 * Принимается ли файл. Чистая функция: одна и та же на форме и на сервере.
 */
export function rejectPhoto(
  file: { readonly type: string; readonly size: number },
  maxBytes: number = PHOTO_MAX_BYTES,
): PhotoRejection {
  if (!PHOTO_CONTENT_TYPES.some((allowed) => allowed === file.type)) {
    return 'TYPE';
  }

  if (file.size > maxBytes) {
    return 'SIZE';
  }

  return null;
}

/**
 * Ответ на загрузку.
 *
 * Путь, а не абсолютная ссылка: домен у продукта один, и зашитый в базу
 * `https://localhost/...` пережил бы переезд на боевой домен ровно до первого
 * открытия профиля.
 */
export const uploadedFileSchema = z.object({
  url: z.string().min(1),
});
export type UploadedFile = z.infer<typeof uploadedFileSchema>;

/**
 * Картинки клуба — логотип и обложка (ADR-055).
 *
 * Потолок вдвое выше, чем у портрета: обложку снимают на телефон целиком,
 * а сервер всё равно пережимает её в WebP и снимает метаданные.
 */
export const CLUB_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const CLUB_IMAGE_KINDS = ['logo', 'cover'] as const;
export const clubImageKindSchema = z.enum(CLUB_IMAGE_KINDS);
export type ClubImageKind = z.infer<typeof clubImageKindSchema>;

/**
 * Ширины, в которых сервер хранит картинку клуба.
 *
 * Основной файл — самая широкая, остальные лежат рядом с суффиксом
 * `-<ширина>`: `clubs/<uuid>.webp`, `clubs/<uuid>-480.webp`. Меньше исходника
 * картинка не растягивается, поэтому у маленького логотипа все три файла
 * одинаковые — это дешевле, чем помнить, какие варианты есть.
 */
export const CLUB_IMAGE_WIDTHS = [480, 960, 1600] as const;
export type ClubImageWidth = (typeof CLUB_IMAGE_WIDTHS)[number];

/** Путь загруженной картинки клуба, как его отдаёт сервер. */
export const CLUB_IMAGE_PATH_PATTERN = /^\/api\/v1\/files\/clubs\/[0-9a-f-]{36}\.webp$/;

/**
 * Путь варианта нужной ширины. Для чужой ссылки — она сама: вариантов
 * у внешнего логотипа нет.
 */
export function clubImageVariant(url: string, width: ClubImageWidth): string {
  if (!CLUB_IMAGE_PATH_PATTERN.test(url) || width === 1600) return url;

  return url.replace(/\.webp$/, `-${String(width)}.webp`);
}

/** Ответ на загрузку картинки клуба: путь и размеры основного файла. */
export const uploadedImageSchema = z.object({
  url: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type UploadedImage = z.infer<typeof uploadedImageSchema>;
