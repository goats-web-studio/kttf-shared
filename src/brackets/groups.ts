import { at } from './internal.js';
import type { ParticipantId } from './types.js';

export interface GroupCandidate {
  readonly participant: ParticipantId;
  /** Клуб. Нужен только для разведения; без него участник разводится как «ничей». */
  readonly club?: string;
}

export interface GroupSplitOptions {
  /** Сколько групп. Взаимоисключающе с `groupSize`. */
  readonly groupCount?: number;
  /** Желаемый размер группы. Число групп выводится делением с округлением вверх. */
  readonly groupSize?: number;
  /** Разводить игроков одного клуба по разным группам. По умолчанию да. */
  readonly separateByClub?: boolean;
}

export interface Group {
  readonly label: string;
  readonly participants: readonly ParticipantId[];
}

/** Игроки одного клуба, оказавшиеся в одной группе. */
export interface ClubCollision {
  readonly club: string;
  readonly group: string;
  readonly participants: readonly ParticipantId[];
}

export interface GroupSplit {
  readonly groups: readonly Group[];
  /**
   * Совпадения, которые развести не удалось.
   *
   * Пустой список — не гарантия: если игроков клуба больше, чем групп,
   * совпадение неизбежно арифметически. Список существует, чтобы организатор
   * это видел и мог поправить руками, а не обнаружил в зале.
   */
  readonly clubCollisions: readonly ClubCollision[];
}

/**
 * Разбивка участников на группы змейкой с разведением по клубам.
 *
 * Участники передаются **уже посеянными**: первый в списке сильнейший.
 * Змейка раскладывает их полосами — первая полоса по группам слева направо,
 * вторая справа налево, и так далее. Полоса — это участники примерно равной
 * силы, и группы получаются сопоставимыми.
 *
 * **Разведение по клубам работает только перестановками внутри полосы.**
 * Требования ТЗ 5.2 просят и посев по рейтингу, и разведение по клубам,
 * а в общем случае выполнить оба невозможно. Приоритет отдан посеву:
 * менять полосу означало бы двигать игрока через уровень силы и делать
 * группы неравными, что видно всем и портит турнир сильнее, чем два
 * одноклубника в одной группе. Обоснование — ADR-011.
 */
export function splitIntoGroups(
  candidates: readonly GroupCandidate[],
  options: GroupSplitOptions,
): GroupSplit {
  const participants = candidates.map((candidate) => candidate.participant);
  if (new Set(participants).size !== participants.length) {
    throw new Error('splitIntoGroups: участники должны быть уникальны');
  }

  const groupCount = resolveGroupCount(candidates.length, options);
  if (groupCount === 0) return { groups: [], clubCollisions: [] };

  const clubOf = new Map(
    candidates.map((candidate) => [candidate.participant, candidate.club] as const),
  );

  const buckets: ParticipantId[][] = Array.from({ length: groupCount }, () => []);
  const clubsInBucket: Set<string>[] = Array.from({ length: groupCount }, () => new Set<string>());

  const separate = options.separateByClub ?? true;

  for (let bandStart = 0; bandStart < candidates.length; bandStart += groupCount) {
    const band = candidates.slice(bandStart, bandStart + groupCount);
    const bandIndex = bandStart / groupCount;

    // Змейка: чётные полосы слева направо, нечётные — справа налево.
    const targets = Array.from({ length: groupCount }, (_, index) => index);
    if (bandIndex % 2 === 1) targets.reverse();

    const remaining = [...band];

    for (const target of targets) {
      if (remaining.length === 0) break;
      const pickedIndex = separate ? pickWithoutClash(remaining, at(clubsInBucket, target)) : 0;
      const picked = at(remaining, pickedIndex);
      remaining.splice(pickedIndex, 1);

      at(buckets, target).push(picked.participant);
      if (picked.club !== undefined) at(clubsInBucket, target).add(picked.club);
    }
  }

  const groups = buckets.map((participantsInGroup, index) => ({
    label: `гр. ${String(index + 1)}`,
    participants: participantsInGroup,
  }));

  return { groups, clubCollisions: findClubCollisions(groups, clubOf) };
}

/**
 * Первый участник полосы, чей клуб ещё не представлен в группе.
 *
 * Жадный выбор: он не гарантирует минимума совпадений при сложных раскладах,
 * но прост, детерминирован и на реальных составах (12–24 участника, единицы
 * клубов) даёт тот же результат, что перебор.
 */
function pickWithoutClash(
  remaining: readonly GroupCandidate[],
  clubs: ReadonlySet<string>,
): number {
  const found = remaining.findIndex(
    (candidate) => candidate.club === undefined || !clubs.has(candidate.club),
  );
  return found === -1 ? 0 : found;
}

function resolveGroupCount(total: number, options: GroupSplitOptions): number {
  if (total === 0) return 0;

  const { groupCount, groupSize } = options;
  if (groupCount !== undefined && groupSize !== undefined) {
    throw new Error('splitIntoGroups: задайте либо groupCount, либо groupSize, но не оба');
  }

  if (groupCount !== undefined) {
    if (!Number.isInteger(groupCount) || groupCount < 1) {
      throw new Error(
        `splitIntoGroups: groupCount должен быть целым от 1, получено ${String(groupCount)}`,
      );
    }
    return Math.min(groupCount, total);
  }

  if (groupSize !== undefined) {
    if (!Number.isInteger(groupSize) || groupSize < 2) {
      throw new Error(
        `splitIntoGroups: groupSize должен быть целым от 2, получено ${String(groupSize)}`,
      );
    }
    return Math.max(1, Math.ceil(total / groupSize));
  }

  throw new Error('splitIntoGroups: не задано ни groupCount, ни groupSize');
}

/**
 * Игроки одного клуба, оказавшиеся в одной группе.
 *
 * Экспортируется, потому что состав групп меняет не только жеребьёвка:
 * после ручной перестановки (ТЗ 5.3) совпадения нужно пересчитать, а второе
 * их описание разошлось бы с этим — запрет №2 брифа.
 */
export function findClubCollisions(
  groups: readonly Group[],
  clubOf: ReadonlyMap<ParticipantId, string | undefined>,
): ClubCollision[] {
  const collisions: ClubCollision[] = [];

  for (const group of groups) {
    const byClub = new Map<string, ParticipantId[]>();
    for (const participant of group.participants) {
      const club = clubOf.get(participant);
      if (club === undefined) continue;
      const members = byClub.get(club);
      if (members === undefined) byClub.set(club, [participant]);
      else members.push(participant);
    }

    for (const [club, members] of byClub) {
      if (members.length > 1) {
        collisions.push({ club, group: group.label, participants: members });
      }
    }
  }

  return collisions;
}
