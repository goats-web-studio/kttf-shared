import { describe, expect, it } from 'vitest';

import {
  HAS_SIBLINGS,
  inProject,
  inWorkspace,
  listWorkspace,
  readPackageJson,
  readText,
} from './repo.js';

/**
 * ADR-тесты.
 *
 * Решение, записанное только в markdown, живёт до первого человека, который его
 * не прочитал. Здесь решения из docs/06-decisions.md проверяются сборкой.
 * Падение такого теста означает не «поправь код», а «либо код разошёлся
 * с решением, либо решение устарело и нужна новая запись ADR».
 *
 * Часть проверок касается раскладки трёх репозиториев рядом. В CI выкачан
 * один — такие проверки пропускаются, а не падают ложно.
 */

describe('ADR-001 — три репозитория, приложения раздельно', () => {
  it('kttf-shared самодостаточен: свой package.json и свои зависимости', () => {
    const pkg = readPackageJson();
    expect(pkg.name).toBe('@kttf/shared');
    expect(pkg.engines?.node).toBe('>=24');
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });

  it('монорепозиторных артефактов не осталось', () => {
    // Воркспейс превратил бы три независимых репозитория обратно в один.
    expect(inProject('pnpm-workspace.yaml')).toBe(false);
    expect(inProject('turbo.json')).toBe(false);
    expect(inProject('apps')).toBe(false);
    expect(inProject('packages')).toBe(false);
  });

  it.skipIf(!HAS_SIBLINGS)('приложения лежат отдельными репозиториями рядом', () => {
    expect(inWorkspace('kttf-back')).toBe(true);
    expect(inWorkspace('kttf-front')).toBe(true);
    expect(inWorkspace('kttf-shared')).toBe(true);
  });

  it.skipIf(!HAS_SIBLINGS)('в общей директории нет ничего, кроме репозиториев', () => {
    // Требование владельца продукта: верхний уровень — только проекты.
    // Всё общее, включая документацию и конфигурацию, живёт в kttf-shared.
    const allowed = new Set(['kttf-back', 'kttf-front', 'kttf-shared', 'kttf-infra']);
    const unexpected = listWorkspace().filter((entry) => !allowed.has(entry));
    expect(
      unexpected,
      `На верхнем уровне появилось лишнее: ${unexpected.join(', ')}. ` +
        'Общий код, документация и конфигурация принадлежат kttf-shared. ' +
        'Новый проект — новая папка и новый репозиторий.',
    ).toEqual([]);
  });
});

describe('ADR-004 — фронтенд один, консоль внутри него', () => {
  it.skipIf(!HAS_SIBLINGS)('отдельного репозитория под консоль нет', () => {
    expect(inWorkspace('kttf-console')).toBe(false);
  });

  it.skipIf(!HAS_SIBLINGS)('консоль — модуль внутри kttf-front', () => {
    expect(inWorkspace('kttf-front', 'src', 'features', 'console')).toBe(true);
  });
});

describe('ADR-005 — инструментарий', () => {
  it('линтер — ESLint, а не Biome: нужны type-aware правила против any', () => {
    expect(inProject('config', 'eslint.preset.js')).toBe(true);
    expect(inProject('biome.json')).toBe(false);
    expect(inProject('biome.jsonc')).toBe(false);
  });

  it('пресет включает правила, работающие по типам', () => {
    const preset = readText('config', 'eslint.preset.js');
    expect(preset).toContain('strictTypeChecked');
    expect(preset).toContain('no-unsafe-assignment');
    expect(preset).toContain('no-explicit-any');
    expect(preset).toContain('projectService');
  });

  it('TypeScript закреплён на 6.x: typescript-eslint не поддерживает 7', () => {
    const pkg = readPackageJson();
    expect(
      pkg.devDependencies?.typescript,
      'Обновление до TS 7 сломает линтер целиком. См. ADR-005.',
    ).toMatch(/\^?6\./);
  });

  it('конфигурация экспортируется наружу — приложения берут её отсюда', () => {
    const pkg = readPackageJson();
    const exported = JSON.stringify(pkg);
    for (const entry of ['./config/tsconfig.base.json', './config/eslint', './config/prettier']) {
      expect(exported, `${entry} не экспортируется`).toContain(entry);
    }
  });
});

