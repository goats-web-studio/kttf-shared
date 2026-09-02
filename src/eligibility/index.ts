/**
 * Допуск игрока на турнир — ТЗ 4.3.
 *
 * Чистый модуль без единой зависимости, как `rating` и `brackets`: правило
 * читают и сервер при записи, и интерфейс, чтобы объяснить отказ до нажатия.
 * Второе описание этих условий на клиенте нарушило бы запрет №2 брифа.
 */
export {
  checkEligibility,
  type EligibilityCandidate,
  type EligibilityLimits,
  type EligibilityProblem,
} from './eligibility.js';
