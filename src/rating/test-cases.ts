import type { MatchInput, ResultType } from './types.js';

/**
 * Детерминированный генератор входных данных для инвариантов.
 *
 * Инварианты формулируются как «при любых входных данных», и проверять их
 * пятью примерами нечестно. Внешний property-based фреймворк не берём:
 * бриф 4.1 запрещает добавлять зависимости без запроса, а детерминированный
 * генератор ещё и воспроизводим — упавший случай можно вернуть по номеру.
 */

const FACTORS: readonly number[] = [0.2, 0.25, 0.3, 0.35, 0.4];
const RESULT_TYPES: readonly ResultType[] = ['NORMAL', 'WALKOVER', 'RETIRED'];
const SET_SCORES: readonly (readonly [number, number])[] = [
  [2, 0],
  [2, 1],
  [3, 0],
  [3, 1],
  [3, 2],
  [4, 0],
  [4, 3],
];

/** Линейный конгруэнтный генератор. Тот же seed — та же последовательность. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick: пустой список');
  return item;
}

export interface GenerateOptions {
  readonly seed?: number;
  readonly count?: number;
}

/** Случаи, которые обязаны попасть в выборку всегда. */
const EDGE_CASES: readonly MatchInput[] = [
  // Равные рейтинги, оба обычные
  mk(250, 10, 250, 10, 3, 0, 0.3, 'NORMAL'),
  // Ровно на границе GAP_ZERO
  mk(350, 10, 250, 10, 3, 0, 0.3, 'NORMAL'),
  // На волос до границы
  mk(349.99, 10, 250, 10, 3, 0, 0.3, 'NORMAL'),
  // За границей
  mk(600, 10, 250, 10, 3, 0, 0.4, 'NORMAL'),
  // Сенсация: победил слабейший
  mk(250, 10, 600, 10, 3, 0, 0.4, 'NORMAL'),
  // Минимальный рейтинг
  mk(1, 10, 1, 10, 3, 0, 0.2, 'NORMAL'),
  // Новичок-победитель против обычного
  mk(250, 0, 250, 10, 3, 0, 0.3, 'NORMAL'),
  // Новичок-проигравший против обычного
  mk(250, 10, 250, 0, 3, 0, 0.3, 'NORMAL'),
  // Оба новички
  mk(250, 0, 250, 0, 3, 0, 0.3, 'NORMAL'),
  // На самой границе новичка: пятый турнир и шестой
  mk(250, 4, 250, 5, 3, 0, 0.3, 'NORMAL'),
  // Технические
  mk(250, 10, 250, 10, 3, 0, 0.3, 'WALKOVER'),
  mk(250, 10, 250, 10, 3, 0, 0.3, 'RETIRED'),
];

function mk(
  winnerRating: number,
  winnerTournaments: number,
  loserRating: number,
  loserTournaments: number,
  winnerSets: number,
  loserSets: number,
  tournamentFactor: number,
  resultType: ResultType,
): MatchInput {
  return {
    winner: {
      rating: winnerRating,
      ratedMatches: winnerTournaments * 5,
      ratedTournaments: winnerTournaments,
    },
    loser: {
      rating: loserRating,
      ratedMatches: loserTournaments * 5,
      ratedTournaments: loserTournaments,
    },
    winnerSets,
    loserSets,
    tournamentFactor,
    resultType,
  };
}

/** Широкая детерминированная выборка плюс обязательные краевые случаи. */
export function generateMatches({
  seed = 20260829,
  count = 20000,
}: GenerateOptions = {}): MatchInput[] {
  const random = createRandom(seed);
  const cases: MatchInput[] = [...EDGE_CASES];

  for (let i = 0; i < count; i += 1) {
    const sets = pick(random, SET_SCORES);
    const winnerTournaments = Math.floor(random() * 12);
    const loserTournaments = Math.floor(random() * 12);
    cases.push({
      winner: {
        // Рейтинги с двумя знаками — как они и хранятся в БД
        rating: Math.round(random() * 1400_00) / 100 + 1,
        ratedMatches: winnerTournaments * 5,
        ratedTournaments: winnerTournaments,
      },
      loser: {
        rating: Math.round(random() * 1400_00) / 100 + 1,
        ratedMatches: loserTournaments * 5,
        ratedTournaments: loserTournaments,
      },
      winnerSets: sets[0],
      loserSets: sets[1],
      tournamentFactor: pick(random, FACTORS),
      resultType: pick(random, RESULT_TYPES),
    });
  }

  return cases;
}
