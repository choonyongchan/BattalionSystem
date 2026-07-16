import type { Soldier, DutyEntry } from '../supabase'
import { isEligible, isEligibleForGuardDuty } from './duty-rules'
import { resolveDayType } from '../settings'
import type { DayType } from '../settings'

export interface WeightSettings {
  baseWeights: Record<string, number>
  dayMultipliers: Record<DayType, number>
  exceptions: Record<string, number>
}

/**
 * Sums duty points per soldier name. Per duty: an exact override for "<DutyType>:<DayType>"
 * wins if present, otherwise points = baseWeight(dutyType) Ã— dayMultiplier(dayType), both
 * defaulting to 1 when unset. Pass dutyType to total only that duty type (e.g. COS points).
 */
export function computePoints(
  duties: DutyEntry[],
  weightSettings: WeightSettings,
  holidays: Set<string>,
  dutyType?: string,
): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const d of duties) {
    if (dutyType && d.duty_type !== dutyType) continue
    const dt = resolveDayType(d.date, holidays)
    const key = `${d.duty_type}:${dt}`
    const points = weightSettings.exceptions[key]
      ?? (weightSettings.baseWeights[d.duty_type] ?? 1) * (weightSettings.dayMultipliers[dt] ?? 1)
    acc[d.name] = (acc[d.name] ?? 0) + points
  }
  return acc
}

export function computePointsByDutyType(
  duties: DutyEntry[],
  weightSettings: WeightSettings,
  holidays: Set<string>,
): Record<string, Record<string, number>> {
  const acc: Record<string, Record<string, number>> = {}
  for (const d of duties) {
    const dt = resolveDayType(d.date, holidays)
    const key = `${d.duty_type}:${dt}`
    const points = weightSettings.exceptions[key]
      ?? (weightSettings.baseWeights[d.duty_type] ?? 1) * (weightSettings.dayMultipliers[dt] ?? 1)
    acc[d.name] ??= {}
    acc[d.name][d.duty_type] = (acc[d.name][d.duty_type] ?? 0) + points
  }
  return acc
}

export function getEligibleForDuty(
  dutyTypes: string[],
  soldiers: Soldier[],
  eligibilityOverrides: Record<string, string[]>,
  rankRuleOverrides: Record<string, { from: string; to: string }>,
  guardDutyRankOverrides: Record<string, { from: string; to: string }> = {},
): Soldier[] {
  return soldiers.filter((s) => dutyTypes.some((dt) =>
    dt === 'Guard Duty' ? isEligibleForGuardDuty(s, guardDutyRankOverrides) : isEligible(dt, s, eligibilityOverrides, rankRuleOverrides),
  ))
}

export function sortByPoints(soldiers: Soldier[], points: Record<string, number>): Soldier[] {
  return [...soldiers].sort((a, b) => (points[a.name] ?? 0) - (points[b.name] ?? 0))
}
