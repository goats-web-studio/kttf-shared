import type { ParticipantId, PlayedMatch } from './types.js';

/** Встреча, поставленная в расписание, но ещё не сыгранная. */
export interface PendingMatch {
  readonly a: ParticipantId;
  readonly b: ParticipantId;
}

/**
 * Несыгранные встречи снявшегося участника.
 *
 * ТЗ 4.4: уже сыгранные встречи остаются, несыгранные засчитываются сопернику
 * технической победой. В групповой таблице действует тот же порядок, чтобы
 * таблица и рейтинг считали одно и то же — ADR-009.
 *
 * Правило живёт здесь, а не в приложении, ровно по той же причине, по которой
 * здесь живёт сам расчёт таблицы: консоль в офлайне считает её локально, и
 * расхождение с сервером означало бы разные места у одного турнира. Это
 * запрет №2 брифа.
 *
 * @param pending Встречи без результата.
 * @param withdrawn Снявшиеся и не явившиеся участники.
 * @param setsToWin До скольких выигранных сетов идёт встреча — ТЗ 5.2.
 */
export function applyWithdrawals(
  pending: readonly PendingMatch[],
  withdrawn: readonly ParticipantId[],
  setsToWin: number,
): PlayedMatch[] {
  if (setsToWin < 1) {
    throw new Error('applyWithdrawals: setsToWin должно быть положительным');
  }

  const absent = new Set(withdrawn);
  const result: PlayedMatch[] = [];

  for (const match of pending) {
    const aOut = absent.has(match.a);
    const bOut = absent.has(match.b);

    // Снялись оба — засчитывать некому. Встреча просто не состоялась и в
    // таблицу не попадает: техническая победа существует ради соперника,
    // а соперника здесь нет.
    if (aOut === bOut) continue;

    result.push({
      a: match.a,
      b: match.b,
      setsA: aOut ? 0 : setsToWin,
      setsB: aOut ? setsToWin : 0,
      resultType: 'WALKOVER',
    });
  }

  return result;
}
