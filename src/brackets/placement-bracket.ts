import { at } from './internal.js';
import {
  participantsOfGroups,
  undecided,
  type BracketResult,
  type Placement,
  type PlacementInput,
  type PlacementRow,
} from './placement-types.js';
import type { ParticipantId, TieGroup } from './types.js';

/**
 * Места, выводимые из сетки: олимпийка и «группы плюс сетка».
 *
 * Место в сетке определяется кругом вылета: проигравшие в одном круге заняли
 * один и тот же диапазон мест, потому что между собой они не играли. Разделить
 * их можно только встречей за третье место — единственной, которую регламент
 * для этого предусматривает.
 */

/** Олимпийка — ТЗ 5.1. */
export function bracketPlacement(input: PlacementInput): Placement {
  return fromBracket(input.bracket);
}

/**
 * Группы плюс сетка — ТЗ 5.1.
 *
 * Не вышедшие из группы места **не получают**: они выбыли на групповом этапе
 * и за места не играли. Приписать им порядок можно было бы только сравнением
 * игроков из разных групп, а такого правила нет ни в ТЗ 6.6, ни где-либо ещё
 * в документах: правила 1–5 разводят равенство внутри группы. Придумывать его
 * здесь запрещено брифом 4.2, поэтому у них `place: null` и причина
 * `GROUP_EXIT` — видно, что человек выбыл, а не что система не досчитала.
 *
 * Пока сетка не сыграна, выбывших ещё нет: групповой этап может идти прямо
 * сейчас. До первого результата в сетке места не определены у всех.
 */
export function groupsBracketPlacement(input: PlacementInput): Placement {
  const placement = fromBracket(input.bracket);
  const fromGroups = participantsOfGroups(input.groups);

  if (placement.rows.length === 0) {
    const known = [...new Set([...fromGroups, ...participantsOf(input.bracket)])];

    return { rows: undecided(known), shared: [], unresolved: [] };
  }

  const seen = new Set(placement.rows.map((row) => row.participant));
  const exits = fromGroups
    .filter((participant) => !seen.has(participant))
    .map((participant): PlacementRow => ({ participant, place: null, reason: 'GROUP_EXIT' }));

  return { ...placement, rows: [...placement.rows, ...exits] };
}

/**
 * Разбор сетки от финала вниз.
 *
 * Порядок именно такой, а не от первого круга: место считается от вершины,
 * и каждый следующий круг вылета занимает диапазон сразу за предыдущим.
 * Размер диапазона берётся из фактического числа проигравших, а не из размера
 * круга: при свободных проходах их меньше, и вычитать их из мест по формуле
 * значило бы оставить в таблице дыры.
 */
function fromBracket(bracket: readonly BracketResult[]): Placement {
  const main = bracket.filter((match) => match.kind === 'MAIN');

  if (main.length === 0) return { rows: [], shared: [], unresolved: [] };

  const finalRound = main.reduce((max, match) => Math.max(max, match.round), 0);
  const final = at(
    main.filter((match) => match.round === finalRound),
    0,
  );

  // Без сыгранного финала не определено ничего: чемпиона нет, а показывать
  // третье место в турнире без первого — вводить человека в заблуждение.
  if (final.winner === null || final.loser === null) {
    return { rows: undecided(participantsOf(bracket)), shared: [], unresolved: [] };
  }

  const rows: PlacementRow[] = [
    { participant: final.winner, place: 1, reason: 'BRACKET' },
    { participant: final.loser, place: 2, reason: 'BRACKET' },
  ];
  const shared: TieGroup[] = [];
  const third = bracket.find((match) => match.kind === 'THIRD_PLACE');

  let next = 3;
  let stopped = false;

  for (let round = finalRound - 1; round >= 1; round -= 1) {
    const losers = main.filter((match) => match.round === round).map((match) => match.loser);
    const known = losers.filter((participant) => participant !== null);

    if (known.length === 0) continue;

    // Недоигранный круг обрывает нумерацию: сколько мест он займёт, ещё
    // неизвестно, а значит неизвестны и все места ниже него.
    if (stopped || known.length < losers.length) {
      stopped = true;
      rows.push(...undecided(known));
      continue;
    }

    if (
      round === finalRound - 1 &&
      third?.winner !== undefined &&
      third.winner !== null &&
      third.loser !== null
    ) {
      rows.push({ participant: third.winner, place: next, reason: 'BRACKET' });
      rows.push({ participant: third.loser, place: next + 1, reason: 'BRACKET' });
      next += 2;
      continue;
    }

    if (known.length === 1) {
      rows.push({ participant: at(known, 0), place: next, reason: 'BRACKET' });
      next += 1;
      continue;
    }

    rows.push(
      ...known.map((participant): PlacementRow => ({ participant, place: null, reason: 'SHARED' })),
    );
    shared.push({ participants: known, places: known.map((_, index) => next + index) });
    next += known.length;
  }

  return { rows, shared, unresolved: [] };
}

/** Все, кто уже известен по сетке: участники сыгранных встреч. */
function participantsOf(bracket: readonly BracketResult[]): ParticipantId[] {
  return [
    ...new Set(
      bracket.flatMap((match) =>
        [match.winner, match.loser].filter((participant) => participant !== null),
      ),
    ),
  ];
}
