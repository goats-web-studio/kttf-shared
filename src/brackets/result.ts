import type { MatchOutcome } from './types.js';

/**
 * Проверка счёта встречи — ТЗ 6.3.
 *
 * Живёт в общем коде, потому что счёт вводится в консоли судьи, а она обязана
 * работать без сети (запрет №1). Отказ, который придёт от сервера через час
 * после ввода, судью уже не спасёт: проверять надо там же, где вводят, теми же
 * правилами, что применит сервер.
 *
 * Правила счёта **внутри** сета — 11 очков, разница в два — не проверяются:
 * ТЗ их не задаёт, а выдуманное ограничение отвергло бы законный протокол
 * посреди турнира.
 */

/** Чем именно счёт не годится. Локализуется на клиенте по коду. */
export type ResultProblem =
  /** Сеты не целые или отрицательные. */
  | 'SETS_INVALID'
  /** Равный счёт: ничьей во встрече не бывает. */
  | 'SETS_TIE'
  /** Обычная встреча: у победителя обязано быть ровно `setsToWin`. */
  | 'SETS_MISMATCH'
  /** Техническая победа: счёт обязан быть `setsToWin` : 0. */
  | 'WALKOVER_SETS'
  /** Снятие по ходу: сетов не может быть больше, чем нужно для победы. */
  | 'RETIRED_SETS'
  /** Счёт по сетам не сходится с числом выигранных сетов. */
  | 'SET_SCORES_MISMATCH'
  /** Сет без победителя. */
  | 'SET_SCORES_TIE'
  /** Технической победе счёт по сетам не положен: сетов не играли. */
  | 'SET_SCORES_NOT_ALLOWED';

export interface MatchResultInput {
  readonly setsA: number;
  readonly setsB: number;
  /** Счёт по сетам — опция, а не обязанность (ТЗ 6.3). */
  readonly setScores?: readonly (readonly [number, number])[] | undefined;
  readonly resultType: MatchOutcome;
}

/**
 * Годится ли счёт. `null` — годится.
 *
 * @param setsToWin До скольких выигранных сетов идёт встреча — ТЗ 5.2.
 */
export function validateMatchResult(
  result: MatchResultInput,
  setsToWin: number,
): ResultProblem | null {
  if (!Number.isInteger(setsToWin) || setsToWin < 1) {
    throw new Error('validateMatchResult: setsToWin должно быть целым положительным');
  }

  const { setsA, setsB, resultType } = result;

  if (!isCount(setsA) || !isCount(setsB)) return 'SETS_INVALID';
  if (setsA === setsB) return 'SETS_TIE';

  const winnerSets = Math.max(setsA, setsB);
  const loserSets = Math.min(setsA, setsB);

  if (resultType === 'NORMAL' && winnerSets !== setsToWin) return 'SETS_MISMATCH';

  // Техническая победа — встреча не игралась вовсе. Тот же счёт, что даёт
  // applyWithdrawals несыгранной встрече снявшегося, иначе таблица считала бы
  // одно и то же двумя способами.
  if (resultType === 'WALKOVER' && (winnerSets !== setsToWin || loserSets !== 0)) {
    return 'WALKOVER_SETS';
  }

  // Снявшийся по ходу мог не доиграть до победного сета, но перебрать его
  // не мог: тогда встреча просто закончилась бы обычной победой.
  if (resultType === 'RETIRED' && winnerSets > setsToWin) return 'RETIRED_SETS';

  return validateSetScores(result, winnerSets, loserSets);
}

function validateSetScores(
  result: MatchResultInput,
  winnerSets: number,
  loserSets: number,
): ResultProblem | null {
  const { setScores, setsA, resultType } = result;

  // Счёт по сетам — опция: без него не сработают только правила 3 и 5
  // разрешения равенства, и дело дойдёт до решения судьи.
  if (setScores === undefined || setScores.length === 0) return null;

  if (resultType === 'WALKOVER') return 'SET_SCORES_NOT_ALLOWED';

  if (setScores.length !== winnerSets + loserSets) return 'SET_SCORES_MISMATCH';

  let wonByA = 0;

  for (const [ballsA, ballsB] of setScores) {
    if (!isCount(ballsA) || !isCount(ballsB)) return 'SETS_INVALID';
    if (ballsA === ballsB) return 'SET_SCORES_TIE';
    if (ballsA > ballsB) wonByA += 1;
  }

  return wonByA === setsA ? null : 'SET_SCORES_MISMATCH';
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
