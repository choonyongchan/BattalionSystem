import type { Soldier } from '@/shared/types'
import { getRankType, RANK_TYPES } from '@/shared/ranks'

/** Strength per platoon key, per rank type, e.g. { Total: { Officer: 3, ... }, HQ: {...} }. */
export type StrengthTable = Record<string, Record<string, number>>

/** Raw override inputs as typed by the user, keyed like StrengthTable ('' = no override). */
export type StrengthInputs = Record<string, Record<string, string>>

/**
 * Counts soldiers per platoon and rank type from the nominal roll.
 * @param soldiers On-strength soldiers.
 * @param platoonKeys Rows to compute; 'Total' counts everyone, others match Soldier.platoon.
 */
export function computeStrength(soldiers: Soldier[], platoonKeys: readonly string[]): StrengthTable {
  const result: StrengthTable = {}
  for (const platoon of platoonKeys) {
    const pool = platoon === 'Total' ? soldiers : soldiers.filter((s) => s.platoon === platoon)
    result[platoon] = Object.fromEntries(RANK_TYPES.map((rt) => [rt, pool.filter((s) => getRankType(s.rank) === rt).length]))
  }
  return result
}

/** Builds the editable override grid from stored rows. */
export function strengthInputsFromRows(rows: { platoon: string; rank_type: string; value: number }[]): StrengthInputs {
  const out: StrengthInputs = {}
  for (const row of rows) (out[row.platoon] ??= {})[row.rank_type] = String(row.value)
  return out
}

/** Converts the editable override grid to numbers, dropping blank cells. */
export function strengthInputsToNumbers(inputs: StrengthInputs): StrengthTable {
  const out: StrengthTable = {}
  for (const [platoon, byRank] of Object.entries(inputs)) {
    out[platoon] = {}
    for (const [rt, val] of Object.entries(byRank)) if (val !== '') out[platoon][rt] = Number(val)
  }
  return out
}

/** Returns a warning when an override differs from the nominal roll count, else null. */
export function strWarn(platoon: string, rt: string, inputs: StrengthInputs, computed: StrengthTable): string | null {
  const raw = inputs[platoon]?.[rt]
  if (!raw && raw !== '0') return null
  const override = Number(raw)
  if (isNaN(override)) return null
  const count = computed[platoon]?.[rt] ?? 0
  if (override !== count) return `Nominal roll has ${count} – override is ${override}`
  return null
}

/** True when any platoon/rank-type override differs from the nominal roll. */
export function anyMismatch(platoons: readonly string[], rankTypes: readonly string[], inputs: StrengthInputs, computed: StrengthTable): boolean {
  return platoons.some((p) => rankTypes.some((rt) => strWarn(p, rt, inputs, computed) !== null))
}
