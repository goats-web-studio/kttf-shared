import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // test-cases.ts — генератор данных для тестов, а не код движка.
      // types.ts и index.ts — только типы и реэкспорты.
      exclude: ['src/rating/test-cases.ts', 'src/rating/types.ts', 'src/index.ts'],
      // Бриф 5.1: чистые пакеты покрываются на 100%. Порог здесь означает,
      // что просадка ломает сборку, а не остаётся замечанием в отчёте.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
