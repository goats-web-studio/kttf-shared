import { z } from 'zod';

import { ERROR_CODES } from '../errors/codes.js';

import { assignTableSchema, matchResultSchema, tieDecisionSchema } from './match.js';
import { stageViewSchema } from './stage.js';
import { tournamentStandingsSchema } from './standings.js';
import {
  registrationViewSchema,
  tournamentViewSchema,
  updateRegistrationSchema,
} from './tournament.js';

/**
 * Офлайн-режим консоли — ТЗ 6.4, ТС 6.
 *
 * Судья ведёт турнир в зале без сети: снимок лежит у него на диске, действия
 * копятся очередью и уезжают на сервер, когда связь появится. Отсюда две
 * формы — снимок турнира и пачка операций.
 *
 * Операция описывается **тем же телом, что и онлайн-запрос**: `MATCH_RESULT`
 * несёт `MatchResultInput`, `TIE_DECISION` — `TieDecisionInput`. Это не
 * экономия строк: синхронизация применяет операции теми же методами, что и
 * маршруты, и второго описания правил ввода счёта в системе не появляется
 * (запрет №2 брифа).
 */

/**
 * Снимок турнира для консоли — ТС 6.1.
 *
 * Отличается от публичных результатов составом: здесь есть участники со
 * статусами и посевом, которые нужны судье, и нет журнала рейтинга, который
 * ему не нужен и в локальное хранилище не кладётся.
 *
 * `version` — то, против чего считались операции. Растёт на каждое изменение
 * турнира на сервере.
 */
export const tournamentSnapshotSchema = z.object({
  version: z.number().int().nonnegative(),
  tournament: tournamentViewSchema,
  registrations: z.array(registrationViewSchema),
  standings: tournamentStandingsSchema,
  stages: z.array(stageViewSchema),
  takenAt: z.iso.datetime(),
});
export type TournamentSnapshotView = z.infer<typeof tournamentSnapshotSchema>;

export const syncOperationTypeSchema = z.enum([
  'MATCH_ASSIGN',
  'MATCH_RESULT',
  'MATCH_EDIT',
  'MATCH_CANCEL',
  'TIE_DECISION',
  'PLAYER_WITHDRAW',
]);
export type SyncOperationType = z.infer<typeof syncOperationTypeSchema>;

const operation = {
  /** UUID, выданный клиентом. По нему операция узнаётся при повторной отправке. */
  clientOpId: z.uuid(),
  /** Порядок применения. Автоинкремент очереди на клиенте, ТС 6.2. */
  seq: z.number().int().positive(),
  /** Когда судья это сделал. Часы зала, а не сервера: для разбора спора. */
  createdAt: z.iso.datetime(),
};

/**
 * Одна операция очереди — ТС 6.2.
 *
 * `MATCH_EDIT` отделён от `MATCH_RESULT` не ради красоты: правка уже
 * введённого результата фиксируется в журнале (ТЗ 6.3), а первичный ввод —
 * нет. Слить их значило бы потерять след правки либо завести его на каждый
 * счёт в турнире.
 */
export const syncOperationSchema = z.discriminatedUnion('type', [
  z.object({
    ...operation,
    type: z.literal('MATCH_ASSIGN'),
    matchId: z.uuid(),
    payload: assignTableSchema,
  }),
  z.object({
    ...operation,
    type: z.literal('MATCH_RESULT'),
    matchId: z.uuid(),
    payload: matchResultSchema,
  }),
  z.object({
    ...operation,
    type: z.literal('MATCH_EDIT'),
    matchId: z.uuid(),
    payload: matchResultSchema,
  }),
  // Отмена возвращает встречу в очередь и своего тела не имеет — ТЗ 6.3.
  z.object({ ...operation, type: z.literal('MATCH_CANCEL'), matchId: z.uuid() }),
  z.object({ ...operation, type: z.literal('TIE_DECISION'), payload: tieDecisionSchema }),
  z.object({
    ...operation,
    type: z.literal('PLAYER_WITHDRAW'),
    registrationId: z.uuid(),
    payload: updateRegistrationSchema,
  }),
]);
export type SyncOperation = z.infer<typeof syncOperationSchema>;

/**
 * Пачка операций на отправку — ТС 6.3.
 *
 * `lastServerVersion` — версия снимка, против которого судья работал. Сервер
 * ею ничего не блокирует: конфликт разрешается по правилу «последняя запись
 * побеждает» (ADR-026). Она попадает в журнал синхронизации и отвечает на
 * вопрос «против какого состояния судья это вводил», без которого спор о
 * перезаписанном счёте не разобрать.
 */
export const syncRequestSchema = z.object({
  lastServerVersion: z.number().int().nonnegative(),
  // Ограничение сверху не для сервера, а для зала: пачка на тысячу операций
  // означала бы, что очередь копилась месяцами, и разбираться с ней нужно
  // человеку, а не автоматической отправке.
  operations: z.array(syncOperationSchema).max(500),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

/** Отклонённая операция: код — из общего перечня, локализуется на клиенте. */
export const rejectedOperationSchema = z.object({
  clientOpId: z.uuid(),
  reason: z.enum(ERROR_CODES),
});
export type RejectedOperation = z.infer<typeof rejectedOperationSchema>;

/**
 * Итог синхронизации — ТС 6.3.
 *
 * Снимок приходит всегда, а не только при отклонении: судья, отправивший
 * пачку, обязан увидеть состояние, которое из неё получилось, целиком.
 * Собирать его из откликов на отдельные операции — способ разойтись
 * с сервером незаметно.
 */
export const syncResultSchema = z.object({
  serverVersion: z.number().int().nonnegative(),
  /** `clientOpId` применённых операций, включая применённые ранее. */
  applied: z.array(z.uuid()),
  rejected: z.array(rejectedOperationSchema),
  snapshot: tournamentSnapshotSchema,
});
export type SyncResult = z.infer<typeof syncResultSchema>;
