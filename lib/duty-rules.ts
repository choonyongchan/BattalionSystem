import type { Soldier } from './supabase'
import { DUTY_ELIGIBILITY, DEFAULT_RANK_RULES, RANK_ORDER } from './companies'

class DutyRulesEngine {
  private rankOrder: string[]
  private defaultRules: Record<string, { from: string; to: string }>

  constructor(rankOrder: string[], defaultRules: Record<string, { from: string; to: string }>) {
    this.rankOrder = rankOrder
    this.defaultRules = defaultRules
  }

  private isInRange(rule: { from: string; to: string }, rank: string): boolean {
    const fi = this.rankOrder.indexOf(rule.from)
    const ti = this.rankOrder.indexOf(rule.to)
    const ri = this.rankOrder.indexOf(rank)
    return fi !== -1 && ti !== -1 && ri !== -1 && ri >= fi && ri <= ti
  }

  isEligible(
    dt: string,
    soldier: Soldier,
    nameOverrides: Record<string, string[]>,
    rankRuleOverrides: Record<string, { from: string; to: string }>,
  ): boolean {
    const nameOv = nameOverrides[dt]
    if (nameOv && nameOv.length > 0) return nameOv.includes(soldier.name)
    const rule = rankRuleOverrides[dt] ?? this.defaultRules[dt]
    if (rule) return this.isInRange(rule, soldier.rank)
    return DUTY_ELIGIBILITY[dt]?.(soldier.rank) ?? false
  }

  eligibleSoldiers(
    dt: string,
    soldiers: Soldier[],
    nameOverrides: Record<string, string[]>,
    rankRuleOverrides: Record<string, { from: string; to: string }>,
  ): Soldier[] {
    return soldiers.filter(s => this.isEligible(dt, s, nameOverrides, rankRuleOverrides))
  }
}

export const dutyRules = new DutyRulesEngine(RANK_ORDER, DEFAULT_RANK_RULES)
