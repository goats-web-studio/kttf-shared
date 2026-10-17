/**
 * Длина встречи по кругам плей-офф — ТЗ 5.2, ADR-044.
 *
 * Организатор задаёт общую длину плей-офф и, по желанию, отдельную для
 * финала, встречи за третье место и любого из кругов до 1/64. Не заданное
 * играется общей длиной.
 *
 * Правило живёт здесь, а не в приложении: счёт проверяют и сервер, и
 * офлайн-консоль без сети, и разойтись в том, до скольких побед идёт финал,
 * они не имеют права (запрет №2). Обоим хватает того, что уже лежит у
 * встречи, — круга и позиции в нём: колонка длины во встрече не нужна.
 */

/** Круги, у которых длину можно задать отдельно, — от финала к началу сетки. */
export const PLAYOFF_ROUNDS = [
  'final',
  'thirdPlace',
  'semifinal',
  'quarterfinal',
  'roundOf16',
  'roundOf32',
  'roundOf64',
] as const;
export type PlayoffRound = (typeof PLAYOFF_ROUNDS)[number];

/**
 * Длины по кругам. Отсутствующий круг играется общей длиной плей-офф.
 *
 * `undefined` допускается явно: так выглядит необязательное поле после
 * разбора схемой, и тип обязан принять его без приведения.
 */
export type PlayoffLengths = Readonly<{ [K in PlayoffRound]?: number | undefined }>;

/** Круги основной сетки по удалённости от финала: 0 — финал. */
const BY_DISTANCE: readonly PlayoffRound[] = [
  'final',
  'semifinal',
  'quarterfinal',
  'roundOf16',
  'roundOf32',
  'roundOf64',
];

/** Встреча сетки так, как она хранится: круг и позиция в нём. */
export interface BracketPosition {
  /** Круг сетки, 1 — первый. Финал и встреча за третье место — последний. */
  readonly round: number;
  /** Позиция в круге, с нуля. */
  readonly slot: number;
}

/**
 * Какой это круг сетки.
 *
 * Встреча за третье место стоит в последнем круге второй позицией — так её
 * ставит `buildKnockout`, и по этой паре её отличают от финала. `null` —
 * круг раньше 1/64: для него отдельной длины не бывает.
 *
 * @param rounds Число кругов сетки — двоичный логарифм её размера.
 */
export function playoffRoundOf(match: BracketPosition, rounds: number): PlayoffRound | null {
  if (match.round === rounds && match.slot === 1) {
    return 'thirdPlace';
  }

  return BY_DISTANCE[rounds - match.round] ?? null;
}

/**
 * До скольких побед идёт эта встреча плей-офф.
 *
 * @param base Общая длина плей-офф.
 * @param lengths Длины по кругам; не заданные берутся из `base`.
 */
export function playoffSetsToWin(
  base: number,
  lengths: PlayoffLengths | undefined,
  match: BracketPosition,
  rounds: number,
): number {
  const round = playoffRoundOf(match, rounds);

  return (round === null ? undefined : lengths?.[round]) ?? base;
}

/**
 * Круги, которые будут в сетке заданного размера, — чтобы форма турнира
 * предлагала настроить только существующие.
 *
 * @param bracketSize Размер сетки, степень двойки.
 * @param thirdPlace Играется ли встреча за третье место.
 */
export function playoffRoundsFor(bracketSize: number, thirdPlace: boolean): PlayoffRound[] {
  const rounds = bracketSize < 2 ? 0 : Math.log2(bracketSize);
  const result = BY_DISTANCE.slice(0, rounds);

  // Встреча за третье место — между проигравшими полуфиналистами: без
  // полуфиналов её не бывает.
  if (thirdPlace && rounds >= 2) {
    result.splice(1, 0, 'thirdPlace');
  }

  return result;
}
