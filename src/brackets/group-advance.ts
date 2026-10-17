import type { ParticipantId, TieGroup } from './types.js';

/**
 * Кто выходит из групп и в каком порядке — основа плей-офф и финальных групп.
 *
 * Плей-офф и финальные группы при жеребьёвке не строятся: их сеют результаты
 * групп, которых до первой сыгранной встречи не существует. Здесь эти
 * результаты превращаются в посеянный список, и уже он идёт в `buildKnockout`
 * либо раскладывается по финальным группам.
 *
 * **Порядок посева: сначала все первые места в порядке групп, затем все
 * вторые, и так далее.** При канонической расстановке `buildKnockout` это
 * разводит одногруппников: победитель группы и её второй номер оказываются
 * в первом круге по разные стороны и раньше следующего круга не встретятся.
 */

/** Итог одной группы: строки таблицы с местами и неразрешённые равенства. */
export interface GroupPlacement {
  readonly label: string;
  readonly rows: readonly GroupPlacementRow[];
  /**
   * Равенства, которых правила 1–5 не развели. Пока такое равенство задевает
   * зону выхода, сеять следующий этап нечем: неизвестно, кто вышел. Решает
   * судья — ADR-008.
   */
  readonly unresolved: readonly TieGroup[];
}

export interface GroupPlacementRow {
  readonly participant: ParticipantId;
  /** Место в группе. `null`, пока равенство не разрешено судьёй. */
  readonly place: number | null;
}

export interface AdvancingSelection {
  /** Вышедшие в порядке посева. Пусто, если хоть одна группа не готова. */
  readonly seeded: readonly ParticipantId[];
  /** Вышедшие по местам: `byPlace[0]` — первые места в порядке групп. */
  readonly byPlace: readonly (readonly ParticipantId[])[];
  /**
   * Не вышедшие — в том же порядке посева: сначала все, кто стал в группе
   * следующим за зоной выхода, затем следующие (ADR-045). Из них строится
   * сетка за места. Порядок берётся по строкам таблицы, а не по месту:
   * равенство ниже зоны выхода отбору не мешает, и места у его участников
   * может ещё не быть, — посеву хватает предложенного порядка.
   */
  readonly exits: readonly ParticipantId[];
  /**
   * Метки групп, где места в зоне выхода ещё не определены. Пока список не
   * пуст, следующий этап не строится.
   */
  readonly blocked: readonly string[];
}

/**
 * Отбор вышедших из групп.
 *
 * @param groups Итоги групп в порядке их следования в этапе.
 * @param advancePerGroup Сколько выходит из каждой группы — ТЗ 5.2.
 */
export function selectAdvancing(
  groups: readonly GroupPlacement[],
  advancePerGroup: number,
): AdvancingSelection {
  if (!Number.isInteger(advancePerGroup) || advancePerGroup < 1) {
    throw new Error('selectAdvancing: из группы обязан выходить хотя бы один участник');
  }

  const blocked = groups.filter((group) => isBlocked(group, advancePerGroup)).map((g) => g.label);

  if (blocked.length > 0) return { seeded: [], byPlace: [], exits: [], blocked };

  const byPlace: ParticipantId[][] = [];

  for (let place = 1; place <= advancePerGroup; place += 1) {
    const row = groups
      .map((group) => group.rows.find((candidate) => candidate.place === place))
      .filter((candidate) => candidate !== undefined)
      .map((candidate) => candidate.participant);

    byPlace.push(row);
  }

  const advancing = new Set(byPlace.flat());
  const longest = groups.reduce((max, group) => Math.max(max, group.rows.length), 0);
  const exits: ParticipantId[] = [];

  for (let position = advancePerGroup; position < longest; position += 1) {
    for (const group of groups) {
      const row = group.rows[position];
      if (row !== undefined && !advancing.has(row.participant)) exits.push(row.participant);
    }
  }

  return { seeded: byPlace.flat(), byPlace, exits, blocked: [] };
}

/**
 * Готова ли группа отдать вышедших.
 *
 * Мешает не всякое равенство, а только задевающее зону выхода: спор за третье
 * место в группе, откуда выходят двое, на состав плей-офф не влияет и ждать
 * судью не заставляет.
 */
function isBlocked(group: GroupPlacement, advancePerGroup: number): boolean {
  return group.unresolved.some((tie) => tie.places.some((place) => place <= advancePerGroup));
}
