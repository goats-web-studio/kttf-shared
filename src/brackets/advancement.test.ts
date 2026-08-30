import { describe, expect, it } from 'vitest';

import { resolveBracketSlots, type BracketSlotMatch, type SlotAssignment } from './advancement.js';
import { buildKnockout } from './knockout.js';

/** Встреча сетки с умолчаниями: не сыграна, участники известны. */
function match(id: string, over: Partial<BracketSlotMatch> = {}): BracketSlotMatch {
  return {
    id,
    a: null,
    b: null,
    sourceA: null,
    sourceB: null,
    setsA: null,
    setsB: null,
    ...over,
  };
}

function winner(matchId: string): BracketSlotMatch['sourceA'] {
  return { kind: 'WINNER', matchId };
}

function loser(matchId: string): BracketSlotMatch['sourceA'] {
  return { kind: 'LOSER', matchId };
}

/** Полуфинал сетки на четверых: два первых круга и финал из их победителей. */
function semifinalBracket(over: {
  first?: Partial<BracketSlotMatch>;
  second?: Partial<BracketSlotMatch>;
  final?: Partial<BracketSlotMatch>;
}): BracketSlotMatch[] {
  return [
    match('m1', { a: 'p1', b: 'p2', ...over.first }),
    match('m2', { a: 'p3', b: 'p4', ...over.second }),
    match('final', { sourceA: winner('m1'), sourceB: winner('m2'), ...over.final }),
  ];
}

function find(
  assignments: readonly SlotAssignment[],
  matchId: string,
  side: 'A' | 'B',
): SlotAssignment | undefined {
  return assignments.find((slot) => slot.matchId === matchId && slot.side === side);
}

