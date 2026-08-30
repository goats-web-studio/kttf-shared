import { mustGet } from './internal.js';
import type { BracketSource } from './knockout.js';
import type { ParticipantId } from './types.js';

/**
 * Продвижение по сетке — ADR-019.
 *
 * Сетка разворачивается целиком при жеребьёвке, и участник встречи следующего
 * круга задан источником: «победитель такой-то встречи». Здесь этот источник
 * превращается в участника.
 *
 * **Состав пересчитывается целиком, а не дописывается по одной встрече.**
 * Инкрементальная дозапись зависела бы от порядка ввода счёта и разошлась бы
 * при правке результата: старый победитель остался бы в полуфинале. Пересчёт
 * из источников идемпотентен, порядка не знает и правку обрабатывает сам —
 * изменившийся победитель едет вниз, а ставшее неопределимым обнуляется.
 */

/** Сторона встречи. */
export type MatchSide = 'A' | 'B';

/** Источник участника, ссылающийся на другую встречу. */
export type BracketSlotSource = Exclude<BracketSource, { kind: 'PARTICIPANT' }>;

/** Встреча сетки в том виде, в каком она хранится. */
export interface BracketSlotMatch {
  readonly id: string;
  readonly a: ParticipantId | null;
  readonly b: ParticipantId | null;
  /** `null` — участник известен изначально, пересчёту не подлежит. */
  readonly sourceA: BracketSlotSource | null;
  readonly sourceB: BracketSlotSource | null;
  /** Счёт по сетам. `null` — встреча не сыграна. */
  readonly setsA: number | null;
  readonly setsB: number | null;
}

/** Слот, содержимое которого изменилось. */
export interface SlotAssignment {
  readonly matchId: string;
  readonly side: MatchSide;
  /** `null` — источник участника пока не дал: встреча-источник не сыграна. */
  readonly participant: ParticipantId | null;
}

interface Slots {
  readonly a: ParticipantId | null;
  readonly b: ParticipantId | null;
}

/**
 * Кто занимает слоты сетки по её текущим результатам.
 *
 * Возвращаются **только изменившиеся** слоты: остальным запись не нужна.
 * Слот без источника не трогается никогда — там участник известен с самой
 * жеребьёвки.
 *
 * @param matches Все встречи этапа. Порядок роли не играет: значение слота
 *   вычисляется по источникам, а не по соседям в списке.
 * @throws Если источник ссылается на несуществующую встречу либо источники
 *   образуют цикл: это означает испорченную сетку, и продолжать расчёт по ней
 *   нельзя.
 */
export function resolveBracketSlots(matches: readonly BracketSlotMatch[]): SlotAssignment[] {
  const byId = new Map<string, BracketSlotMatch>();

  for (const match of matches) {
    if (byId.has(match.id)) {
      throw new Error(`resolveBracketSlots: встреча ${match.id} встречается дважды`);
    }
    byId.set(match.id, match);
  }

  const resolve = makeResolver(byId);
  const assignments: SlotAssignment[] = [];

  for (const match of matches) {
    const slots = resolve(match.id);

    if (slots.a !== match.a) {
      assignments.push({ matchId: match.id, side: 'A', participant: slots.a });
    }
    if (slots.b !== match.b) {
      assignments.push({ matchId: match.id, side: 'B', participant: slots.b });
    }
  }

  return assignments;
}

/**
 * Вычисление слотов вглубь по источникам.
 *
 * Ссылки образуют дерево, поэтому проще всего спуститься по нему рекурсивно
 * и запомнить посчитанное. Заодно ловится цикл: встреча, оказавшаяся в разборе
 * саму себя, ссылается на себя напрямую или через цепочку.
 */
function makeResolver(byId: ReadonlyMap<string, BracketSlotMatch>): (id: string) => Slots {
  const done = new Map<string, Slots>();
  const visiting = new Set<string>();

  function resolve(id: string): Slots {
    const cached = done.get(id);
    if (cached !== undefined) return cached;

    if (visiting.has(id)) {
      throw new Error(`resolveBracketSlots: источники встреч образуют цикл на ${id}`);
    }
    visiting.add(id);

    const match = mustGet(byId, id);
    const slots: Slots = {
      a: match.sourceA === null ? match.a : participantFrom(match.sourceA),
      b: match.sourceB === null ? match.b : participantFrom(match.sourceB),
    };

    visiting.delete(id);
    done.set(id, slots);

    return slots;
  }

  function participantFrom(source: BracketSlotSource): ParticipantId | null {
    const from = byId.get(source.matchId);

    if (from === undefined) {
      throw new Error(`resolveBracketSlots: источник ссылается на неизвестную ${source.matchId}`);
    }

    const outcome = outcomeOf(resolve(source.matchId), from);
    if (outcome === null) return null;

    return source.kind === 'WINNER' ? outcome.winner : outcome.loser;
  }

  return resolve;
}

/**
 * Победитель и проигравший встречи.
 *
 * Равный счёт победителя не даёт: ничьей во встрече не бывает, и данные,
 * в которых она появилась, лучше оставить без победителя, чем назначить его
 * произволом. Непосчитанная встреча тоже не даёт никого — несыгранной встречи
 * не существует.
 */
function outcomeOf(
  slots: Slots,
  match: BracketSlotMatch,
): { readonly winner: ParticipantId; readonly loser: ParticipantId } | null {
  const { a, b } = slots;
  const { setsA, setsB } = match;

  if (a === null || b === null || setsA === null || setsB === null || setsA === setsB) {
    return null;
  }

  return setsA > setsB ? { winner: a, loser: b } : { winner: b, loser: a };
}
