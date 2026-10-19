import { z } from 'zod';

/**
 * Тариф страницы клуба — ADR-055, `docs/09` 4.5.
 *
 * Заложен и выключен: план хранится у клуба, лимиты описаны здесь, но
 * пока `CLUB_PLANS_ENABLED` ложен, каждому клубу действует один защитный
 * предел, равный будущему Pro. Страница не должна расти без конца, но и
 * урезать бесплатно никого не должна, пока тарифы не объявлены.
 *
 * Это не `Tariff` из ТЗ 8.3: тот — плата за турниры, а это — страница.
 */

export const CLUB_PLANS = ['FREE', 'PRO'] as const;
export const clubPlanSchema = z.enum(CLUB_PLANS);
export type ClubPlan = z.infer<typeof clubPlanSchema>;

export const CLUB_PLANS_ENABLED = false;

export interface ClubPlanLimits {
  readonly photos: number;
  readonly videos: number;
  /** `null` — без предела. */
  readonly postsPerMonth: number | null;
  readonly pinnedPosts: number;
  /** Глубина статистики в днях. */
  readonly statsDays: number;
}

/** Черновик лимитов. Числа обсуждаются с владельцем до включения тарифов. */
export const CLUB_PLAN_LIMITS: Readonly<Record<ClubPlan, ClubPlanLimits>> = {
  FREE: { photos: 12, videos: 2, postsPerMonth: 4, pinnedPosts: 0, statsDays: 30 },
  PRO: { photos: 100, videos: 20, postsPerMonth: null, pinnedPosts: 1, statsDays: 365 },
};

/** Лимиты, которые действуют сейчас: план клуба или, пока тарифы выключены, защитный предел. */
export function clubLimits(plan: ClubPlan, enabled: boolean = CLUB_PLANS_ENABLED): ClubPlanLimits {
  return enabled ? CLUB_PLAN_LIMITS[plan] : CLUB_PLAN_LIMITS.PRO;
}
