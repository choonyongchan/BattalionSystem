import type { Soldier, DutyEntry } from '@/shared/types'
import type { RankRule } from '@/shared/ranks'
import { splitDutyNames } from '@/shared/names'
import { GUARD_DUTY } from '@/shared/guard-duty'
import { isEligible, isEligibleForGuardDuty } from './duty-rules'
import { resolveDayType, type DayType } from '@/backend/domain/settings/settings'

/** The points settings: base weight per duty, multiplier per day type, exact "<DutyType>:<DayType>" overrides. */
export interface WeightSettings {
  baseWeights: Record<string, number>
  dayMultipliers: Record<DayType, number>
  exceptions: Record<string, number>
}

/**
 * Each soldier's share of each duty's points. Per duty: an exact override for
 * "<DutyType>:<DayType>" wins, else baseWeight(dutyType) × dayMultiplier(dayType),
 * both defaulting to 1. A two-name duty splits its points evenly.
 */
function* dutyShares(duties: DutyEntry[], w: WeightSettings, holidays: Set<string>) {
  for (const d of duties) {
    const dt = resolveDayType(d.date, holidays)
    const points = w.exceptions[`${d.duty_type}:${dt}`] ?? (w.baseWeights[d.duty_type] ?? 1) * (w.dayMultipliers[dt] ?? 1)
    const names = splitDutyNames(d.name)
    for (const name of names) yield { name, dutyType: d.duty_type, share: points / names.length }
  }
}

/** Duty points per soldier name; pass `dutyType` to total only that duty (e.g. COS points). */
export function computePoints(duties: DutyEntry[], w: WeightSettings, holidays: Set<string>, dutyType?: string): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const { name, dutyType: dt, share } of dutyShares(duties, w, holidays)) {
    if (!dutyType || dt === dutyType) acc[name] = (acc[name] ?? 0) + share
  }
  return acc
}

/** Points per soldier per duty type, for the dashboard columns. */
export function computePointsByDutyType(duties: DutyEntry[], w: WeightSettings, holidays: Set<string>): Record<string, Record<string, number>> {
  const acc: Record<string, Record<string, number>> = {}
  for (const { name, dutyType, share } of dutyShares(duties, w, holidays)) {
    acc[name] ??= {}
    acc[name][dutyType] = (acc[name][dutyType] ?? 0) + share
  }
  return acc
}

/** Soldiers eligible for at least one points-earning duty. */
export function getEligibleForDuty(
  dutyTypes: string[],
  soldiers: Soldier[],
  eligibilityOverrides: Record<string, string[]>,
  rankRuleOverrides: Record<string, RankRule>,
  guardDutyRankOverrides: Record<string, RankRule> = {},
): Soldier[] {
  return soldiers.filter((s) => dutyTypes.some((dt) =>
    dt === GUARD_DUTY ? isEligibleForGuardDuty(s, guardDutyRankOverrides) : isEligible(dt, s, eligibilityOverrides, rankRuleOverrides),
  ))
}

/** Highest points first. */
export function sortByPoints(soldiers: Soldier[], points: Record<string, number>): Soldier[] {
  return [...soldiers].sort((a, b) => (points[b.name] ?? 0) - (points[a.name] ?? 0))
}
