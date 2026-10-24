import { NOVICE_TOURNAMENTS } from './constants.js';
import { applyDelta, calculateMatch } from './calculate-match.js';
import { averageOf, tournamentFactor } from './factors.js';
import { round2 } from './round.js';
import type { PlayerRatingOutcome, PlayerSnapshot, RatingEventDraft } from './types.js';

/**
 * Рейтинг дуэли вне турнира — ADR-065, по формуле 3.0 (ADR-069).
 *
 * Дуэль — одна встреча, посчитанная как турнирная: k — коэффициент по
 * среднему рейтингу двоих, у новичка — свой k. Итоговая дельта умножается
 * на `DUEL_WEIGHT`: счёт подтверждают сами игроки, а не судья, и дуэль
 * весит вдвое меньше такой же встречи в турнире. Вес — на дельту, а не на
 * k: у новичка k от коэффициента турнира не зависит, и иначе он набирал бы
 * на дуэлях полный рейтинг.
 *
 * Снимок рейтингов — момент подтверждения счёта, он же текущее состояние:
 * цепочка журнала непрерывна сама собой. Дуэль — встреча, а не турнир:
 * `ratedMatches` растёт, `ratedTournaments` — нет, новичком игрок остаётся
 * до пятого турнира.
 *
 * Частоту ограничивают правила ниже: двое друзей иначе «накачивали» бы
 * рейтинг друг другу каждый вечер. Правила — здесь, а не в сервере: логика
 * рейтинга живёт только в общем коде (бриф, запрет №2).
 */

/** Доля дельты турнирной встречи, которую даёт дуэль. */
export const DUEL_WEIGHT = 0.5;
/** Одна и та же пара — не чаще одной рейтинговой встречи за столько дней. */
export const DUEL_PAIR_WINDOW_DAYS = 7;
/** Рейтинговых дуэлей у игрока — не больше стольких в любые 7 дней подряд. */
export const DUEL_PLAYER_WEEK_MAX = 3;
/** Столько часов у соперника, чтобы подтвердить или оспорить счёт. */
export const DUEL_CONFIRM_HOURS = 48;

const DAY_MS = 86_400_000;
const WINDOW_MS = DUEL_PAIR_WINDOW_DAYS * DAY_MS;

export interface DuelRatingInput {
  readonly duelId: string;
  readonly winnerId: string;
  readonly loserId: string;
  /** Состояние на момент подтверждения — и снимок, и текущее. */
  readonly winner: PlayerSnapshot;
  readonly loser: PlayerSnapshot;
  readonly winnerSets: number;
  readonly loserSets: number;
}

export interface DuelRatingResult {
  /** Два события `MATCH`: победителю и проигравшему. `matchId` — дуэль. */
  readonly events: readonly RatingEventDraft[];
  readonly players: readonly PlayerRatingOutcome[];
  /** Коэффициент турнира по двоим, уже с весом дуэли. */
  readonly tournamentFactor: number;
  readonly imbalance: number;
}

interface Side {
  readonly id: string;
  readonly snapshot: PlayerSnapshot;
  readonly delta: number;
  readonly k: number;
  readonly d: number;
}

/**
 * События журнала по дуэли. `matchId` черновиков — идентификатор дуэли:
 * сервер пишет его в `RatingEvent.duelId`. `kFactor` и `tFactor` — с весом
 * дуэли: база × k × D даёт записанную дельту, как у турнирной встречи.
 */
