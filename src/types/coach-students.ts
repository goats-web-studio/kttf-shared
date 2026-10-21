import { z } from 'zod';

import { pageQuerySchema } from './pagination.js';
import { cityRefSchema } from './place.js';

/**
 * Ученики тренера — T2 (ADR-059, `docs/11` 3.2). Игрок сам выбирает тренера
 * в анкете (ADR-035); каждая смена пишет историю `CoachTenure`. Считает
 * сервер — по анкетам, журналу рейтинга и местам в турнирах.
 *
 * Дети: младше 14 лет ученик не называется публично нигде — только числом
 * (ADR-059, риски). Возраст — по году рождения, как категории в теннисе.
 */

/** С какого возраста ученик называется по имени. */
export const STUDENT_NAMED_FROM_AGE = 14;

/** Называется ли ученик публично: исполнилось или исполнится 14 в этом году. */
export function isNamedStudent(birthYear: number, now: Date = new Date()): boolean {
  return now.getUTCFullYear() - birthYear >= STUDENT_NAMED_FROM_AGE;
}

/** Сколько лучших по рейтингу показывать. */
export const COACH_STUDENTS_TOP = 10;
/** Окно медалей учеников. */
export const COACH_MEDALS_DAYS = 30;
/** Сколько последних медалей называть. */
export const COACH_MEDALS_RECENT = 5;
/** Сколько последних турниров учеников показывать. */
export const COACH_TOURNAMENTS_RECENT = 5;
/** Окно «лучшего роста». */
export const COACH_GROWTH_DAYS = 182;
/** Сколько лучших по росту показывать. */
export const COACH_GROWTH_TOP = 3;

export const studentRefSchema = z.object({
  id: z.uuid(),
  lastName: z.string(),
  firstName: z.string(),
  photoUrl: z.string().nullable(),
  /** Строкой, как везде (ADR-014). */
  rating: z.string(),
  city: cityRefSchema,
});
export type StudentRef = z.infer<typeof studentRefSchema>;

export const studentMedalSchema = z.object({
  player: studentRefSchema,
  place: z.number().int().min(1).max(3),
  tournament: z.object({ id: z.uuid(), name: z.string(), startsAt: z.iso.datetime() }),
});
export type StudentMedal = z.infer<typeof studentMedalSchema>;

export const studentGrowthSchema = z.object({
  player: studentRefSchema,
  /** Прирост за окно, строкой со знаком: «+42.10». */
  delta: z.string(),
});
export type StudentGrowth = z.infer<typeof studentGrowthSchema>;

/**
 * Турнир, где играли ученики (T3): по тренеру, указанному в записи на
 * турнир, — учеником считается тот, кто заявился с этим тренером. Имён
 * нет: младшие 14 входят только в числа.
 */
export const studentTournamentSchema = z.object({
  tournament: z.object({ id: z.uuid(), name: z.string(), startsAt: z.iso.datetime() }),
  /** Сыгравших учеников: снятые и не явившиеся не считаются. */
  students: z.number().int().positive(),
  /** Мест 1, 2 и 3 у них. */
  gold: z.number().int().nonnegative(),
  silver: z.number().int().nonnegative(),
  bronze: z.number().int().nonnegative(),
});
export type StudentTournament = z.infer<typeof studentTournamentSchema>;

/**
 * Ученики на странице тренера — `GET /coaches/:id/students`. Публично,
 * если страница опубликована. Младшие 14 входят только в числа.
 */
export const coachStudentsViewSchema = z.object({
  /** Текущие: у кого этот тренер выбран в анкете сейчас. */
  current: z.number().int().nonnegative(),
  /** Из текущих — младше 14. */
  younger: z.number().int().nonnegative(),
  /** Бывшие: занимались раньше, сейчас тренер другой или не указан. */
  former: z.number().int().nonnegative(),
  /** Текущие с 14 лет, сильнейшие первыми. */
  top: z.array(studentRefSchema).max(COACH_STUDENTS_TOP),
  medals: z.object({
    /**
     * Мест 1–3 у учеников за окно — всех, включая младших. Учеником на
     * турнире считается тот, кто заявился с этим тренером (T3).
     */
    total: z.number().int().nonnegative(),
    /** Последние медали учеников с 14 лет. */
    recent: z.array(studentMedalSchema).max(COACH_MEDALS_RECENT),
  }),
  /** Лучший рост рейтинга за окно у учеников с 14 лет; только прирост. */
  growth: z.array(studentGrowthSchema).max(COACH_GROWTH_TOP),
  /** Последние завершённые турниры, где играли ученики, — новые первыми. */
  tournaments: z.array(studentTournamentSchema).max(COACH_TOURNAMENTS_RECENT),
});
export type CoachStudentsView = z.infer<typeof coachStudentsViewSchema>;

/**
 * Ученики в кабинете тренера — `GET /coaches/:id/students/manage`: все
 * текущие, с годом рождения. Тренер убирает чужую ссылку на себя —
 * `DELETE /coaches/:id/students/:playerId`.
 */
export const coachStudentRowSchema = z.object({
  player: studentRefSchema,
  birthYear: z.number().int(),
  /** С какого дня ученик у этого тренера. */
  since: z.iso.datetime(),
});
export type CoachStudentRow = z.infer<typeof coachStudentRowSchema>;

export const listCoachStudentsSchema = pageQuerySchema;
export type ListCoachStudentsQuery = z.infer<typeof listCoachStudentsSchema>;

/** Тренер в истории игрока: «Тренер: X с 2024; раньше — Y, 2020–2024». */
export const coachTenureViewSchema = z.object({
  coachPlayerId: z.uuid(),
  name: z.string(),
  /** Опубликованная страница тренера — тогда ссылкой. */
  slug: z.string().nullable(),
  from: z.iso.datetime(),
  /** `null` — тренер сейчас. */
  to: z.iso.datetime().nullable(),
});
export type CoachTenureView = z.infer<typeof coachTenureViewSchema>;
