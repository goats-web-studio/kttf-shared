import { at } from './internal.js';
import {
  byOrder,
  participantsOfGroups,
  type Placement,
  type PlacementInput,
  type PlacementRow,
} from './placement-types.js';
import type { Standings, TieGroup } from './types.js';

/**
 * Места, выводимые из таблиц: круговая и «группы + финальные группы».
 *
 * Обе схемы разыгрывают места за столом, а не в сетке, и отличаются только
 * смещением: в круговой оно нулевое, в финальных группах k-я группа начинается
 * там, где кончилась предыдущая. Поэтому обе живут в одном файле — общая у них
 * не «часть кода», а сам способ определить место.
 */

/**
 * Круговая — ТЗ 5.1. Место берётся из таблицы как есть.
 *
 * Группа ожидается одна: круговая на то и круговая, что все играют со всеми.
 * Несколько групп означали бы, что жеребьёвка построила не ту схему, и тихо
 * сложить их места друг за другом было бы выдумыванием правила.
 */
export function singleTablePlacement(input: PlacementInput): Placement {
  if (input.groups.length === 0) {
    return { rows: [], shared: [], unresolved: [] };
  }
  if (input.groups.length > 1) {
    throw new Error(
      `singleTablePlacement: круговая схема ожидает одну таблицу, получено ${String(input.groups.length)}`,
    );
  }

  const { rows, unresolved } = fromStandings(at(byOrder(input.groups), 0).standings, 0);

  return { rows, shared: [], unresolved };
}

/**
 * Группы плюс финальные группы — ТЗ 5.1.
 *
 * k-я финальная группа собирает тех, кто занял k-е место в своей группе, и
 * играет за свой диапазон мест. Диапазон начинается там, где кончился
 * предыдущий, поэтому смещение — это сумма размеров предшествующих групп,
 * а не номер группы: группы бывают разного размера.
 */
export function finalGroupsPlacement(input: PlacementInput): Placement {
  const rows: PlacementRow[] = [];
  const unresolved: TieGroup[] = [];
  let offset = 0;

  for (const group of byOrder(input.finalGroups)) {
    const part = fromStandings(group.standings, offset);

    rows.push(...part.rows);
    unresolved.push(...part.unresolved);
    offset += group.standings.rows.length;
  }

  // Схема задумана так, что финальные группы забирают всех. Если кто-то
  // всё-таки остался за бортом, его место не определено, а не равно нулю.
  const seen = new Set(rows.map((row) => row.participant));
  const missed = participantsOfGroups(input.groups).filter((participant) => !seen.has(participant));

  rows.push(
    ...missed.map((participant): PlacementRow => ({ participant, place: null, reason: 'UNDECIDED' })),
  );

  return { rows, shared: [], unresolved };
}

/**
 * Строки таблицы в строки мест со смещением.
 *
 * Неразрешённое равенство приезжает сюда с `place: null` из движка таблиц
 * (ADR-008) и таким же уходит: судья ещё не сказал своего слова, и придумывать
 * за него порядок нельзя. Диапазоны в `unresolved` смещаются вместе с местами.
 */
function fromStandings(
  standings: Standings,
  offset: number,
): { rows: PlacementRow[]; unresolved: TieGroup[] } {
  const rows = standings.rows.map(
    (row): PlacementRow =>
      row.place === null
        ? { participant: row.participant, place: null, reason: 'UNDECIDED' }
        : { participant: row.participant, place: row.place + offset, reason: 'TABLE' },
  );

  const unresolved = standings.unresolved.map((tie) => ({
    participants: [...tie.participants],
    places: tie.places.map((place) => place + offset),
  }));

  return { rows, unresolved };
}
