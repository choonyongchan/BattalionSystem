'use client'

import { useState, useMemo } from 'react'
import type { Soldier, DutyEntry } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { isOnStrength, isRevoked } from '@/backend/domain/exceptions/active'
import { isEligible as checkEligible, isEligibleForGuardDuty } from '@/backend/domain/duty/duty-rules'
import { computePoints, computePointsByDutyType, getEligibleForDuty, sortByPoints } from '@/backend/domain/duty/duty-dashboard'
import { combine, useDuties, useExceptions, usePublicHolidaysQuery, useSettingsQuery, useSoldiers } from '@/frontend/hooks/queries'
import { pointsDutyTypes, resolveDayType } from '@/backend/domain/settings/settings'
import { THEME } from '@/frontend/theme'

/** Duty points leaderboard: who has done which duties, weighted by settings. */
export default function DutyDashboard({ company }: { company: Company }) {
  const soldiersQ = useSoldiers(company)
  const dutiesQ = useDuties(company)
  const guardQ = useExceptions(company, 'Guard Duty')
  const settingsQ = useSettingsQuery(company)
  const { loading, error } = combine(soldiersQ, dutiesQ, guardQ, settingsQ)
  const settings = settingsQ.data
  const dutyTypes = useMemo(() => (settings ? pointsDutyTypes(settings) : []), [settings])
  const soldiers = useMemo(() => (soldiersQ.data ?? []).filter(isOnStrength), [soldiersQ.data])
  // Guard duties live in Exceptions; they count on their (single) date
  const duties = useMemo<DutyEntry[]>(() => [
    ...(dutiesQ.data ?? []),
    ...(guardQ.data ?? []).filter((e) => !isRevoked(e)).map((e) => ({ duty_type: 'Guard Duty', date: e.end ?? e.start ?? '', name: e.name })),
  ], [dutiesQ.data, guardQ.data])
  const [filter, setFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState<'all' | 'weekday' | 'weekend'>('all')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  /** Sorts by a column; clicking the same column flips the direction. */
  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const { data: publicHolidays } = usePublicHolidaysQuery()
  const eligibilityOverrides = settings?.eligibility_name_overrides ?? {}
  const rankRuleOverrides = settings?.eligibility_rank_overrides ?? {}
  const guardDutyRankOverrides = settings?.guard_duty_rank_overrides ?? {}
  const holidays = useMemo(() => new Set((publicHolidays ?? []).map(h => h.date)), [publicHolidays])

  // ponytail: O(n) scan — battalion data is small; upgrade to RPC if duties > 10k rows
  const weightSettings = useMemo(() => ({
    baseWeights: settings?.duty_base_weights ?? {},
    dayMultipliers: settings?.duty_day_multipliers ?? { MonThurs: 1, Friday: 1, Saturday: 1, Sunday: 1, PublicHoliday: 1 },
    exceptions: settings?.duty_weight_exceptions ?? {},
  }), [settings])
  const dayFilteredDuties = useMemo(() => {
    if (dayFilter === 'all') return duties
    return duties.filter(d => {
      const isWeekday = resolveDayType(d.date, holidays) === 'MonThurs'
      return dayFilter === 'weekday' ? isWeekday : !isWeekday
    })
  }, [duties, dayFilter, holidays])
  const points = useMemo(() => computePoints(dayFilteredDuties, weightSettings, holidays), [dayFilteredDuties, weightSettings, holidays])
  const pointsByDutyType = useMemo(
    () => computePointsByDutyType(dayFilteredDuties, weightSettings, holidays),
    [dayFilteredDuties, weightSettings, holidays],
  )
  const filterPoints = useMemo(
    () => filter === 'all' ? points : computePoints(dayFilteredDuties, weightSettings, holidays, filter),
    [filter, points, dayFilteredDuties, weightSettings, holidays],
  )

  const eligibleForDuty = useMemo(
    () => getEligibleForDuty(dutyTypes, soldiers, eligibilityOverrides, rankRuleOverrides, guardDutyRankOverrides),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dutyTypes, soldiers, eligibilityOverrides, rankRuleOverrides, guardDutyRankOverrides],
  )

  const visible = useMemo(
    () => filter === 'all'
      ? eligibleForDuty
      : filter === 'Guard Duty'
        ? eligibleForDuty.filter(s => isEligibleForGuardDuty(s, guardDutyRankOverrides))
        : eligibleForDuty.filter(s => checkEligible(filter, s, eligibilityOverrides, rankRuleOverrides)),
    [eligibleForDuty, filter, eligibilityOverrides, rankRuleOverrides, guardDutyRankOverrides],
  )

  const sorted = useMemo(() => {
    if (sortCol) {
      /** A soldier's value in the sorted column. */
      const getValue = (s: Soldier) =>
        sortCol === 'Total' || sortCol === 'Points' ? (filterPoints[s.name] ?? 0) : (pointsByDutyType[s.name]?.[sortCol] ?? 0)
      return [...visible].sort((a, b) => sortDir === 'asc' ? getValue(a) - getValue(b) : getValue(b) - getValue(a))
    }
    return sortByPoints(visible, filterPoints)
  }, [visible, filterPoints, filter, sortCol, sortDir, pointsByDutyType])
  const maxPts = Math.max(...sorted.map(s => filterPoints[s.name] ?? 0), 1)

  if (loading) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-6">
            {error && <div role="alert" className="bg-danger/5 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* Day-type tabs */}
            <div className="flex border-b border-hairline">
              {(['all', 'weekday', 'weekend'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setDayFilter(f)}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    dayFilter === f ? `${THEME.activeBorder} ${THEME.activeText}` : 'border-transparent text-ink-60 hover:text-ink-80'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'weekday' ? 'M-T' : 'F-S/PH'}
                </button>
              ))}
            </div>

            {/* Filter pills — duty-weight editing now lives on the Settings page */}
            <div className="flex gap-2 flex-wrap">
              {['all', ...dutyTypes].map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSortCol(null) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f
                      ? `${THEME.buttonBg} ${THEME.buttonHoverBg} text-white`
                      : 'bg-parchment text-ink-80 hover:bg-hairline'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>

            {/* Breakdown */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">
                Duty Breakdown
              </h3>
              <div className="bg-white border border-hairline rounded-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-parchment border-b border-hairline">
                        <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Name</th>
                        {filter === 'all' ? (
                          <>
                            {dutyTypes.map(dt => (
                              <th
                                key={dt}
                                onClick={() => handleSort(dt)}
                                className="text-center px-2 py-1.5 font-medium text-ink-60 whitespace-nowrap cursor-pointer select-none hover:text-ink-80"
                              >
                                {dt}{sortCol === dt ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                              </th>
                            ))}
                            <th
                              onClick={() => handleSort('Total')}
                              className="text-center px-2 py-1.5 font-medium text-ink-60 whitespace-nowrap cursor-pointer select-none hover:text-ink-80"
                            >
                              Total{sortCol === 'Total' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </th>
                          </>
                        ) : (
                          <th
                            onClick={() => handleSort('Points')}
                            className="text-center px-2 py-1.5 font-medium text-ink-60 whitespace-nowrap cursor-pointer select-none hover:text-ink-80"
                          >
                            Points{sortCol === 'Points' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.length === 0 ? (
                        <tr>
                          <td colSpan={filter === 'all' ? dutyTypes.length + 2 : 2} className="px-4 py-8 text-center text-sm text-ink-60">
                            No personnel in this category
                          </td>
                        </tr>
                      ) : sorted.map((s, i) => {
                        const total = filterPoints[s.name] ?? 0
                        const isMax = total === maxPts && sorted.length > 1 && total > 0
                        return (
                          <tr key={s.name} className={`border-b border-hairline last:border-0 ${i % 2 === 1 ? 'bg-parchment/50' : ''}`}>
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium text-ink">{s.rank} {s.name}</td>
                            {filter === 'all' ? (
                              <>
                                {dutyTypes.map(dt => {
                                  const dtPoints = pointsByDutyType[s.name]?.[dt] ?? 0
                                  return (
                                    <td key={dt} className={`px-2 py-1.5 text-center ${dtPoints === 0 ? 'text-ink-48' : 'text-ink-80'}`}>
                                      {dtPoints === 0 ? '—' : dtPoints}
                                    </td>
                                  )
                                })}
                                <td className={`px-2 py-1.5 text-center font-bold ${isMax ? 'text-ink' : 'text-ink-80'}`}>
                                  {total}
                                </td>
                              </>
                            ) : (
                              <td className={`px-2 py-1.5 text-center font-bold ${isMax ? 'text-ink' : 'text-ink-80'}`}>
                                {total}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
    </div>
  )
}
