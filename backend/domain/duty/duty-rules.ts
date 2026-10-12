import type { Soldier } from '@/shared/types'
import { ANY_RANK, DEFAULT_RANK_RULES, RANK_INDEX, GUARD_DUTY_ROLES, DEFAULT_GUARD_DUTY_RANK_RULES, type RankRule } from '@/shared/ranks'

/** True when `rank` lies within the rule's from–to range. */
export function isInRange(rule: RankRule, rank: string): boolean {
  const fi = RANK_INDEX[rule.from]
  const ti = RANK_INDEX[rule.to]
  const ri = RANK_INDEX[rank]
  return fi !== undefined && ti !== undefined && ri !== undefined && ri >= fi && ri <= ti
}

/**
 * True when either rank is unknown or the from rank is senior to the to rank.
 * Such a range matches nobody (see isInRange), so callers block saving it.
 */
export function isRankRangeInvalid(rule: RankRule): boolean {
  const fi = RANK_INDEX[rule.from]
  const ti = RANK_INDEX[rule.to]
  return fi === undefined || ti === undefined || fi > ti
}

/**
 * Whether a soldier may do duty `dt`. First match wins: the duty's name override list,
 * then its rank-range override, then its default rank range, else any rank.
 */
export function isEligible(dt: string, soldier: Soldier, nameOverrides: Record<string, string[]>, rankRuleOverrides: Record<string, RankRule>): boolean {
  const nameOv = nameOverrides[dt]
  if (nameOv && nameOv.length > 0) return nameOv.includes(soldier.name)
  return isInRange(rankRuleFor(dt, rankRuleOverrides), soldier.rank)
}

/** The rank range in force for duty `dt`: its override, else its default, else any rank. */
export function rankRuleFor(dt: string, rankRuleOverrides: Record<string, RankRule>): RankRule {
  return rankRuleOverrides[dt] ?? DEFAULT_RANK_RULES[dt] ?? ANY_RANK
}

/** Soldiers who may do duty `dt`. */
export function eligibleSoldiers(dt: string, soldiers: Soldier[], nameOverrides: Record<string, string[]>, rankRuleOverrides: Record<string, RankRule>): Soldier[] {
  return soldiers.filter((s) => isEligible(dt, s, nameOverrides, rankRuleOverrides))
}

/** Guard Duty has no single rank rule: a soldier is eligible if their rank fits any role's range. */
export function isEligibleForGuardDuty(soldier: Soldier, guardDutyRankOverrides: Record<string, RankRule>): boolean {
  return GUARD_DUTY_ROLES.some((role) => isInRange(guardDutyRankOverrides[role] ?? DEFAULT_GUARD_DUTY_RANK_RULES[role], soldier.rank))
}
