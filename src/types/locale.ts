import { z } from 'zod';

/**
 * Языки сайта — в порядке переключателя интерфейса (`kttf-front`,
 * `common/i18n/locale.ts`). Здесь — для данных на нескольких языках:
 * версии новостей KTTF (ADR-098).
 */
export const SITE_LOCALES = ['kk', 'en', 'ru', 'zh', 'ko', 'ja'] as const;
export const siteLocaleSchema = z.enum(SITE_LOCALES);
export type SiteLocale = z.infer<typeof siteLocaleSchema>;

/** Язык оригинала новости, если его не назвали: владелец пишет по-русски. */
export const DEFAULT_NEWS_LOCALE: SiteLocale = 'ru';
