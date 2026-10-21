import { describe, expect, it } from 'vitest';

import { notificationViewSchema, readNotificationsSchema } from './notification.js';
import {
  answerTrialRequestSchema,
  createTrialRequestSchema,
  incomingTrialRequestViewSchema,
  listTrialRequestsSchema,
} from './trial-request.js';

const ID = '00000000-0000-4000-8000-000000000001';

describe('заявка на пробную (ADR-059, T3)', () => {
  it('за себя — без возраста, за ребёнка — с возрастом', () => {
    expect(createTrialRequestSchema.parse({ forWhom: 'SELF', source: 'ORGANIC' })).toEqual({
      forWhom: 'SELF',
      source: 'ORGANIC',
    });
    expect(
      createTrialRequestSchema.parse({
        forWhom: 'CHILD',
        childAge: 9,
        preferredTime: '  будни после 18:00 ',
        source: 'CAMPAIGN',
      }),
    ).toMatchObject({ childAge: 9, preferredTime: 'будни после 18:00' });

    expect(
      createTrialRequestSchema.safeParse({ forWhom: 'CHILD', source: 'ORGANIC' }).success,
    ).toBe(false);
    expect(
      createTrialRequestSchema.safeParse({ forWhom: 'SELF', childAge: 9, source: 'ORGANIC' })
        .success,
    ).toBe(false);
    expect(
      createTrialRequestSchema.safeParse({ forWhom: 'CHILD', childAge: 2, source: 'ORGANIC' })
        .success,
    ).toBe(false);
  });

  it('ответ — принять или отклонить, текст необязателен', () => {
    expect(answerTrialRequestSchema.parse({ status: 'ACCEPTED' })).toEqual({ status: 'ACCEPTED' });
    expect(answerTrialRequestSchema.safeParse({ status: 'CANCELLED' }).success).toBe(false);
    expect(listTrialRequestsSchema.parse({ status: 'NEW' })).toMatchObject({
      page: 1,
      status: 'NEW',
    });
  });

  it('адресат видит отправителя с телефоном', () => {
    const view = {
      id: ID,
      status: 'NEW',
      training: { id: ID, title: 'Детская группа 6–10 лет' },
      target: {
        kind: 'COACH',
        id: ID,
        name: 'Петров Алексей',
        slug: 'petrov-aleksey',
        phone: null,
        whatsapp: '+77011112233',
      },
      forWhom: 'CHILD',
      childAge: 9,
      preferredTime: null,
      comment: null,
      reply: null,
      createdAt: '2026-10-22T10:00:00.000Z',
      answeredAt: null,
      requester: { name: 'Игроков Иван', phone: '+77010000000', playerId: ID },
      source: 'ORGANIC',
    };

    expect(incomingTrialRequestViewSchema.parse(view)).toEqual(view);
  });
});

describe('уведомления', () => {
  it('тип определяет данные', () => {
    const answered = {
      id: ID,
      type: 'TRIAL_REQUEST_ANSWERED',
      data: {
        trialRequestId: ID,
        trainingTitle: 'Детская группа',
        status: 'ACCEPTED',
        targetName: 'Клуб «Спин»',
      },
      readAt: null,
      createdAt: '2026-10-22T10:00:00.000Z',
    };
    const inbox = { kind: 'CLUB', id: ID, name: 'Клуб «Спин»' };

    expect(notificationViewSchema.parse(answered)).toEqual(answered);
    for (const type of ['TRIAL_REQUEST_NEW', 'TRIAL_REQUEST_CANCELLED']) {
      expect(
        notificationViewSchema.safeParse({
          ...answered,
          type,
          data: { trialRequestId: ID, trainingTitle: 'Группа', requesterName: 'Иван', inbox },
        }).success,
      ).toBe(true);
    }
    expect(notificationViewSchema.safeParse({ ...answered, type: 'UNKNOWN' }).success).toBe(false);
  });

  it('прочитать выбранные или все', () => {
    expect(readNotificationsSchema.parse({})).toEqual({});
    expect(readNotificationsSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
