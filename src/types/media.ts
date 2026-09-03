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
export function rejectPhoto(file: {
  readonly type: string;
  readonly size: number;
}): PhotoRejection {
  if (!PHOTO_CONTENT_TYPES.some((allowed) => allowed === file.type)) {
    return 'TYPE';
  }

  if (file.size > PHOTO_MAX_BYTES) {
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
