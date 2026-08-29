import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Базовый пресет KTTF.
 *
 * Ключевое — type-aware правила. Бриф 3.1 запрещает `any` и требует `unknown`
 * с сужением. Синтаксическая проверка ловит только явное `any` в коде, а реальный
 * путь его проникновения — протекание из внешних типов и JSON.parse. Оно видно
 * только правилам с доступом к типам. См. 06-decisions.md, ADR-005.
 *
 * @param {string} tsconfigRootDir Директория пакета, где лежит tsconfig.json
 */
export default function preset(tsconfigRootDir) {
  return tseslint.config(
    // eslint.config.js — трёхстрочный бутстрап, который импортирует этот пресет.
    // Типов у него нет и быть не может, а type-aware правила требуют типизации
    // всего, что разбирают. Проверять его нечего.
    {
      ignores: [
        'dist/**',
        'coverage/**',
        'node_modules/**',
        // Сам линтер и его пресет: типов у них нет и быть не может,
        // а type-aware правила требуют типизации всего, что разбирают.
        'eslint.config.js',
        'config/eslint.preset.js',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-return': 'error',
        '@typescript-eslint/no-unsafe-argument': 'error',
        // Бриф 3.5: никаких пустых catch
        'no-empty': ['error', { allowEmptyCatch: false }],
        // Бриф 3.1: @ts-ignore только с причиной
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-expect-error': { descriptionFormat: '^: .+$' }, 'ts-ignore': true },
        ],
      },
    },
    prettier,
  );
}
