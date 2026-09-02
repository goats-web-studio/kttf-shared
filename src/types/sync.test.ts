import { describe, expect, it } from 'vitest';

import { syncOperationSchema, syncRequestSchema, syncOperationTypeSchema } from './sync.js';

/**
 * Очередь офлайн-операций — ТС 6.2.
 *
 * Схема операции — единственное описание того, что судья успел сделать без
 * сети. Разберётся она неверно — счёт, введённый в зале, до сервера не
 * доедет, и узнают об этом в конце турнира.
 */

const MATCH_ID = '00000000-0000-4000-8000-000000000001';
const GROUP_ID = '00000000-0000-4000-8000-000000000002';
const OP_ID = '00000000-0000-4000-8000-000000000003';
const PLAYER_A = '11111111-1111-4111-8111-111111111111';
const PLAYER_B = '22222222-2222-4222-8222-222222222222';

const head = { clientOpId: OP_ID, seq: 1, createdAt: '2026-09-02T10:00:00.000Z' };

describe('операции очереди', () => {
  it('счёт описывается тем же телом, что и онлайн-запрос', () => {
    const parsed = syncOperationSchema.parse({
      ...head,
      type: 'MATCH_RESULT',
      matchId: MATCH_ID,
      payload: { setsA: 3, setsB: 1 },
    });

    // Умолчание `resultType` из общего контракта работает и здесь: иначе
    // офлайн-счёт разбирался бы иначе, чем тот же счёт по сети.
    expect(parsed.type === 'MATCH_RESULT' && parsed.payload.resultType).toBe('NORMAL');
  });

  it('отмена встречи тела не имеет', () => {
    expect(
      syncOperationSchema.safeParse({ ...head, type: 'MATCH_CANCEL', matchId: MATCH_ID }).success,
    ).toBe(true);
  });

  it('решение по равенству кладётся в очередь наравне с остальным', () => {
    // Без него групповой этап в зале без сети не закрыть: места не определены,
    // плей-офф не достроится (ADR-008). ТС 6.2 дополнена этим типом.
    expect(
      syncOperationSchema.safeParse({
        ...head,
        type: 'TIE_DECISION',
        payload: { groupId: GROUP_ID, orderedIds: [PLAYER_A, PLAYER_B] },
      }).success,
    ).toBe(true);
  });

  it('операция без порядкового номера не принимается', () => {
    // Порядок применения задаёт seq и только он: по времени клиента операции
    // упорядочить нельзя, часы в зале произвольны.
    expect(
      syncOperationSchema.safeParse({
        ...head,
        seq: undefined,
        type: 'MATCH_CANCEL',
        matchId: MATCH_ID,
      }).success,
    ).toBe(false);
  });

  it('чужой тип операции не проходит', () => {
    expect(
      syncOperationSchema.safeParse({ ...head, type: 'MATCH_DELETE', matchId: MATCH_ID }).success,
    ).toBe(false);
  });

  it('перечень типов совпадает с перечнем в операциях', () => {
    const inOperations = new Set(
      syncOperationSchema.options.map((option) => option.shape.type.value),
    );

    expect([...inOperations].sort()).toEqual([...syncOperationTypeSchema.options].sort());
  });
});

describe('пачка на отправку', () => {
  it('принимается вместе с версией снимка', () => {
    expect(
      syncRequestSchema.safeParse({
        lastServerVersion: 142,
        operations: [{ ...head, type: 'MATCH_CANCEL', matchId: MATCH_ID }],
      }).success,
    ).toBe(true);
  });

  it('пустая пачка допустима', () => {
    // Синхронизация запускается по таймеру (ТС 6.3): когда судья ничего не
    // вводил, она всё равно должна принести свежий снимок.
    expect(syncRequestSchema.safeParse({ lastServerVersion: 0, operations: [] }).success).toBe(
      true,
    );
  });
});
