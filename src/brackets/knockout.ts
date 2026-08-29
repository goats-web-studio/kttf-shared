import { at } from './internal.js';
import type { ParticipantId } from './types.js';

/** Откуда берётся участник в конкретной позиции сетки. */
export type BracketSource =
  | { readonly kind: 'PARTICIPANT'; readonly participant: ParticipantId }
  | { readonly kind: 'WINNER'; readonly matchId: string }
  | { readonly kind: 'LOSER'; readonly matchId: string };

export interface BracketMatch {
  /** Устойчивый идентификатор: `R2M0`, `THIRD`. На него ссылаются другие встречи. */
  readonly id: string;
  /** Круг сетки, 1 — самый первый. Финал — последний. */
  readonly round: number;
  /** Позиция в круге, с нуля. */
  readonly slot: number;
  readonly a: BracketSource;
  readonly b: BracketSource;
  readonly kind: 'MAIN' | 'THIRD_PLACE';
}

export interface KnockoutBracket {
  /** Размер сетки: ближайшая сверху степень двойки. */
  readonly bracketSize: number;
  readonly rounds: number;
  readonly matches: readonly BracketMatch[];
  /** Сеяные, получившие свободный проход в первом круге. */
  readonly byes: readonly ParticipantId[];
}

export interface KnockoutOptions {
  /** Добавить встречу за третье место между проигравшими в полуфиналах. */
  readonly thirdPlace?: boolean;
}

/**
 * Построение олимпийской сетки.
 *
 * Участники передаются **уже посеянными**: первый в списке — первый номер
 * посева. Расстановка каноническая, при которой первый и второй номера могут
 * встретиться только в финале, первый и третий — не раньше полуфинала.
 *
 * Если участников не степень двойки, недостающие места отдаются свободными
 * проходами верхним сеяным. Встреча со свободным проходом не создаётся вовсе:
 * участник просто оказывается во втором круге. Это важно для рейтинга —
 * несыгранной встречи не существует, и начислять по ней нечего.
 */
export function buildKnockout(
  participants: readonly ParticipantId[],
  options: KnockoutOptions = {},
): KnockoutBracket {
  if (new Set(participants).size !== participants.length) {
    throw new Error('buildKnockout: участники должны быть уникальны');
  }
  if (participants.length < 2) {
    return { bracketSize: 0, rounds: 0, matches: [], byes: [] };
  }

  const bracketSize = nextPowerOfTwo(participants.length);
  const order = seedOrder(bracketSize);

  // Позиция в сетке получает участника с соответствующим номером посева.
  // Номера сверх числа участников означают свободный проход.
  let current: (BracketSource | null)[] = order.map((seed) => {
    const participant = participants[seed - 1];
    return participant === undefined ? null : { kind: 'PARTICIPANT', participant };
  });

  const matches: BracketMatch[] = [];
  const byes: ParticipantId[] = [];
  const rounds = Math.log2(bracketSize);

  for (let round = 1; round <= rounds; round += 1) {
    const next: (BracketSource | null)[] = [];

    for (let slot = 0; slot * 2 < current.length; slot += 1) {
      const left = at(current, slot * 2);
      const right = at(current, slot * 2 + 1);

      if (left !== null && right !== null) {
        const id = `R${String(round)}M${String(slot)}`;
        matches.push({ id, round, slot, a: left, b: right, kind: 'MAIN' });
        next.push({ kind: 'WINNER', matchId: id });
        continue;
      }

      // Свободный проход достаётся только левой позиции пары. В канонической
      // расстановке первый элемент каждой пары — номер из верхней половины,
      // второй — из нижней, а свободные проходы получают номера сверх числа
      // участников, то есть всегда самые большие. Проверено тестом
      // «свободный проход всегда во второй позиции пары».
      /* v8 ignore next -- правая ветка недостижима по построению расстановки */
      const advancing = left ?? right;
      if (round === 1 && advancing?.kind === 'PARTICIPANT') {
        byes.push(advancing.participant);
      }
      next.push(advancing);
    }

    current = next;
  }

  if (options.thirdPlace === true) {
    const thirdPlace = buildThirdPlace(matches, rounds);
    if (thirdPlace !== undefined) matches.push(thirdPlace);
  }

  return { bracketSize, rounds, matches, byes };
}

/** Встреча за третье место: проигравшие в полуфиналах. */
function buildThirdPlace(
  matches: readonly BracketMatch[],
  rounds: number,
): BracketMatch | undefined {
  const semifinals = matches.filter((match) => match.round === rounds - 1);
  // Полуфиналов меньше двух не бывает в сетке от четырёх участников;
  // при меньшем числе играть за третье место просто некому.
  if (semifinals.length !== 2) return undefined;

  return {
    id: 'THIRD',
    round: rounds,
    slot: 1,
    a: { kind: 'LOSER', matchId: at(semifinals, 0).id },
    b: { kind: 'LOSER', matchId: at(semifinals, 1).id },
    kind: 'THIRD_PLACE',
  };
}

export function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/**
 * Канонический порядок посева для сетки заданного размера.
 *
 * Строится удвоением: каждая позиция `s` предыдущего уровня превращается
 * в пару `s` и `size + 1 − s`. Так сильнейшие расходятся по разным половинам
 * и встречаются тем позже, чем выше посеяны.
 *
 * Для восьми: `1 8 4 5 2 7 3 6`.
 */
export function seedOrder(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) {
    throw new Error(
      `seedOrder: размер сетки должен быть степенью двойки, получено ${String(size)}`,
    );
  }

  let order = [1];
  while (order.length < size) {
    const doubled = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, doubled + 1 - seed);
    }
    order = next;
  }
  return order;
}
