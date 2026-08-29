import { at } from './internal.js';
import type { ParticipantId, ScheduledMatch } from './types.js';

/**
 * Расписание круговой схемы методом круга.
 *
 * Возвращает встречи, разбитые по турам: внутри тура каждый участник играет
 * не более одного раза. Разбивка по турам — не украшение. Консоль судьи
 * сортирует очередь по принципу «кто дольше не играл» (ТЗ 6.1), и без туров
 * такой порядок строить не из чего: список пар без структуры даёт очередь,
 * в которой один играет три встречи подряд, а другой сидит.
 *
 * При нечётном числе участников добавляется фиктивный, и тот, кто выпал
 * в паре с ним, в этом туре отдыхает.
 *
 * @param participants Участники. Порядок влияет на расписание, поэтому
 *   передавать его следует уже посеянным.
 * @param rounds 1 — каждый с каждым однажды, 2 — дважды со сменой сторон.
 */
export function scheduleRoundRobin(
  participants: readonly ParticipantId[],
  rounds: 1 | 2 = 1,
): ScheduledMatch[] {
  assertUniqueParticipants(participants);

  if (participants.length < 2) return [];

  const firstCircle = buildCircle(participants);
  if (rounds === 1) return firstCircle;

  // Второй круг: те же пары, стороны меняются местами. Нумерация туров
  // продолжается, чтобы очередь консоли видела единую последовательность.
  const roundsInCircle = countRounds(participants.length);
  const secondCircle = firstCircle.map((match) => ({
    round: match.round + roundsInCircle,
    a: match.b,
    b: match.a,
  }));

  return [...firstCircle, ...secondCircle];
}

/** Сколько туров в одном круге. */
export function countRounds(participantCount: number): number {
  if (participantCount < 2) return 0;
  return participantCount % 2 === 0 ? participantCount - 1 : participantCount;
}

/** Сколько встреч в схеме целиком. */
export function countRoundRobinMatches(participantCount: number, rounds: 1 | 2 = 1): number {
  if (participantCount < 2) return 0;
  return ((participantCount * (participantCount - 1)) / 2) * rounds;
}

const BYE = Symbol('bye');
type Slot = ParticipantId | typeof BYE;

function buildCircle(participants: readonly ParticipantId[]): ScheduledMatch[] {
  const slots: Slot[] = [...participants];
  if (slots.length % 2 === 1) slots.push(BYE);

  const size = slots.length;
  const matches: ScheduledMatch[] = [];

  for (let round = 0; round < size - 1; round += 1) {
    for (let i = 0; i < size / 2; i += 1) {
      const home = at(slots, i);
      const away = at(slots, size - 1 - i);
      if (home === BYE || away === BYE) continue;

      // Чередование сторон по чётности тура: без него первый участник
      // всегда играл бы одной и той же стороной во всех своих встречах.
      const swap = round % 2 === 1 && i === 0;
      matches.push({
        round: round + 1,
        a: swap ? away : home,
        b: swap ? home : away,
      });
    }

    rotate(slots);
  }

  return matches;
}

/** Первая позиция закреплена, остальные сдвигаются по кругу. */
function rotate(slots: Slot[]): void {
  const last = at(slots, slots.length - 1);
  slots.pop();
  slots.splice(1, 0, last);
}

function assertUniqueParticipants(participants: readonly ParticipantId[]): void {
  const seen = new Set(participants);
  if (seen.size !== participants.length) {
    throw new Error('scheduleRoundRobin: участники должны быть уникальны');
  }
}
