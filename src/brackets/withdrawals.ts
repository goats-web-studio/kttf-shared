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
/** Встреча с участниками, известными или ещё нет: в сетке слот пуст до конца круга. */
export interface WithdrawalCandidate {
  readonly a: ParticipantId | null;
  readonly b: ParticipantId | null;
}

/**
 * Решена ли несыгранная встреча снятием участника — ADR-061.
 *
 * Да, если оба участника известны и хотя бы один снялся или не явился:
 * играть её никто не будет. В группе исход даёт расчёт таблицы
 * (`applyWithdrawals`), в сетке — техническая победа, которую записывает
 * сервер (`bracketWalkover`). Консоль и сервер отвечают на вопрос «осталось
 * ли это сыграть» одним правилом — запрет №2 брифа.
 */
export function isDecidedByWithdrawal(
  match: WithdrawalCandidate,
  withdrawn: ReadonlySet<ParticipantId>,
): boolean {
  if (match.a === null || match.b === null) return false;

  return withdrawn.has(match.a) || withdrawn.has(match.b);
}

/**
 * Техническая победа в сетке за снявшегося — ADR-061.
 *
 * В сетке встречу нельзя просто не играть, как в группе: без победителя
 * следующий круг остаётся без участника. Поэтому исход записывается в базу
 * обычным результатом `WALKOVER`, и соперник проходит дальше.
 *
 * Снялись оба — дальше проходит первый (сторона A), и следующей же
 * встречей сетки проигрывает так же технически. Иначе круг, где оба
 * соперника снялись, остановил бы сетку целиком.
 *
 * @returns Счёт технической победы или `null`, если встреча снятием не решена.
 */
export function bracketWalkover(
  match: WithdrawalCandidate,
  withdrawn: ReadonlySet<ParticipantId>,
  setsToWin: number,
): { readonly setsA: number; readonly setsB: number } | null {
  if (!isDecidedByWithdrawal(match, withdrawn)) return null;

  const aOut = match.a !== null && withdrawn.has(match.a);
  const bOut = match.b !== null && withdrawn.has(match.b);

  return aOut && !bOut ? { setsA: 0, setsB: setsToWin } : { setsA: setsToWin, setsB: 0 };
}

export function applyWithdrawals(
  pending: readonly PendingMatch[],
  withdrawn: readonly ParticipantId[],
  setsToWin: number,
  /**
   * Когда кто снялся — ADR-077, мс. Снялись оба: победа тому, кто снялся
   * позже, — он был в турнире, когда соперник ушёл, и победа досталась ему
   * тогда. Время неизвестно хоть у одного — встреча не засчитывается никому.
   */
  order: ReadonlyMap<ParticipantId, number> = new Map(),
): PlayedMatch[] {
  if (setsToWin < 1) {
    throw new Error('applyWithdrawals: setsToWin должно быть положительным');
  }

  const absent = new Set(withdrawn);
  const result: PlayedMatch[] = [];

  for (const match of pending) {
    const aOut = absent.has(match.a);
    const bOut = absent.has(match.b);

    if (!aOut && !bOut) continue;

    // Снялись оба: победа тому, кто ушёл позже (ADR-077). Без времени у
    // обоих встреча не засчитывается никому — так было до ADR-077.
    let aLoses = aOut;
    if (aOut && bOut) {
      const aAt = order.get(match.a);
      const bAt = order.get(match.b);
      if (aAt === undefined || bAt === undefined || aAt === bAt) continue;
      aLoses = aAt < bAt;
    }

    result.push({
      a: match.a,
      b: match.b,
      setsA: aLoses ? 0 : setsToWin,
      setsB: aLoses ? setsToWin : 0,
      resultType: 'WALKOVER',
    });
  }

  return result;
}