export function calculateDuelRating(input: DuelRatingInput): DuelRatingResult {
  const factor = tournamentFactor(round2(averageOf([input.winner.rating, input.loser.rating])));
  const outcome = calculateMatch({
    winner: input.winner,
    loser: input.loser,
    winnerSets: input.winnerSets,
    loserSets: input.loserSets,
    tournamentFactor: factor,
    resultType: 'NORMAL',
  });
  const { factors } = outcome;

  const winner: Side = {
    id: input.winnerId,
    snapshot: input.winner,
    delta: round2(outcome.winnerDelta * DUEL_WEIGHT),
    k: factors.kWinner,
    d: factors.dWinner,
  };
  const loser: Side = {
    id: input.loserId,
    snapshot: input.loser,
    delta: round2(outcome.loserDelta * DUEL_WEIGHT),
    k: factors.kLoser,
    d: factors.dLoser,
  };
  const imbalance = round2(winner.delta + loser.delta);

  function apply(
    side: Side,
    opponent: Side,
    sideImbalance: number | null,
  ): { readonly event: RatingEventDraft; readonly outcome: PlayerRatingOutcome } {
    const applied = applyDelta(side.snapshot.rating, side.delta);

    return {
      event: {
        playerId: side.id,
        type: 'MATCH',
        matchId: input.duelId,
        opponentId: opponent.id,
        ratingBefore: side.snapshot.rating,
        delta: applied.appliedDelta,
        ratingAfter: applied.rating,
        clamped: applied.clamped,
        opponentRating: opponent.snapshot.rating,
        kFactor: side.k * DUEL_WEIGHT,
        tFactor: factor * DUEL_WEIGHT,
        mFactor: side.d,
        place: null,
        bonusPercent: null,
        // Расхождение — только победителю, как у турнирной встречи (ТС 5.6).
        imbalance: sideImbalance,
      },
      outcome: {
        playerId: side.id,
        rating: applied.rating,
        ratedMatches: side.snapshot.ratedMatches + 1,
        ratedTournaments: side.snapshot.ratedTournaments,
        isProvisional: side.snapshot.ratedTournaments < NOVICE_TOURNAMENTS,
      },
    };
  }

  const won = apply(winner, loser, imbalance);
  const lost = apply(loser, winner, null);

  return {
    events: [won.event, lost.event],
    players: [won.outcome, lost.outcome],
    tournamentFactor: factor * DUEL_WEIGHT,
    imbalance,
  };
}

/** Рейтинговая дуэль, уже назначенная или сыгранная, — для проверки частоты. */
export interface RatedDuelRecord {
  readonly playerAId: string;
  readonly playerBId: string;
  /** Начало согласованного времени. */
  readonly at: Date;
}

/**
 * Почему новая рейтинговая дуэль невозможна:
 *
 * - `PAIR` — у этой пары уже есть рейтинговая дуэль ближе 7 дней (в любую
 *   сторону: назначить пять дуэлей наперёд тоже нельзя);
 * - `PLAYER` — у одного из игроков в каком-то окне из 7 дней, задевающем
 *   новую дуэль, уже три рейтинговые.
 *
 * `records` — рейтинговые дуэли обоих игроков, кроме проверяемой. `null` —
 * можно.
 */
export function duelRatingBlock(
  records: readonly RatedDuelRecord[],
  playerAId: string,
  playerBId: string,
  at: Date,
): { readonly kind: 'PAIR' | 'PLAYER'; readonly playerId: string | null } | null {
  const time = at.getTime();
  const near = (record: RatedDuelRecord): boolean =>
    Math.abs(record.at.getTime() - time) < WINDOW_MS;

  const pair = records.some(
    (record) =>
      near(record) &&
      ((record.playerAId === playerAId && record.playerBId === playerBId) ||
        (record.playerAId === playerBId && record.playerBId === playerAId)),
  );
  if (pair) return { kind: 'PAIR', playerId: null };

  for (const playerId of [playerAId, playerBId]) {
    const times = records
      .filter((record) => record.playerAId === playerId || record.playerBId === playerId)
      .map((record) => record.at.getTime())
      .filter((other) => Math.abs(other - time) < WINDOW_MS);

    if (crowded([...times, time])) return { kind: 'PLAYER', playerId };
  }

  return null;
}

/** Есть ли окно из 7 дней, где встреч больше предела. */
function crowded(times: readonly number[]): boolean {
  const sorted = [...times].sort((left, right) => left - right);

  // Окно с началом в каждой встрече: худшее окно всегда начинается с одной из них.
  return sorted.some(
    (start, index) =>
      sorted.slice(index).filter((other) => other - start < WINDOW_MS).length >
      DUEL_PLAYER_WEEK_MAX,
  );
}
