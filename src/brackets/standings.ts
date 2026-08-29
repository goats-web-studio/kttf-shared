import { at, mustGet } from './internal.js';
import type {
  ParticipantId,
  PlayedMatch,
  Standings,
  StandingsOptions,
  StandingRow,
  TieGroup,
} from './types.js';

/**
 * Очки за встречу.
 *
 * Порядок ITTF: победа — 2, поражение — 1, неявка и снятие — 0. Проигравший
 * получает очко именно за то, что вышел и доиграл, поэтому техническое
 * поражение и обычное различаются.
 */
export const WIN_POINTS = 2;
export const LOSS_POINTS = 1;
export const ABSENT_POINTS = 0;

interface Tally {
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  ballsWon: number;
  ballsLost: number;
}

/**
 * Расчёт групповой таблицы и мест.
 *
 * Равенство очков разводится правилами ТЗ 6.6 по порядку. Правила 1–3 считаются
 * **внутри группы равных**, правила 4–5 — по всей таблице. Если правило
 * разделило группу лишь частично, к оставшимся равным процедура применяется
 * заново с первого правила — так устроен регламент, и без рекурсии результат
 * получается неверным.
 *
 * Шестое правило — жребий — движок не бросает: решение принимает судья и
 * передаёт его через `tieDecisions`. Неразрешённые группы возвращаются
 * в `unresolved`, и пока список не пуст, места определены не полностью.
 * ADR-008.
 */
export function calculateStandings(
  participants: readonly ParticipantId[],
  matches: readonly PlayedMatch[],
  options: StandingsOptions = {},
): Standings {
  const known = new Set(participants);
  if (known.size !== participants.length) {
    throw new Error('calculateStandings: участники должны быть уникальны');
  }
  for (const match of matches) {
    if (!known.has(match.a) || !known.has(match.b)) {
      throw new Error(
        `calculateStandings: встреча ${match.a} — ${match.b} содержит участника вне списка`,
      );
    }
  }

  const tallies = buildTallies(participants, matches);
  const rows = participants.map((participant) => toRow(participant, tallies));

  const byId = new Map(rows.map((row) => [row.participant, row]));
  const ordered = orderParticipants(participants, rows, matches);
  const { places, unresolved, displayOrder } = assignPlaces(ordered, options.tieDecisions ?? []);

  // Порядок показа берётся из уже вычисленных корзин, а не пересортировкой:
  // сортировать заново значило бы во второй раз выражать те же правила,
  // и две реализации неизбежно разошлись бы.
  const finalRows = displayOrder.map((participant) => ({
    ...mustGet(byId, participant),
    place: places.get(participant) ?? null,
  }));

  return { rows: finalRows, unresolved };
}

function buildTallies(
  participants: readonly ParticipantId[],
  matches: readonly PlayedMatch[],
): Map<ParticipantId, Tally> {
  const tallies = new Map<ParticipantId, Tally>(
    participants.map((participant) => [
      participant,
      {
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        setsWon: 0,
        setsLost: 0,
        ballsWon: 0,
        ballsLost: 0,
      },
    ]),
  );

  for (const match of matches) {
    const a = mustGet(tallies, match.a);
    const b = mustGet(tallies, match.b);

    const aWon = match.setsA > match.setsB;
    const [ballsA, ballsB] = countBalls(match);

    a.played += 1;
    b.played += 1;
    a.setsWon += match.setsA;
    a.setsLost += match.setsB;
    b.setsWon += match.setsB;
    b.setsLost += match.setsA;
    a.ballsWon += ballsA;
    a.ballsLost += ballsB;
    b.ballsWon += ballsB;
    b.ballsLost += ballsA;

    const winner = aWon ? a : b;
    const loser = aWon ? b : a;
    winner.wins += 1;
    winner.points += WIN_POINTS;
    loser.losses += 1;
    loser.points += match.resultType === 'NORMAL' ? LOSS_POINTS : ABSENT_POINTS;
  }

  return tallies;
}

function countBalls(match: PlayedMatch): [number, number] {
  if (match.setScores === undefined) return [0, 0];
  let a = 0;
  let b = 0;
  for (const [ballsA, ballsB] of match.setScores) {
    a += ballsA;
    b += ballsB;
  }
  return [a, b];
}

function toRow(
  participant: ParticipantId,
  tallies: ReadonlyMap<ParticipantId, Tally>,
): StandingRow {
  const tally = mustGet(tallies, participant);
  return {
    participant,
    played: tally.played,
    wins: tally.wins,
    losses: tally.losses,
    points: tally.points,
    setsWon: tally.setsWon,
    setsLost: tally.setsLost,
    setDiff: tally.setsWon - tally.setsLost,
    ballsWon: tally.ballsWon,
    ballsLost: tally.ballsLost,
    ballDiff: tally.ballsWon - tally.ballsLost,
    place: null,
  };
}

