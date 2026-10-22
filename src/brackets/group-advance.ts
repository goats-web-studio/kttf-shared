import { at, mustGet } from './internal.js';
import { nextPowerOfTwo, seedOrder } from './knockout.js';
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
 * вторые, и так далее.** Внутри блока одного места одногруппники разводятся
 * по сетке как можно дальше друг от друга: второй номер группы попадает
 * в половину, противоположную её победителю, и встретиться они могут только
 * в финале (ADR-061). Блоки посева при этом не смешиваются: второй номер
 * никогда не получает посев выше чужого победителя.
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
  /**
   * Вышедшие в порядке посева: блоками по местам, одногруппники внутри блока
   * разведены по сетке (ADR-061). Пусто, если хоть одна группа не готова.
   */
  readonly seeded: readonly ParticipantId[];
  /** Вышедшие по местам: `byPlace[0]` — первые места в порядке групп. */
  readonly byPlace: readonly (readonly ParticipantId[])[];
  /**
   * Не вышедшие — тем же правилом посева: сначала все, кто стал в группе
   * следующим за зоной выхода, затем следующие (ADR-045), одногруппники
   * разведены (ADR-061). Из них строится
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

  const placeBlocks: Entry[][] = [];

  for (let place = 1; place <= advancePerGroup; place += 1) {
    const block = groups.flatMap((group, index) => {
      const row = group.rows.find((candidate) => candidate.place === place);
      return row === undefined ? [] : [{ participant: row.participant, group: index }];
    });

    placeBlocks.push(block);
  }

  const advancing = new Set(placeBlocks.flat().map((entry) => entry.participant));
  const longest = groups.reduce((max, group) => Math.max(max, group.rows.length), 0);
  const exitBlocks: Entry[][] = [];

  for (let position = advancePerGroup; position < longest; position += 1) {
    const block = groups.flatMap((group, index) => {
      const row = group.rows[position];
      return row === undefined || advancing.has(row.participant)
        ? []
        : [{ participant: row.participant, group: index }];
    });

    exitBlocks.push(block);
  }

  return {
    seeded: separate(placeBlocks),
    byPlace: placeBlocks.map((block) => block.map((entry) => entry.participant)),
    exits: separate(exitBlocks),
    blocked: [],
  };
}

/** Участник блока посева и номер его группы. */
interface Entry {
  readonly participant: ParticipantId;
  readonly group: number;
}

/**
 * Посев блоками мест с разведением одногруппников — ADR-061.
 *
 * Блок k занимает посевы сразу за блоком k − 1, а порядок внутри блока
 * выбирается так, чтобы участник встречал одногруппников по сетке как можно
 * позже. Мера — круг, в котором две позиции канонической расстановки могут
 * сойтись: у разных половин это финал, у разных четвертей — полуфинал.
 *
 * Внутри блока сначала ищется наибольший круг, который можно гарантировать
 * всем сразу, затем — расстановка с ним, ближайшая к порядку групп «змейкой»:
 * первые места в прямом порядке, вторые в обратном, третьи снова в прямом.
 * При восьми группах это ровно посев RTTF: вторые места — группы
 * 7, 8, 5, 6, 3, 4, 1, 2. Чистый обратный порядок не годится: при расстановке
 * `1 8 4 5 2 7 3 6` последний посев играет с первым, и победитель первой
 * группы встретил бы её же второй номер в первом круге (ADR-020).
 */
function separate(blocks: readonly (readonly Entry[])[]): ParticipantId[] {
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const size = nextPowerOfTwo(total);
  const order = seedOrder(size);
  const final = Math.log2(size);
  const placed = new Map<number, number[]>();
  const seeded: ParticipantId[] = [];

  blocks.forEach((block, index) => {
    const first = seeded.length + 1;
    const seeds = block.map((_entry, offset) => first + offset);
    // Круг, в котором участник на этом посеве сошёлся бы с ближайшим
    // одногруппником выше; без одногруппников — дальше финала.
    const meeting = (entry: Entry, seed: number): number =>
      Math.min(
        final + 1,
        ...(placed.get(entry.group) ?? []).map((other) =>
          roundOfMeeting(order.indexOf(seed), other),
        ),
      );
    const preferences = block.map((_entry, offset) => {
      const wanted = index % 2 === 0 ? at(seeds, offset) : at(seeds, seeds.length - 1 - offset);
      return [...seeds].sort(
        (left, right) => Math.abs(left - wanted) - Math.abs(right - wanted) || left - right,
      );
    });

    // С порогом в первый круг годится любой посев, поэтому цикл конечен.
    let threshold = final + 1;
    let owners = matchAll(block, preferences, meeting, threshold);
    while (owners === null) {
      threshold -= 1;
      owners = matchAll(block, preferences, meeting, threshold);
    }

    for (const seed of seeds) {
      const entry = at(block, mustGet(owners, seed));
      seeded.push(entry.participant);
      placed.set(entry.group, [...(placed.get(entry.group) ?? []), order.indexOf(seed)]);
    }
  });

  return seeded;
}

/** Круг, в котором сходятся две позиции сетки: 1 — первый, log2(размера) — финал. */
function roundOfMeeting(left: number, right: number): number {
  return 32 - Math.clz32(left ^ right);
}

/**
 * Каждому участнику блока — свой посев с разведением не ниже порога.
 *
 * Паросочетание увеличивающими путями (Кун): участник берёт первый
 * подходящий посев по своему порядку предпочтений, а занятый посев
 * освобождается, если прежнему владельцу есть куда уйти.
 *
 * @returns Владелец каждого посева (индекс в блоке) или `null`, если всем
 *   сразу посевов с таким разведением не хватает.
 */
export function matchAll(
  block: readonly Entry[],
  preferences: readonly (readonly number[])[],
  meeting: (entry: Entry, seed: number) => number,
  threshold: number,
): Map<number, number> | null {
  const owners = new Map<number, number>();

  const take = (index: number, visited: Set<number>): boolean => {
    for (const seed of at(preferences, index)) {
      if (visited.has(seed) || meeting(at(block, index), seed) < threshold) continue;
      visited.add(seed);

      const owner = owners.get(seed);
      if (owner === undefined || take(owner, visited)) {
        owners.set(seed, index);
        return true;
      }
    }
    return false;
  };

  for (let index = 0; index < block.length; index += 1) {
    if (!take(index, new Set())) return null;
  }

  return owners;
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
