'use client'

import { useState, useMemo } from 'react'
import type { Soldier, DutyEntry } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { GUARD_DUTY, pointsGroupOf } from '@/shared/guard-duty'
import { isOnStrength } from '@/backend/domain/exceptions/active'
import { isEligible as checkEligible, isEligibleForGuardDuty } from '@/backend/domain/duty/duty-rules'
import { computePoints, computePointsByDutyType, getEligibleForDuty, sortByPoints } from '@/backend/domain/duty/duty-dashboard'
import { combine, useDuties, usePublicHolidaysQuery, useSettingsQuery, useSoldiers } from '@/frontend/hooks/queries'
import { pointsDutyTypes, resolveDayType } from '@/backend/domain/settings/settings'
import { Banner, Loading, PageHeader, SectionTitle } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'
import { SortTh, TD, Table, Th, rowClass } from '@/frontend/components/ui/table'

const DAY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'weekday', label: 'M-T' },
  { value: 'weekend', label: 'F-S/PH' },
] as const

/** Duty points leaderboard: who has done which duties, weighted by settings. */
export default function DutyDashboard({ company }: { company: Company }) {
  const soldiersQ = useSoldiers(company)
  const dutiesQ = useDuties(company)
  const settingsQ = useSettingsQuery(company)
  const { loading, error } = combine(soldiersQ, dutiesQ, settingsQ)
  const settings = settingsQ.data
  const dutyTypes = useMemo(() => (settings ? pointsDutyTypes(settings) : []), [settings])
  const soldiers = useMemo(() => (soldiersQ.data ?? []).filter(isOnStrength), [soldiersQ.data])
  // Every guard role earns points as one Guard Duty
  const duties = useMemo<DutyEntry[]>(
    () => (dutiesQ.data ?? []).map((d) => ({ ...d, duty_type: pointsGroupOf(d.duty_type) })),
    [dutiesQ.data],
  )
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
      : filter === GUARD_DUTY
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

  if (loading) return <Loading />

  /** Sortable points column; clicking the same column flips the direction. */
  const sortHeader = (col: string) => (
    <SortTh key={col} label={col} className="text-center" dir={sortCol === col ? sortDir : null} onSort={() => handleSort(col)} />
  )

  return (
    <div className="space-y-4">
      <PageHeader title="Duty Dashboard" subtitle="Duty points per soldier, weighted by Settings" />

      {error && <Banner>{error}</Banner>}

      <Segmented aria-label="Days" value={dayFilter} onChange={setDayFilter} options={DAY_FILTERS} />

      {/* Duty-weight editing lives on the Settings page */}
      <Segmented
        aria-label="Duty"
        value={filter}
        onChange={(f) => { setFilter(f); setSortCol(null) }}
        options={['all', ...dutyTypes].map((f) => ({ value: f, label: f === 'all' ? 'All' : f }))}
      />

      <div>
        <SectionTitle>Duty Breakdown</SectionTitle>
        <Table head={<>
          <Th>Name</Th>
          {filter === 'all' ? <>{dutyTypes.map(sortHeader)}{sortHeader('Total')}</> : sortHeader('Points')}
        </>}>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={filter === 'all' ? dutyTypes.length + 2 : 2} className="px-4 py-8 text-center text-sm text-ink-60">
                No personnel in this category
              </td>
            </tr>
          ) : sorted.map((s, i) => {
            const total = filterPoints[s.name] ?? 0
            const isMax = total === maxPts && sorted.length > 1 && total > 0
            const totalCell = <td className={`${TD} text-center font-bold ${isMax ? 'text-ink' : 'text-ink-80'}`}>{total}</td>
            return (
              <tr key={s.name} className={rowClass(i)}>
                <td className={`${TD} font-medium text-ink`}>{s.rank} {s.name}</td>
                {filter === 'all' ? (
                  <>
                    {dutyTypes.map(dt => {
                      const dtPoints = pointsByDutyType[s.name]?.[dt] ?? 0
                      return (
                        <td key={dt} className={`${TD} text-center ${dtPoints === 0 ? 'text-ink-48' : 'text-ink-80'}`}>
                          {dtPoints === 0 ? '—' : dtPoints}
                        </td>
                      )
                    })}
                    {totalCell}
                  </>
                ) : totalCell}
              </tr>
            )
          })}
        </Table>
      </div>
    </div>
  )
}
