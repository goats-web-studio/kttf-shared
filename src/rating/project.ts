import { round2 } from './round.js';
import { calculateTournamentRating } from './tournament.js';
import type { RatedMatch, RatedPlacement, RatedPlayer, ResultType } from './types.js';

/** Участник для прогноза — то, что знает снимок консоли. */
export interface ProjectedParticipant {
  readonly playerId: string;
  /** Вне зачёта — в расчёт не идёт, как при начислении. */
  readonly isRated: boolean;
  /** Рейтинг на старте турнира; `null` — турнир ещё не начат. */
  readonly ratingAtStart: number | null;
  readonly matchesAtStart: number;
  readonly tournamentsAtStart: number;
}

/** Встреча для прогноза: стороны, счёт и как она закончилась. */
export interface ProjectedMatch {
  readonly id: string;
  readonly a: string | null;
  readonly b: string | null;
  readonly setsA: number | null;
  readonly setsB: number | null;
  readonly resultType: ResultType;
}

/**
 * Прогноз изменения рейтинга по турниру — ADR-077: тот же движок, что
 * начисляет рейтинг при завершении (ADR-069), на том, что уже сыграно.
 *
 * Организатор видит дельту каждого участника по ходу турнира, а не только
 * после «Завершить». С местами призёров прогноз включает и бонус — в окне
 * завершения он совпадает с тем, что будет начислено. Отличие возможно
 * только у игрока, который между стартом и завершением сыграл другой
 * обсчитанный турнир: цепочка применяется к его текущему рейтингу, которого
 * консоль не знает.
 *
 * @returns Дельта по участнику, округлённая до сотых. Не сыгравшего
 * рейтинговых встреч и без бонуса в ответе нет.
 */
export function projectDeltas(
  participants: readonly ProjectedParticipant[],
  matches: readonly ProjectedMatch[],
  placements: readonly RatedPlacement[] = [],
): Map<string, number> {
  const players = new Map<string, RatedPlayer>();

  for (const participant of participants) {
    if (!participant.isRated || participant.ratingAtStart === null) continue;

    const snapshot = {
      rating: participant.ratingAtStart,
      ratedMatches: participant.matchesAtStart,
      ratedTournaments: participant.tournamentsAtStart,
    };
    players.set(participant.playerId, { atStart: snapshot, current: snapshot });
  }

  const rated: RatedMatch[] = matches.flatMap((match) => {
    const { a, b, setsA, setsB } = match;
    if (a === null || b === null || setsA === null || setsB === null || setsA === setsB) return [];
    if (!players.has(a) || !players.has(b)) return [];

    const aWon = setsA > setsB;

    return [
      {
        matchId: match.id,
        winnerId: aWon ? a : b,
        loserId: aWon ? b : a,
        winnerSets: aWon ? setsA : setsB,
        loserSets: aWon ? setsB : setsA,
        resultType: match.resultType,
      },
    ];
  });

  if (players.size === 0) return new Map();

  const result = calculateTournamentRating({ players, matches: rated, placements });
  const deltas = new Map<string, number>();

  for (const event of result.events) {
    deltas.set(event.playerId, (deltas.get(event.playerId) ?? 0) + event.delta);
  }

  return new Map([...deltas].map(([playerId, delta]) => [playerId, round2(delta)]));
}