describe('resolveBracketSlots', () => {
  it('несыгранная сетка не двигает никого', () => {
    expect(resolveBracketSlots(semifinalBracket({}))).toEqual([]);
  });

  it('победитель занимает свой слот в следующем круге', () => {
    const assignments = resolveBracketSlots(
      semifinalBracket({ first: { setsA: 3, setsB: 1 }, second: { setsA: 0, setsB: 3 } }),
    );

    expect(assignments).toEqual([
      { matchId: 'final', side: 'A', participant: 'p1' },
      { matchId: 'final', side: 'B', participant: 'p4' },
    ]);
  });

  it('проигравший едет по источнику LOSER — встреча за третье место', () => {
    const matches = [
      match('m1', { a: 'p1', b: 'p2', setsA: 3, setsB: 1 }),
      match('m2', { a: 'p3', b: 'p4', setsA: 3, setsB: 2 }),
      match('third', { sourceA: loser('m1'), sourceB: loser('m2') }),
    ];

    expect(resolveBracketSlots(matches)).toEqual([
      { matchId: 'third', side: 'A', participant: 'p2' },
      { matchId: 'third', side: 'B', participant: 'p4' },
    ]);
  });

  it('уже проставленный участник повторно не назначается', () => {
    const matches = semifinalBracket({
      first: { setsA: 3, setsB: 1 },
      second: { setsA: 3, setsB: 0 },
      final: { a: 'p1', b: 'p3' },
    });

    expect(resolveBracketSlots(matches)).toEqual([]);
  });

  it('правка результата уводит из следующего круга старого победителя', () => {
    // Результат первой встречи переписан в пользу p2, финал ещё не сыгран.
    const matches = semifinalBracket({
      first: { setsA: 1, setsB: 3 },
      second: { setsA: 3, setsB: 0 },
      final: { a: 'p1', b: 'p3' },
    });

    expect(resolveBracketSlots(matches)).toEqual([
      { matchId: 'final', side: 'A', participant: 'p2' },
    ]);
  });

  it('снятый результат обнуляет слот', () => {
    const matches = semifinalBracket({ second: { setsA: 3, setsB: 0 }, final: { a: 'p1' } });

    expect(resolveBracketSlots(matches)).toEqual([
      { matchId: 'final', side: 'A', participant: null },
      { matchId: 'final', side: 'B', participant: 'p3' },
    ]);
  });

  it('обнуление доходит до самого низа сетки', () => {
    // Полуфинал потерял участника, а финал был заполнен по его победителю.
    const matches = [
      match('q1', { a: 'p1', b: 'p2' }),
      match('s1', { sourceA: winner('q1'), b: 'p3', a: 'p1', setsA: 3, setsB: 0 }),
      match('f', { sourceA: winner('s1'), a: 'p1' }),
    ];

    const assignments = resolveBracketSlots(matches);

    expect(find(assignments, 's1', 'A')?.participant).toBeNull();
    // Полуфинал остался без участника, значит и победителя у него больше нет.
    expect(find(assignments, 'f', 'A')?.participant).toBeNull();
  });

  it('слот без источника не трогается даже при пустом участнике', () => {
    const matches = [match('m1', { a: null, b: 'p2' })];

    expect(resolveBracketSlots(matches)).toEqual([]);
  });

  it('порядок встреч на входе на результат не влияет', () => {
    const matches = semifinalBracket({
      first: { setsA: 3, setsB: 1 },
      second: { setsA: 3, setsB: 0 },
    });

    const straight = resolveBracketSlots(matches);
    const reversed = resolveBracketSlots([...matches].reverse());

    expect([...reversed].sort(bySlot)).toEqual([...straight].sort(bySlot));
  });

  it('равный счёт победителя не даёт', () => {
    const matches = semifinalBracket({ first: { setsA: 2, setsB: 2 } });

    expect(resolveBracketSlots(matches)).toEqual([]);
  });

  it('расчёт повторяем: второй прогон по обновлённым данным ничего не меняет', () => {
    const matches = semifinalBracket({
      first: { setsA: 3, setsB: 1 },
      second: { setsA: 3, setsB: 0 },
    });

    const applied = matches.map((entry) =>
      entry.id === 'final' ? match('final', { ...entry, a: 'p1', b: 'p3' }) : entry,
    );

    expect(resolveBracketSlots(applied)).toEqual([]);
  });

  it('сетка движка проходит целиком: победители доезжают до финала', () => {
    const bracket = buildKnockout(['p1', 'p2', 'p3', 'p4'], { thirdPlace: true });

    // Первый круг сыгран, всюду побеждает сторона A.
    const matches: BracketSlotMatch[] = bracket.matches.map((entry) => {
      const first = entry.round === 1;
      return match(entry.id, {
        a: entry.a.kind === 'PARTICIPANT' ? entry.a.participant : null,
        b: entry.b.kind === 'PARTICIPANT' ? entry.b.participant : null,
        sourceA: entry.a.kind === 'PARTICIPANT' ? null : entry.a,
        sourceB: entry.b.kind === 'PARTICIPANT' ? null : entry.b,
        setsA: first ? 3 : null,
        setsB: first ? 0 : null,
      });
    });

    const assignments = resolveBracketSlots(matches);

    // Первый номер посева встречается с четвёртым, второй с третьим.
    expect(find(assignments, 'R2M0', 'A')?.participant).toBe('p1');
    expect(find(assignments, 'R2M0', 'B')?.participant).toBe('p2');
    expect(find(assignments, 'THIRD', 'A')?.participant).toBe('p4');
    expect(find(assignments, 'THIRD', 'B')?.participant).toBe('p3');
  });

  it('повтор идентификатора — ошибка', () => {
    expect(() => resolveBracketSlots([match('m1'), match('m1')])).toThrow(/дважды/);
  });

  it('источник на несуществующую встречу — ошибка', () => {
    expect(() => resolveBracketSlots([match('m1', { sourceA: winner('нет') })])).toThrow(
      /неизвестную/,
    );
  });

  it('ссылка на саму себя — ошибка', () => {
    expect(() => resolveBracketSlots([match('m1', { sourceA: winner('m1') })])).toThrow(/цикл/);
  });

  it('цикл из двух встреч — ошибка', () => {
    const matches = [
      match('m1', { sourceA: winner('m2') }),
      match('m2', { sourceA: winner('m1') }),
    ];

    expect(() => resolveBracketSlots(matches)).toThrow(/цикл/);
  });
});

function bySlot(left: SlotAssignment, right: SlotAssignment): number {
  return left.matchId.localeCompare(right.matchId) || left.side.localeCompare(right.side);
}
