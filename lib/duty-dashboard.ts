import type { Soldier, DutyEntry } from './supabase'
import { isEligible } from './duty-rules'

/** Sums duty weights per soldier name; pass dutyType to total only that duty type (e.g. COS points). */
export function computePoints(duties: DutyEntry[], weights: Record<string, number>, dutyType?: string): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const d of duties) {
    if (dutyType && d.duty_type !== dutyType) continue
    acc[d.name] = (acc[d.name] ?? 0) + (weights[d.duty_type] ?? 1)
  }
  return acc
}

export function computeDutyCounts(duties: DutyEntry[]): Record<string, Record<string, number>> {
  const acc: Record<string, Record<string, number>> = {}
  for (const d of duties) {
    acc[d.name] ??= {}
    acc[d.name][d.duty_type] = (acc[d.name][d.duty_type] ?? 0) + 1
  }
  return acc
}

export function getEligibleForDuty(
  dutyTypes: string[],
  soldiers: Soldier[],
  eligibilityOverrides: Record<string, string[]>,
  rankRuleOverrides: Record<string, { from: string; to: string }>,
): Soldier[] {
  return soldiers.filter((s) => dutyTypes.some((dt) => isEligible(dt, s, eligibilityOverrides, rankRuleOverrides)))
}

export function sortByPoints(soldiers: Soldier[], points: Record<string, number>): Soldier[] {
  return [...soldiers].sort((a, b) => (points[a.name] ?? 0) - (points[b.name] ?? 0))
}
