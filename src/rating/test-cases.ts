import type { MatchInput, ResultType, TournamentLevel } from './types.js';

/**
 * Детерминированный генератор входных данных для инвариантов.
 *
 * Инварианты формулируются как «при любых входных данных», и проверять их
 * пятью примерами нечестно. Внешний property-based фреймворк не берём:
 * бриф 4.1 запрещает добавлять зависимости без запроса, а детерминированный
 * генератор ещё и воспроизводим — упавший случай можно вернуть по номеру.
 */

const LEVELS: readonly TournamentLevel[] = ['CLUB', 'REGIONAL', 'NATIONAL'];
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
  // Равные рейтинги, оба рейтинговые
  mk(250, 50, 250, 50, 3, 0, 'REGIONAL', 'NORMAL'),
  // Ровно на границе GAP_ZERO
  mk(350, 50, 250, 50, 3, 0, 'REGIONAL', 'NORMAL'),
  // На волос до границы
  mk(349.99, 50, 250, 50, 3, 0, 'REGIONAL', 'NORMAL'),
  // За границей
  mk(600, 50, 250, 50, 3, 0, 'NATIONAL', 'NORMAL'),
  // Сенсация: победил слабейший
  mk(250, 50, 600, 50, 3, 0, 'NATIONAL', 'NORMAL'),
  // Минимальный рейтинг
  mk(1, 50, 1, 50, 3, 0, 'CLUB', 'NORMAL'),
  // Провизорный победитель против рейтингового
  mk(250, 0, 250, 50, 3, 0, 'REGIONAL', 'NORMAL'),
  // Провизорный проигравший против рейтингового
  mk(250, 50, 250, 0, 3, 0, 'REGIONAL', 'NORMAL'),
  // Оба провизорные
  mk(250, 0, 250, 0, 3, 0, 'REGIONAL', 'NORMAL'),
  // На самой границе провизорности
  mk(250, 19, 250, 20, 3, 0, 'REGIONAL', 'NORMAL'),
  // Технические
  mk(250, 50, 250, 50, 3, 0, 'REGIONAL', 'WALKOVER'),
  mk(250, 50, 250, 50, 3, 0, 'REGIONAL', 'RETIRED'),
];

function mk(
  winnerRating: number,
  winnerMatches: number,
  loserRating: number,
  loserMatches: number,
  winnerSets: number,
  loserSets: number,
  level: TournamentLevel,
  resultType: ResultType,
): MatchInput {
  return {
    winner: { rating: winnerRating, ratedMatches: winnerMatches },
    loser: { rating: loserRating, ratedMatches: loserMatches },
    winnerSets,
    loserSets,
    level,
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
    cases.push({
      winner: {
        // Рейтинги с двумя знаками — как они и хранятся в БД
        rating: Math.round(random() * 900_00) / 100 + 1,
        ratedMatches: Math.floor(random() * 60),
      },
      loser: {
        rating: Math.round(random() * 900_00) / 100 + 1,
        ratedMatches: Math.floor(random() * 60),
      },
      winnerSets: sets[0],
      loserSets: sets[1],
      level: pick(random, LEVELS),
      resultType: pick(random, RESULT_TYPES),
    });
  }

  return cases;
}
