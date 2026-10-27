import { describe, expect, it } from 'vitest';

import {
  externalImports,
  HAS_SIBLINGS,
  inProject,
  inWorkspace,
  listWorkspace,
  readPackageJson,
  readText,
  readWorkspace,
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
    // CLAUDE.md — единственное исключение, и оно вынужденное: агент читает
    // его из рабочей директории, а работа идёт по всем четырём репозиториям
    // сразу. Уехав в kttf-shared, правила перестанут действовать в kttf-back
    // и kttf-front — то есть ровно там, где пишется код.
    const allowed = new Set([
      'kttf-back',
      'kttf-front',
      'kttf-shared',
      'kttf-infra',
      'kttf-mobile', // ADR-078
      'CLAUDE.md',
    ]);
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

describe('ADR-078 — мобильное приложение на Flutter, тонкий клиент', () => {
  const HAS_MOBILE = inWorkspace('kttf-mobile', 'pubspec.yaml');

  it('ТЗ называет Flutter, а не Expo', () => {
    const spec = readText('docs', '03-tech-spec.md');
    const mobile = spec.slice(spec.indexOf('### 2.3. Мобильное'), spec.indexOf('### 2.4.'));
    expect(mobile).toContain('Flutter');
    expect(mobile).toContain('kttf-mobile');
    expect(mobile, 'Expo заменён Flutter — ADR-078').not.toContain('Expo');
  });

  it.skipIf(!HAS_MOBILE)('у мобилки свои ADR-тесты и свои правила для агента', () => {
    expect(inWorkspace('kttf-mobile', 'test', 'adr', 'adr_test.dart')).toBe(true);
    expect(inWorkspace('kttf-mobile', 'CLAUDE.md')).toBe(true);
  });

  it.skipIf(!HAS_MOBILE)('перенос движка на Dart сверяется с этим кодом (ADR-079)', () => {
    // Вторая реализация движка допустима только под паритетом: эталоны,
    // снятые с TypeScript, и тест, который сравнивает с ними бит в бит.
    expect(inWorkspace('kttf-mobile', 'shared', 'tool', 'parity.mjs')).toBe(true);
    expect(inWorkspace('kttf-mobile', 'shared', 'test', 'parity', 'parity_test.dart')).toBe(true);
    expect(
      inWorkspace('kttf-mobile', 'shared', 'test', 'parity', 'fixtures', 'manifest.json'),
    ).toBe(true);
  });

  it.skipIf(!HAS_MOBILE)('консоли судьи в мобилке нет — она в PWA (ADR-004)', () => {
    expect(inWorkspace('kttf-mobile', 'lib', 'features', 'console')).toBe(false);
  });
});

describe('ADR-080 — мобилка: надёжность, доступность, офлайн', () => {
  const HAS_MOBILE = inWorkspace('kttf-mobile', 'pubspec.yaml');
  const mobile = (...segments: string[]): string => readWorkspace('kttf-mobile', ...segments);

  it.skipIf(!HAS_MOBILE)('у решений мобилки свои ADR-тесты и виджет-тесты', () => {
    expect(mobile('test', 'adr', 'adr_test.dart')).toContain('ADR-080');
    for (const test of [
      ['test', 'features', 'accessibility', 'text_scale_test.dart'],
      ['test', 'features', 'accessibility', 'tablet_test.dart'],
      ['test', 'app', 'session_test.dart'],
      ['test', 'common', 'api', 'offline_test.dart'],
    ]) {
      expect(inWorkspace('kttf-mobile', ...test), test.join('/')).toBe(true);
    }
  });

  it.skipIf(!HAS_MOBILE)('крупный шрифт — с потолком, контент на планшете — колонкой', () => {
    const theme = mobile('lib', 'app', 'theme.dart');
    expect(theme).toMatch(/maxTextScale = 1\.6;/);
    expect(theme).toMatch(/maxContentWidth = 600;/);
  });

  it.skipIf(!HAS_MOBILE)('выпуск без адреса API или не по https не запускается', () => {
    const api = mobile('lib', 'common', 'api', 'kttf_api.dart');
    expect(api).toContain('release: kReleaseMode');
    expect(api).toContain("uri.scheme != 'https'");
  });

  it.skipIf(!HAS_MOBILE)('refresh меняется один раз на все упавшие запросы (ADR-017)', () => {
    const session = mobile('lib', 'app', 'session.dart');
    expect(session).toContain('Future<T> authorized<T>');
    expect(session).toContain('_renewing ??=');
  });

  it.skipIf(!HAS_MOBILE)('время — UTC+5, как на сайте и в этом пакете', () => {
    const format = mobile('lib', 'common', 'format.dart');
    expect(format).toContain('Duration(hours: 5)');
    expect(format).not.toContain('.toLocal()');
  });

  it.skipIf(!HAS_MOBILE)('офлайн: в кэш — только публичное и прошедшее контракт', () => {
    const api = mobile('lib', 'common', 'api', 'kttf_api.dart');
    expect(api).toContain("method == 'GET' && accessToken == null ? this.cache : null");
    expect(inWorkspace('kttf-mobile', 'lib', 'common', 'ui', 'offline_bar.dart')).toBe(true);
  });

  it.skipIf(!HAS_MOBILE || !HAS_SIBLINGS)('контакты клуба — перенос contacts.ts сайта', () => {
    expect(inWorkspace('kttf-front', 'src', 'features', 'clubs', 'contacts.ts')).toBe(true);
    const contacts = mobile('lib', 'features', 'clubs', 'contacts.dart');
    expect(contacts).toContain('kttf-front/src/features/clubs/contacts.ts');
    for (const helper of ['telegramHandle', 'instagramHandle', 'whatsappUri', 'routeUri']) {
      expect(contacts).toContain(helper);
    }
  });

  it.skipIf(!HAS_MOBILE)('допуск на турнир в мобилке — этот движок, а не своё сравнение', () => {
    const panel = mobile('lib', 'features', 'tournaments', 'registration_panel.dart');
    expect(panel).toContain('checkEligibility(');
    expect(panel).toContain('session.authorized(');
  });

  it.skipIf(!HAS_MOBILE)('лента: незнакомая карточка пропускается (ADR-073)', () => {
    const feed = mobile('shared', 'lib', 'src', 'contract', 'feed.dart');
    expect(feed).toContain('kttf-shared/src/types/feed.ts');
    expect(feed).toContain('_ => null,');
  });

  it.skipIf(!HAS_MOBILE)('картинки с сервера — адрес API плюс путь', () => {
    expect(mobile('lib', 'common', 'ui', 'avatar.dart')).toContain('.media(');
  });

  it.skipIf(!HAS_MOBILE)('подписки в мобилке — от имени человека (ADR-073)', () => {
    expect(mobile('lib', 'features', 'follows', 'follow_button.dart')).toContain(
      'session.authorized(',
    );
  });

  it.skipIf(!HAS_MOBILE)('мобилка — для игрока и тренера: маршрутов администратора нет', () => {
    const api = mobile('lib', 'common', 'api', 'kttf_api.dart');
    for (const route of ['/admin', '/draw', '/publish', '/open-registration']) {
      expect(api, route).not.toContain(route);
    }
  });

  it.skipIf(!HAS_MOBILE)('дуэли в мобилке — действия по can сервера (ADR-065)', () => {
    const page = mobile('lib', 'features', 'duels', 'duel_page.dart');
    expect(page).toContain('can.respond');
    expect(page).toContain('can.confirm');
    expect(mobile('shared', 'lib', 'src', 'contract', 'duel.dart')).toContain(
      'kttf-shared/src/types/duel.ts',
    );
  });

  it.skipIf(!HAS_MOBILE)(
    'в настройках телефона — только выбор человека: тема, язык, город, отметка заставки',
    () => {
      const settings = mobile('lib', 'app', 'settings.dart');
      const keys = [...settings.matchAll(/static const String _\w+Key = '(\w+)';/g)].map(
        (m) => m[1],
      );
      expect(keys.sort()).toEqual(['city', 'cityName', 'introSeen', 'locale', 'theme']);
    },
  );
});

describe('ADR-081 — мобилка выглядит как сайт', () => {
  const HAS_MOBILE = inWorkspace('kttf-mobile', 'pubspec.yaml');

  it.skipIf(!HAS_MOBILE || !HAS_SIBLINGS)('гарнитуры мобилки — гарнитуры styles.css сайта', () => {
    const styles = readWorkspace('kttf-front', 'src', 'styles.css');
    const pubspec = readWorkspace('kttf-mobile', 'pubspec.yaml');
    for (const family of ['Roboto Flex', 'JetBrains Mono']) {
      expect(styles).toContain(`'${family}'`);
      expect(pubspec).toContain(`- family: ${family}`);
    }
    expect(pubspec, 'Inter заменён гарнитурами сайта').not.toContain('family: Inter');
  });

  it.skipIf(!HAS_MOBILE)('рисунок страницы — перенос site-backdrop.tsx', () => {
    expect(readWorkspace('kttf-mobile', 'lib', 'common', 'ui', 'backdrop.dart')).toContain(
      'site-backdrop.tsx',
    );
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
  it('движки не импортируют ничего внешнего', () => {
    // Проверка по существу, а не по составу package.json: бриф 3.3 требует
    // нулевых зависимостей именно от rating и brackets, потому что один и тот
    // же код исполняется на сервере и в браузере в офлайне. Раньше здесь
    // стоял запрет зависимостей у всего пакета — он был строже правила,
    // которое стерёг, и мешал положить рядом Zod-схемы. См. ADR-015.
    // `eligibility` в этом списке с 02.09.2026: правило допуска читают и
    // сервер при записи, и страница турнира до нажатия кнопки (ТЗ 4.3).
    for (const module of ['rating', 'brackets', 'eligibility']) {
      expect(
        externalImports('src', module),
        `src/${module} тянет внешний код. Офлайн-расчёт обязан совпадать с серверным.`,
      ).toEqual([]);
    }
  });

  it('Zod объявлен peer-зависимостью, а не обычной', () => {
    // Экземпляр Zod обязан быть один: схема, собранная одной копией
    // библиотеки, не проходит instanceof в другой. См. ADR-015.
    const pkg = readPackageJson();

    expect(pkg.dependencies ?? {}, 'Общий код не тянет зависимости за собой.').toEqual({});
    expect(pkg.peerDependencies?.zod, 'Zod ожидается в peerDependencies').toMatch(/^\^?4\./);
    expect(
      pkg.devDependencies?.zod,
      'Zod нужен и в devDependencies: без него prepare не соберёт пакет у потребителя.',
    ).toBeDefined();
  });

  it('общие типы доступны отдельным подпутём', () => {
    const pkg = readPackageJson();
    expect(JSON.stringify(pkg), './types не экспортируется').toContain('./types');
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
      '07-design-system.md',
      '08-ux-draft.md',
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
      'ADR-015',
      'ADR-016',
      'ADR-069',
      'ADR-070',
      'ADR-078',
      'ADR-079',
      'ADR-080',
      'ADR-081',
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
      ['GAP_ZERO', '100'],
      ['DELTA_DIVISOR', '10'],
      ['MIN_RATING', '1'],
      ['START_RATING', '250'],
      ['NOVICE_TOURNAMENTS', '5'],
      ['NOVICE_K_WIN', '1'],
      ['NOVICE_K_LOSS', '0.5'],
      ['NOVICE_SCORE_MULTIPLIER', '1'],
      ['TOURNAMENT_FACTOR_TOP', '0.4'],
      ['BONUS_MIN_PARTICIPANTS', '16'],
      ['BONUS_TOP_PLAYERS', '12'],
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
