import type { ParticipantId, ScheduledMatch } from './types.js';

/**
 * Поздняя запись в групповой этап — ADR-062.
 *
 * Самая частая ситуация в клубе: человек пришёл к началу второго тура.
 * Переигрывать жеребьёвку нельзя — сыгранное уже в таблице. Поэтому
 * опоздавший встаёт в одну из групп и получает встречи со всеми в ней.
 * Сыгранное остаётся как есть; таблица группы просто становится на строку
 * длиннее.
 */

/** Группа-кандидат: ключ и рейтинги участников. */
export interface LateGroupCandidate {
  readonly key: string;
  readonly ratings: readonly number[];
}

/**
 * Куда поставить опоздавшего, если организатор не выбрал сам.
 *
 * В самую малую группу: там встреч у остальных меньше, и турнир не
 * растягивается на одной группе. Из равных по размеру — в самую слабую по
 * сумме рейтингов: так группы остаются ровными по силе. При полном
 * равенстве — первая по порядку, чтобы выбор был предсказуем.
 *
 * @returns Ключ группы или `null`, если групп нет.
 */
export function chooseLateGroup(groups: readonly LateGroupCandidate[]): string | null {
  let best: { key: string; size: number; total: number } | null = null;

  for (const group of groups) {
    const size = group.ratings.length;
    const total = group.ratings.reduce((sum, rating) => sum + rating, 0);

    if (best === null || size < best.size || (size === best.size && total < best.total)) {
      best = { key: group.key, size, total };
    }
  }

  return best?.key ?? null;
}

/**
 * Встречи опоздавшего с каждым в группе.
 *
 * Туры идут после последнего сыгранного в группе: в очереди консоли его
 * встречи стоят за уже расписанными, а не вклиниваются в них. Во втором
 * круге стороны меняются, как в обычном расписании (ТЗ 5.2).
 *
 * @param members Участники группы.
 * @param rounds Кругов в группе: 1 или 2.
 * @param lastRound Последний тур, уже стоящий в расписании группы.
 */
export function scheduleLateEntry(
  members: readonly ParticipantId[],
  newcomer: ParticipantId,
  rounds: number,
  lastRound: number,
): ScheduledMatch[] {
  if (members.includes(newcomer)) {
    throw new Error('scheduleLateEntry: участник уже в группе');
  }

  const matches: ScheduledMatch[] = [];

  for (let cycle = 0; cycle < rounds; cycle += 1) {
    for (const member of members) {
      const round = lastRound + matches.length + 1;

      matches.push(
        cycle % 2 === 0 ? { round, a: newcomer, b: member } : { round, a: member, b: newcomer },
      );
    }
  }

  return matches;
}