/** Корзина участников, которых текущий набор правил разделить не смог. */
type Bucket = ParticipantId[];

function orderParticipants(
  participants: readonly ParticipantId[],
  rows: readonly StandingRow[],
  matches: readonly PlayedMatch[],
): Bucket[] {
  const byId = new Map(rows.map((row) => [row.participant, row]));
  const pointsOf = (id: ParticipantId): number => mustGet(byId, id).points;

  const byPoints = groupSortedDesc([...participants], pointsOf);
  return byPoints.flatMap((bucket) => separate(bucket, byId, matches));
}

/**
 * Разделение группы равных. Возвращает корзины в порядке убывания.
 * Корзина длиннее одного — участники, которых правила 1–5 не развели.
 */
function separate(
  members: Bucket,
  byId: ReadonlyMap<ParticipantId, StandingRow>,
  matches: readonly PlayedMatch[],
): Bucket[] {
  if (members.length <= 1) return [members];

  const among = new Set(members);
  const internal = matches.filter((match) => among.has(match.a) && among.has(match.b));
  const internalTallies = buildTallies(members, internal);

  const criteria: ((id: ParticipantId) => number)[] = [
    // 1. Личная встреча: очки в мини-таблице между равными
    (id) => mustGet(internalTallies, id).points,
    // 2. Разница сетов между равными
    (id) => diff(mustGet(internalTallies, id), 'setsWon', 'setsLost'),
    // 3. Разница мячей между равными
    (id) => diff(mustGet(internalTallies, id), 'ballsWon', 'ballsLost'),
    // 4. Общая разница сетов
    (id) => mustGet(byId, id).setDiff,
    // 5. Общая разница мячей
    (id) => mustGet(byId, id).ballDiff,
  ];

  for (const criterion of criteria) {
    const buckets = groupSortedDesc(members, criterion);
    if (buckets.length > 1) {
      // Разделилось частично — к оставшимся равным правила применяются
      // заново с первого. Внутри меньшей группы личная встреча считается
      // по-другому и часто разводит там, где не развела в большой.
      return buckets.flatMap((bucket) => separate(bucket, byId, matches));
    }
  }

  // 6. Жребий движку недоступен: возвращаем группу как есть, решит судья.
  return [[...members].sort()];
}

function diff(tally: Tally, won: keyof Tally, lost: keyof Tally): number {
  return tally[won] - tally[lost];
}

/** Группировка по значению критерия, корзины отсортированы по убыванию. */
function groupSortedDesc(members: Bucket, value: (id: ParticipantId) => number): Bucket[] {
  const buckets = new Map<number, Bucket>();
  for (const member of members) {
    const key = value(member);
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, [member]);
    else bucket.push(member);
  }
  return [...buckets.entries()].sort(([left], [right]) => right - left).map(([, bucket]) => bucket);
}

function assignPlaces(
  ordered: Bucket[],
  decisions: readonly (readonly ParticipantId[])[],
): {
  places: Map<ParticipantId, number>;
  unresolved: TieGroup[];
  displayOrder: ParticipantId[];
} {
  const places = new Map<ParticipantId, number>();
  const unresolved: TieGroup[] = [];
  const displayOrder: ParticipantId[] = [];
  let next = 1;

  for (const bucket of ordered) {
    if (bucket.length === 1) {
      const only = at(bucket, 0);
      places.set(only, next);
      displayOrder.push(only);
      next += 1;
      continue;
    }

    const decision = findDecision(bucket, decisions);
    if (decision !== undefined) {
      for (const participant of decision) {
        places.set(participant, next);
        displayOrder.push(participant);
        next += 1;
      }
      continue;
    }

    unresolved.push({
      participants: [...bucket],
      places: bucket.map((_, index) => next + index),
    });
    displayOrder.push(...bucket);
    next += bucket.length;
  }

  return { places, unresolved, displayOrder };
}

/** Решение судьи подходит, если состав участников совпадает точь-в-точь. */
function findDecision(
  bucket: Bucket,
  decisions: readonly (readonly ParticipantId[])[],
): readonly ParticipantId[] | undefined {
  const wanted = new Set(bucket);
  return decisions.find(
    (decision) =>
      decision.length === wanted.size && decision.every((participant) => wanted.has(participant)),
  );
}
