import { useEffect, useMemo, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import type { DutyEntry, Exception, Soldier } from '@/shared/types'
import { weekDates } from '@/shared/dates'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { DutyRepository } from '@/backend/data/repositories/DutyRepository'
import { StrengthOverrideRepository } from '@/backend/data/repositories/StrengthOverrideRepository'
import { exceptionLinkFields, isOnStrength, isRevoked } from '@/backend/domain/exceptions/active'
import { strengthInputsFromRows, type StrengthInputs } from '@/backend/domain/parade/strength'

/** Everything the Parade State tab reads and writes, returned by useParadeData. */
export type ParadeData = ReturnType<typeof useParadeData>

/**
 * Loads the nominal roll, exceptions, the week's duties and strength overrides for the
 * Parade State tab, and exposes the repositories plus a write helper that reloads.
 * @param company Company whose data to load.
 * @param date Selected duty date; duties load for its Mon–Sun week.
 */
export function useParadeData(company: Company, date: string) {
  const repos = useMemo(() => ({
    soldiers: new SoldierRepository(company),
    exceptions: new ExceptionRepository(company),
    duties: new DutyRepository(company),
    strength: new StrengthOverrideRepository(company),
  }), [company])

  // Everyone, posted-out included: the report needs them to drop their exceptions (see generateParadeReport)
  const [allSoldiers, setAllSoldiers] = useState<Soldier[]>([])
  const soldiers = useMemo(() => allSoldiers.filter(isOnStrength), [allSoldiers])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [duties, setDuties] = useState<DutyEntry[]>([])
  const [strInputs, setStrInputs] = useState<StrengthInputs>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Refreshes in place so edits keep the scroll position. */
  async function load() {
    setError(null)
    const week = weekDates(date)
    const [soldiersRes, exceptionsRes, dutiesRes, strRes] = await Promise.all([
      repos.soldiers.list(),
      repos.exceptions.list(),
      repos.duties.list(week[0], week[6]),
      repos.strength.list(),
    ])
    if (soldiersRes.error) setError(soldiersRes.error.message)
    setAllSoldiers(soldiersRes.data)
    // Revoked rows count nowhere here — they live on in the soldier's history (SoldierSheet)
    setExceptions(exceptionsRes.data.filter((e) => !isRevoked(e)))
    setDuties(dutiesRes.data)
    setStrInputs(strengthInputsFromRows(strRes.data))
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [company, date])

  /** Runs a write; on error shows it and returns false, otherwise reloads and returns true. */
  async function mutate(write: () => PromiseLike<{ error: PostgrestError | null }>): Promise<boolean> {
    const { error } = await write()
    if (error) {
      setError(error.message)
      return false
    }
    await load()
    return true
  }

  /** Soldier link + type for an exception written for `name` (see exceptionLinkFields). */
  const linkFields = (name: string, scope: string, reason: string | null, currentType?: string | null) =>
    exceptionLinkFields(allSoldiers, name, scope, reason, currentType)

  /** Saves one strength override cell; blank clears it. */
  async function saveStrengthCell(platoon: string, rankType: string, val: string) {
    if (val === '') await repos.strength.remove(platoon, rankType)
    else if (!isNaN(Number(val))) await repos.strength.upsert({ platoon, rank_type: rankType, value: Number(val) })
  }

  return {
    repos, loading, error, allSoldiers, soldiers, exceptions, duties,
    strInputs, setStrInputs, mutate, linkFields, saveStrengthCell,
  }
}
