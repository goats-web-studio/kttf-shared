import { PROVISIONAL_THRESHOLD } from './constants.js';
import { applyDelta, calculateMatch } from './calculate-match.js';
import { round2 } from './round.js';
import type {
  PlayerRatingOutcome,
  RatedMatch,
  RatedPlayer,
  RatingEventDraft,
  TournamentRatingInput,
  TournamentRatingResult,
} from './types.js';

/**
 * Начисление рейтинга по итогам турнира — ТЗ 7.3.
 *
 * Дельта каждой встречи считается против рейтингов, зафиксированных на старте
 * турнира (ТС 5.4), а применяется к текущему состоянию проекции цепочкой.
 * Отсюда два свойства, ради которых всё и затевалось: сумма дельт не зависит
 * от порядка ввода счёта, а журнал остаётся непрерывным даже если игрок
 * успел сыграть другой турнир, обсчитанный раньше этого.
 *
 * Что сюда не попадает и почему:
 *
 * - Техническая победа и снятие (`resultType !== 'NORMAL'`) пропускаются
 *   целиком. По ТЗ 7.2 они рейтинг не двигают, а несыгранной встречи не
 *   существует — ни события в журнале, ни движения счётчика провизорности.
 * - Встречи «вне зачёта» сюда не доходят: их отсеивает вызывающий, потому
 *   что признак живёт в записи участника, а не во встрече.
 *
 * Нулевая дельта из-за разрыва в 100 очков (`G = 0`) — другое дело: встреча
 * сыграна, событие пишется, счётчик растёт. Иначе провизорный период сильного
 * новичка, обыгрывающего слабых, не кончался бы никогда.
 */
export function calculateTournamentRating(input: TournamentRatingInput): TournamentRatingResult {
  const running = new Map<string, { rating: number; played: number }>();
  const events: RatingEventDraft[] = [];
  let imbalance = 0;

  function stateOf(playerId: string, player: RatedPlayer): { rating: number; played: number } {
    const known = running.get(playerId);
    if (known !== undefined) return known;

    const fresh = { rating: player.current.rating, played: player.current.ratedMatches };
    running.set(playerId, fresh);

    return fresh;
  }

  for (const match of input.matches) {
    if (match.resultType !== 'NORMAL') continue;

    const winner = participantOf(input, match, match.winnerId);
    const loser = participantOf(input, match, match.loserId);

    const outcome = calculateMatch({
      winner: winner.atStart,
      loser: loser.atStart,
      winnerSets: match.winnerSets,
      loserSets: match.loserSets,
      level: input.level,
      resultType: match.resultType,
    });

    const { factors } = outcome;

    events.push(
      apply(stateOf(match.winnerId, winner), {
        playerId: match.winnerId,
        matchId: match.matchId,
        opponentId: match.loserId,
        delta: outcome.winnerDelta,
        opponentRating: loser.atStart.rating,
        kFactor: factors.kWinner,
        tFactor: factors.levelFactor,
        mFactor: factors.scoreMultiplier,
        expected: factors.expectedWinner,
        gapMultiplier: factors.gapMultiplier,
        imbalance: outcome.imbalance,
      }),
    );

    events.push(
      apply(stateOf(match.loserId, loser), {
        playerId: match.loserId,
        matchId: match.matchId,
        opponentId: match.winnerId,
        delta: outcome.loserDelta,
        opponentRating: winner.atStart.rating,
        kFactor: factors.kLoser,
        tFactor: factors.levelFactor,
        mFactor: factors.scoreMultiplier,
        expected: 1 - factors.expectedWinner,
        gapMultiplier: factors.gapMultiplier,
        imbalance: null,
      }),
    );

    imbalance = round2(imbalance + outcome.imbalance);
  }

  const players: PlayerRatingOutcome[] = [...running].map(([playerId, state]) => ({
    playerId,
    rating: state.rating,
    ratedMatches: state.played,
    isProvisional: state.played < PROVISIONAL_THRESHOLD,
  }));

  return { events, players, imbalance };
}

/** Всё, что известно о событии до применения дельты к текущему рейтингу. */
type PendingEvent = Omit<RatingEventDraft, 'ratingBefore' | 'ratingAfter' | 'clamped'>;

/**
 * Применение дельты к текущему состоянию игрока.
 *
 * Состояние меняется на месте: цепочка ratingBefore → ratingAfter обязана быть
 * непрерывной внутри турнира, иначе журнал не пересчитывается.
 */
function apply(state: { rating: number; played: number }, event: PendingEvent): RatingEventDraft {
  const applied = applyDelta(state.rating, event.delta);
  const draft: RatingEventDraft = {
    ...event,
    ratingBefore: state.rating,
    delta: applied.appliedDelta,
    ratingAfter: applied.rating,
    clamped: applied.clamped,
  };

  state.rating = applied.rating;
  state.played += 1;

  return draft;
}

/**
 * Участник встречи со снимком на старте.
 *
 * Отсутствие снимка означает испорченные данные: встреча сыграна, а игрока
 * в составе турнира нет. Считать по текущему рейтингу вместо снимка нельзя —
 * это тихо нарушило бы ТС 5.4, поэтому расчёт останавливается.
 */
function participantOf(
  input: TournamentRatingInput,
  match: RatedMatch,
  playerId: string,
): RatedPlayer {
  const player = input.players.get(playerId);

  if (player === undefined) {
    throw new Error(
      `calculateTournamentRating: у игрока ${playerId} из встречи ${match.matchId} нет снимка на старте`,
    );
  }

  return player;
}