describe('чистые пакеты — запрет №2 брифа', () => {
  it('у kttf-shared нет ни одной runtime-зависимости', () => {
    const pkg = readPackageJson();
    expect(
      pkg.dependencies ?? {},
      'Общий код исполняется и на сервере, и в браузере в офлайне. ' +
        'Любая runtime-зависимость ставит это под угрозу.',
    ).toEqual({});
  });

  it('покрытие закреплено порогом 100%, а не пожеланием', () => {
    const config = readText('vitest.config.ts');
    expect(config).toContain('thresholds');
    for (const metric of ['statements', 'branches', 'functions', 'lines']) {
      expect(config, `порог ${metric} не равен 100`).toMatch(new RegExp(`${metric}:\\s*100`));
    }

    const pkg = readPackageJson();
    expect(
      pkg.scripts?.test,
      'Скрипт test обязан считать покрытие, иначе порог никогда не сработает.',
    ).toContain('--coverage');
  });

  it('движок не тянет ничего из Node', () => {
    const files = ['constants.ts', 'factors.ts', 'round.ts', 'calculate-match.ts', 'index.ts'];
    for (const file of files) {
      const source = readText('src', 'rating', file);
      expect(source, `${file} импортирует Node API`).not.toMatch(/from\s+'node:/);
      expect(source, `${file} обращается к process`).not.toMatch(/\bprocess\./);
    }
  });

  it('движок не знает ни про БД, ни про фреймворки, ни про localStorage', () => {
    const source = readText('src', 'rating', 'calculate-match.ts');
    for (const forbidden of ['prisma', '@nestjs', 'react', 'axios', 'localstorage']) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('документация — источник истины', () => {
  it('вся общая документация живёт здесь', () => {
    for (const file of [
      '00-README.md',
      '01-context.md',
      '02-requirements.md',
      '03-tech-spec.md',
      '04-agent-brief.md',
      '05-state.md',
      '06-decisions.md',
    ]) {
      expect(inProject('docs', file), `docs/${file} отсутствует`).toBe(true);
    }
    expect(inProject('CLAUDE.md')).toBe(true);
  });

  it('каждый ADR, проверяемый здесь, существует в журнале', () => {
    const decisions = readText('docs', '06-decisions.md');
    for (const adr of [
      'ADR-001',
      'ADR-003',
      'ADR-004',
      'ADR-005',
      'ADR-006',
      'ADR-007',
      'ADR-008',
      'ADR-009',
    ]) {
      expect(decisions, `${adr} отсутствует в журнале`).toContain(adr);
    }
  });

  it('CLAUDE.md обязывает агента пополнять контекст', () => {
    const claude = readText('CLAUDE.md');
    expect(claude).toContain('05-state.md');
    expect(claude).toContain('06-decisions.md');
  });

  it('константы формулы в коде совпадают с задокументированными', () => {
    const constants = readText('src', 'rating', 'constants.ts');
    const documented: readonly [string, string][] = [
      ['SCALE', '200'],
      ['GAP_ZERO', '100'],
      ['MIN_RATING', '1'],
      ['START_RATING', '250'],
      ['PROVISIONAL_THRESHOLD', '20'],
      ['K_BASE', '20'],
      ['K_PROV_WIN', '40'],
      ['K_PROV_LOSS', '20'],
    ];

    for (const [name, value] of documented) {
      expect(
        constants,
        `${name} разошлась с docs/02-requirements.md, раздел 7. ` +
          'Меняли формулу — обновите ТЗ и добавьте запись ADR.',
      ).toContain(`export const ${name} = ${value};`);
    }
  });
});

describe('запреты брифа, проверяемые автоматически', () => {
  it('секретов в репозитории нет: .env под игнором', () => {
    expect(readText('.gitignore')).toMatch(/^\.env$/m);
  });

  it('переводы строк зафиксированы — иначе вечные ложные диффы на Windows', () => {
    expect(readText('.gitattributes')).toContain('eol=lf');
  });
});
