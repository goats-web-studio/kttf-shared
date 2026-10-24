import { BONUS_MIN_PARTICIPANTS, BONUS_TOP_PLAYERS, NOVICE_TOURNAMENTS } from './constants.js';
import { applyDelta, calculateMatch } from './calculate-match.js';
import { averageOf, bonusPercent, type PrizePlace, tournamentFactor } from './factors.js';
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
 * Начисление рейтинга по итогам турнира — ТЗ 7.3, формула RTTF (ADR-069).
 *
 * Дельта каждой встречи считается против рейтингов, зафиксированных на старте
 * турнира (ТС 5.4), а применяется к текущему состоянию проекции цепочкой.
 * Отсюда два свойства, ради которых всё и затевалось: сумма дельт не зависит
 * от порядка ввода счёта, а журнал остаётся непрерывным даже если игрок
 * успел сыграть другой турнир, обсчитанный раньше этого.
 *
 * Порядок: сначала все встречи, затем бонусы призёрам. Бонус считается
 * от рейтинга на старте, поэтому от порядка он тоже не зависит.
 *
 * Что сюда не попадает и почему:
 *
 * - Техническая победа и снятие (`resultType !== 'NORMAL'`) пропускаются
 *   целиком. По ТЗ 7.2 они рейтинг не двигают, а несыгранной встречи не
 *   существует — ни события в журнале, ни движения счётчиков.
 * - Встречи «вне зачёта» сюда не доходят: их отсеивает вызывающий, потому
 *   что признак живёт в записи участника, а не во встрече.
 *
 * Нулевая дельта из-за разрыва в 100 очков — другое дело: встреча сыграна,
 * событие пишется, счётчики растут. Иначе период новичка у сильного игрока,
 * обыгрывающего слабых, не кончался бы никогда.
 */
export function calculateTournamentRating(input: TournamentRatingInput): TournamentRatingResult {
  const running = new Map<string, RunningState>();
  const events: RatingEventDraft[] = [];
  let imbalance = 0;

  const averageRating = round2(averageOf([...input.players.values()].map(ratingAtStart)));
  const factor = tournamentFactor(averageRating);

  function stateOf(playerId: string, player: RatedPlayer): RunningState {
    const known = running.get(playerId);
    if (known !== undefined) return known;

    const fresh = {
      rating: player.current.rating,
      played: player.current.ratedMatches,
      tournaments: player.current.ratedTournaments,
      playedHere: false,
    };
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
      tournamentFactor: factor,
      resultType: match.resultType,
    });

    const { factors } = outcome;

    events.push(
      applyMatch(stateOf(match.winnerId, winner), {
        playerId: match.winnerId,
        type: 'MATCH',
        matchId: match.matchId,
        opponentId: match.loserId,
        delta: outcome.winnerDelta,
        opponentRating: loser.atStart.rating,
        kFactor: factors.kWinner,
        tFactor: factor,
        mFactor: factors.dWinner,
        place: null,
        bonusPercent: null,
        imbalance: outcome.imbalance,
      }),
    );

    events.push(
      applyMatch(stateOf(match.loserId, loser), {
        playerId: match.loserId,
        type: 'MATCH',
        matchId: match.matchId,
        opponentId: match.winnerId,
        delta: outcome.loserDelta,
        opponentRating: winner.atStart.rating,
        kFactor: factors.kLoser,
        tFactor: factor,
        mFactor: factors.dLoser,
        place: null,
        bonusPercent: null,
        imbalance: null,
      }),
    );

    imbalance = round2(imbalance + outcome.imbalance);
  }

  for (const bonus of prizeBonuses(input)) {
    const amount = round2((bonus.player.atStart.rating * bonus.percent) / 100);
    if (amount === 0) continue;

    const event = apply(stateOf(bonus.playerId, bonus.player), {
      playerId: bonus.playerId,
      type: 'BONUS',
      matchId: null,
      opponentId: null,
      delta: amount,
      opponentRating: null,
      kFactor: null,
      tFactor: factor,
      mFactor: null,
      place: bonus.place,
      bonusPercent: bonus.percent,
      imbalance: amount,
    });

    events.push(event);
    imbalance = round2(imbalance + event.delta);
  }

  const players: PlayerRatingOutcome[] = [...running].map(([playerId, state]) => {
    const tournaments = state.tournaments + (state.playedHere ? 1 : 0);

    return {
      playerId,
      rating: state.rating,
      ratedMatches: state.played,
      ratedTournaments: tournaments,
      isProvisional: tournaments < NOVICE_TOURNAMENTS,
    };
  });

  return { events, players, averageRating, tournamentFactor: factor, imbalance };
}

interface RunningState {
  rating: number;
  played: number;
  tournaments: number;
  /** Сыграна хотя бы одна рейтинговая встреча этого турнира. */
  playedHere: boolean;
}

interface PrizeBonus {
  readonly playerId: string;
  readonly player: RatedPlayer;
  readonly place: PrizePlace;
  /** Уже делённый между всеми, кто делит место. */
  readonly percent: number;
}

/**
 * Бонусы призёрам — первоисточник, п. 5.
 *
 * Условия: участников не меньше BONUS_MIN_PARTICIPANTS, призёр превосходит
 * средний рейтинг BONUS_TOP_PLAYERS сильнейших не больше чем на 200.
 * Делённое место делит и бонус: два третьих места — по половине бонуса
 * за третье каждому.
 */
export function prizeBonuses(input: TournamentRatingInput): PrizeBonus[] {
  if (input.players.size < BONUS_MIN_PARTICIPANTS) return [];

  const strongest = [...input.players.values()]
    .map(ratingAtStart)
    .sort((left, right) => right - left)
    .slice(0, BONUS_TOP_PLAYERS);
  const strength = averageOf(strongest);

  const bonuses: PrizeBonus[] = [];

  for (const place of [1, 2, 3] as const) {
    // Призёр вне зачёта рейтинга в составе отсутствует: бонуса ему нет,
    // но место он занял, и делящие его место всё равно делят бонус.
    const holders = input.placements.filter((placement) => placement.place === place);

    for (const holder of holders) {
      const player = input.players.get(holder.playerId);
      if (player === undefined) continue;

      const percent = bonusPercent(place, player.atStart.rating - strength) / holders.length;

      if (percent > 0) bonuses.push({ playerId: holder.playerId, player, place, percent });
    }
  }

  return bonuses;
}

/** Всё, что известно о событии до применения дельты к текущему рейтингу. */
type PendingEvent = Omit<RatingEventDraft, 'ratingBefore' | 'ratingAfter' | 'clamped'>;

/** Встреча: дельта плюс счётчики сыгранного. */
function applyMatch(state: RunningState, event: PendingEvent): RatingEventDraft {
  const draft = apply(state, event);

  state.played += 1;
  state.playedHere = true;

  return draft;
}

/**
 * Применение дельты к текущему состоянию игрока.
 *
 * Состояние меняется на месте: цепочка ratingBefore → ratingAfter обязана быть
 * непрерывной внутри турнира, иначе журнал не пересчитывается.
 */
function apply(state: RunningState, event: PendingEvent): RatingEventDraft {
  const applied = applyDelta(state.rating, event.delta);
  const draft: RatingEventDraft = {
    ...event,
    ratingBefore: state.rating,
    delta: applied.appliedDelta,
    ratingAfter: applied.rating,
    clamped: applied.clamped,
  };

  state.rating = applied.rating;

  return draft;
}

function ratingAtStart(player: RatedPlayer): number {
  return player.atStart.rating;
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
