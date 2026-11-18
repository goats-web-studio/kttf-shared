/**
 * Юридические документы — ADR-091.
 *
 * Политика конфиденциальности и пользовательское соглашение выходят одной
 * редакцией: правка любого из них меняет `PRIVACY_POLICY_VERSION`. Сервер пишет
 * её в `User.privacyConsentVersion` при регистрации — так видно, с каким
 * текстом человек согласился.
 */

/** Редакция документов: дата публикации ГГГГ-ММ-ДД. */
export const PRIVACY_POLICY_VERSION = '2026-11-18';

export const LEGAL_DOCUMENTS = ['privacy', 'terms'] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

/** Адреса страниц документов на сайте. Мобильное приложение открывает их же. */
export const LEGAL_PATHS: Readonly<Record<LegalDocument, string>> = {
  privacy: '/privacy',
  terms: '/terms',
};

/** Языки текста документов. Русский — подлинник, остальные — переводы. */
export const LEGAL_LANGUAGES = ['ru', 'kk', 'en'] as const;
export type LegalLanguage = (typeof LEGAL_LANGUAGES)[number];

/** Якорь раздела «Удаление аккаунта» — его адрес просит Google Play. */
export const ACCOUNT_DELETION_ANCHOR = 'account-deletion';
