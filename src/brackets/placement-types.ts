import type { ParticipantId, Standings, TieGroup } from './types.js';

/**
 * Общий словарь расчёта мест — ТЗ 9.4.
 *
 * Вынесен отдельно от диспетчера, чтобы стратегии не импортировали его,
 * а он — их: иначе получается цикл, который держится только на ленивости
 * ESM и ломается от перестановки импортов.
 */

/**
 * Схема проведения в терминах расчёта мест.
 *
 * Повторяет `formatConfig.type` из контракта, но объявлена здесь своим
 * литералом: движок не имеет права зависеть от Zod-схем (бриф 3.3).
 */
export type PlacementScheme =
  | 'ROUND_ROBIN'
  | 'KNOCKOUT'
  | 'GROUPS_KNOCKOUT'
  | 'GROUPS_FINAL_GROUPS';

/**
 * Откуда взялось место — или почему его нет.
 *
 * `GROUP_EXIT` и `UNDECIDED` оба дают `place: null`, но означают разное:
 * первый — участник выбыл на групповом этапе и мест не разыгрывал, второй —
 * место ещё не определено. Свести их в одно значило бы показать человеку
 * пустую клетку без объяснения.
 */
export type PlacementReason = 'TABLE' | 'BRACKET' | 'SHARED' | 'GROUP_EXIT' | 'UNDECIDED';

export interface PlacementRow {
  readonly participant: ParticipantId;
  /** Итоговое место. `null` — не определено, причина в `reason`. */
  readonly place: number | null;
  readonly reason: PlacementReason;
}

export interface Placement {
  readonly rows: readonly PlacementRow[];
  /**
   * Участники, делящие диапазон мест: проигравшие в полуфиналах, когда встречи
   * за третье место нет. Это не спор и не ошибка — они действительно не играли
   * между собой, и разделить их нечем.
   */
  readonly shared: readonly TieGroup[];
  /**
   * Равенства в таблицах, которые обязан развести судья, — ADR-008. Пока
   * список не пуст, места определены не полностью.
   */
  readonly unresolved: readonly TieGroup[];
}

/** Таблица одной группы вместе с её порядком в этапе. */
export interface GroupTable {
  readonly order: number;
  readonly standings: Standings;
}

/**
 * Встреча сетки с известным исходом.
 *
 * `winner` и `loser` равны `null` у несыгранной встречи. Такой круг не даёт
 * мест: неизвестно, кто в него попал.
 */
export interface BracketResult {
  /** Круг сетки, 1 — самый первый. Финал — последний. */
  readonly round: number;
  readonly kind: 'MAIN' | 'THIRD_PLACE';
  readonly winner: ParticipantId | null;
  readonly loser: ParticipantId | null;
}

export interface PlacementInput {
  /** Таблицы группового этапа либо единственной круговой. */
  readonly groups: readonly GroupTable[];
  /** Таблицы финальных групп — схема «группы + финальные группы». */
  readonly finalGroups: readonly GroupTable[];
  /** Встречи олимпийской сетки. */
  readonly bracket: readonly BracketResult[];
}

/** Таблицы по возрастанию порядка: он задаёт и диапазоны мест финальных групп. */
export function byOrder(groups: readonly GroupTable[]): GroupTable[] {
  return [...groups].sort((left, right) => left.order - right.order);
}

/** Все участники переданных таблиц, без повторов и в порядке появления. */
export function participantsOfGroups(groups: readonly GroupTable[]): ParticipantId[] {
  return [
    ...new Set(byOrder(groups).flatMap((group) => group.standings.rows.map((row) => row.participant))),
  ];
}

/** Места не определены: этап не доигран либо сетка ещё не построена. */
export function undecided(participants: readonly ParticipantId[]): PlacementRow[] {
  return participants.map((participant) => ({ participant, place: null, reason: 'UNDECIDED' }));
}
