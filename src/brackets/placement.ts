import { bracketPlacement, groupsBracketPlacement } from './placement-bracket.js';
import { finalGroupsPlacement, singleTablePlacement } from './placement-table.js';
import type { Placement, PlacementInput, PlacementScheme } from './placement-types.js';

/**
 * Итоговые места турнира — ТЗ 9.4.
 *
 * Место выводится **не одной функцией на все схемы, а стратегией на схему**.
 * Схем впереди много: группы с распределением по нескольким сеткам, верхняя
 * и нижняя сетка, отсев без доигрывания, когда из 128 записавшихся в основную
 * сетку попадают 64. Общая функция со списком условий по типу схемы
 * превратилась бы в свалку, которую переписывает каждая новая схема, — а это
 * `brackets`, где 100% покрытия и тот же код исполняется в офлайн-консоли.
 *
 * Новая схема — это новый файл рядом и новая запись в `STRATEGIES`. Тип
 * `Record` требует запись на каждый вариант `PlacementScheme`, поэтому
 * добавить схему и забыть про её места не получится: не соберётся.
 */

const STRATEGIES: Record<PlacementScheme, (input: PlacementInput) => Placement> = {
  ROUND_ROBIN: singleTablePlacement,
  KNOCKOUT: bracketPlacement,
  GROUPS_KNOCKOUT: groupsBracketPlacement,
  GROUPS_FINAL_GROUPS: finalGroupsPlacement,
};

export function calculatePlacement(scheme: PlacementScheme, input: PlacementInput): Placement {
  return STRATEGIES[scheme](input);
}
