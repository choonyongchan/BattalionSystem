import type { Soldier } from './supabase'
import { DUTY_ELIGIBILITY, DEFAULT_RANK_RULES, RANK_ORDER } from './companies'

function isInRange(rule: { from: string; to: string }, rank: string): boolean {
  const fi = RANK_ORDER.indexOf(rule.from)
  const ti = RANK_ORDER.indexOf(rule.to)
  const ri = RANK_ORDER.indexOf(rank)
  return fi !== -1 && ti !== -1 && ri !== -1 && ri >= fi && ri <= ti
}

/**
 * Determines whether a soldier is eligible for a duty type.
 *
 * Precedence (first match wins): a per-duty name override list, then a
 * per-duty rank-range override, then the default rank-range rule for that
 * duty, then the hardcoded DUTY_ELIGIBILITY fallback function.
 */
export function isEligible(dt: string, soldier: Soldier, nameOverrides: Record<string, string[]>, rankRuleOverrides: Record<string, { from: string; to: string }>): boolean {
  const nameOv = nameOverrides[dt]
  if (nameOv && nameOv.length > 0) return nameOv.includes(soldier.name)
  const rule = rankRuleOverrides[dt] ?? DEFAULT_RANK_RULES[dt]
  if (rule) return isInRange(rule, soldier.rank)
  return DUTY_ELIGIBILITY[dt]?.(soldier.rank) ?? false
}

export function eligibleSoldiers(dt: string, soldiers: Soldier[], nameOverrides: Record<string, string[]>, rankRuleOverrides: Record<string, { from: string; to: string }>): Soldier[] {
  return soldiers.filter((s) => isEligible(dt, s, nameOverrides, rankRuleOverrides))
}
