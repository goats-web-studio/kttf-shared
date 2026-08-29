import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень репозитория kttf-shared. */
export const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Общая директория, в которой лежат все три репозитория рядом.
 *
 * Существует только на машине разработчика. В CI выкачан один репозиторий,
 * соседей нет — проверки раскладки в этом случае пропускаются, а не падают.
 */
export const WORKSPACE = resolve(PROJECT, '..');

export function projectPath(...segments: string[]): string {
  return join(PROJECT, ...segments);
}

export function workspacePath(...segments: string[]): string {
  return join(WORKSPACE, ...segments);
}

export function inProject(...segments: string[]): boolean {
  return existsSync(projectPath(...segments));
}

export function inWorkspace(...segments: string[]): boolean {
  return existsSync(workspacePath(...segments));
}

/** Соседние репозитории на месте — значит раскладку можно проверять. */
export const HAS_SIBLINGS = inWorkspace('kttf-back') && inWorkspace('kttf-front');

export function listWorkspace(): string[] {
  return readdirSync(WORKSPACE).sort();
}

export interface PackageJson {
  readonly name?: string;
  readonly engines?: Readonly<Record<string, string>>;
  readonly packageManager?: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

export function readPackageJson(...segments: string[]): PackageJson {
  return JSON.parse(readFileSync(projectPath(...segments, 'package.json'), 'utf8')) as PackageJson;
}

export function readText(...segments: string[]): string {
  return readFileSync(projectPath(...segments), 'utf8');
}
