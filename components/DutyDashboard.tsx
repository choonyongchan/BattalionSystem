'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase, tbl } from '@/lib/supabase'
import type { Soldier, DutyEntry, Exception } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES, PARADE_CONFIG, ALL_DUTY_TYPES } from '@/lib/companies'
import { isEligible as checkEligible, isEligibleForGuardDuty } from '@/lib/duty-rules'
import { computePoints, computePointsByDutyType, getEligibleForDuty, sortByPoints } from '@/lib/duty-dashboard'
import { useAuth } from '@/lib/useAuth'
import { useSettingsQuery, usePublicHolidaysQuery } from '@/lib/settings'
import CommanderLoginForm from './CommanderLoginForm'

export default function DutyDashboard({ company, label, embedded }: { company: Company; label: string; embedded?: boolean }) {
  const theme = COMPANY_THEMES[company]
  const { isCommander, loading: authLoading, signIn, signOut } = useAuth(company)

  // Use company's configured duty types; fall back to all 7. Guard Duty is always appended —
  // it's tracked in Exceptions rather than the Duty table and isn't company-gated.
  const dutyTypes = [
    ...(PARADE_CONFIG[company].visibleDutyTypes.length > 0 ? PARADE_CONFIG[company].visibleDutyTypes : ALL_DUTY_TYPES),
    'Guard Duty',
  ]

  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [duties, setDuties] = useState<DutyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const { data: settings } = useSettingsQuery(company)
  const { data: publicHolidays } = usePublicHolidaysQuery()
  const eligibilityOverrides = settings?.eligibility_name_overrides ?? {}
  const rankRuleOverrides = settings?.eligibility_rank_overrides ?? {}
  const guardDutyRankOverrides = settings?.guard_duty_rank_overrides ?? {}
  const holidays = useMemo(() => new Set((publicHolidays ?? []).map(h => h.date)), [publicHolidays])

  useEffect(() => { if (isCommander || embedded) load() }, [company, isCommander, embedded])

  async function load() {
    setLoading(true)
    const sb = supabase
    const [{ data: sol }, { data: dut }, { data: gd }] = await Promise.all([
      sb.from(tbl(company, 'NominalRoll')).select('*'),
      sb.from(tbl(company, 'Duty')).select('*'),
      sb.from(tbl(company, 'Exceptions')).select('*').eq('scope', 'Guard Duty'),
    ])
    setSoldiers((sol ?? []) as unknown as Soldier[])
    const guardDutyEntries: DutyEntry[] = ((gd ?? []) as unknown as Exception[]).map((e) => ({
      duty_type: 'Guard Duty',
      date: e.end ?? e.start ?? '',
      name: e.name,
    }))
    setDuties([...(dut ?? []) as unknown as DutyEntry[], ...guardDutyEntries])
    setLoading(false)
  }

  // ponytail: O(n) scan — battalion data is small; upgrade to RPC if duties > 10k rows
  const weightSettings = useMemo(() => ({
    baseWeights: settings?.duty_base_weights ?? {},
    dayMultipliers: settings?.duty_day_multipliers ?? { MonThurs: 1, Friday: 1, Saturday: 1, Sunday: 1, PublicHoliday: 1 },
    exceptions: settings?.duty_weight_exceptions ?? {},
  }), [settings])
  const points = useMemo(() => computePoints(duties, weightSettings, holidays), [duties, weightSettings, holidays])
  const pointsByDutyType = useMemo(
    () => computePointsByDutyType(duties, weightSettings, holidays),
    [duties, weightSettings, holidays],
  )
  const filterPoints = useMemo(
    () => filter === 'all' ? points : computePoints(duties, weightSettings, holidays, filter),
    [filter, points, duties, weightSettings, holidays],
  )

  const today = new Date().toISOString().slice(0, 10)
  const backToBack = useMemo(
    () => new Set(duties.filter(d => d.date === today).map(d => d.name)),
    [duties, today],
  )

  const eligibleForDuty = useMemo(
    () => getEligibleForDuty(dutyTypes, soldiers, eligibilityOverrides, rankRuleOverrides, guardDutyRankOverrides),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [soldiers, eligibilityOverrides, rankRuleOverrides, guardDutyRankOverrides],
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
    const s = sortByPoints(visible, filterPoints)
    return filter === 'all' ? s.reverse() : s
  }, [visible, filterPoints, filter])
  const maxPts = Math.max(...sorted.map(s => filterPoints[s.name] ?? 0), 1)

  const dashboardContent = loading ? (
    <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
  ) : (
    <div className="space-y-6">

            {/* Filter pills — duty-weight editing now lives on the Settings page */}
            <div className="flex gap-2 flex-wrap">
              {['all', ...dutyTypes].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f
                      ? `${theme.buttonBg} ${theme.buttonHoverBg} text-white`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>

            {/* Breakdown */}
            <div>
              <h3 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${theme.activeText}`}>
                Duty Breakdown
              </h3>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                        {filter === 'all' ? (
                          <>
                            {dutyTypes.map(dt => (
                              <th key={dt} className="text-center px-3 py-3 font-medium text-gray-500 w-14">{dt}</th>
                            ))}
                            <th className="text-center px-3 py-3 font-medium text-gray-500 w-14">Total</th>
                          </>
                        ) : (
                          <th className="text-center px-3 py-3 font-medium text-gray-500 w-20">Points</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.length === 0 ? (
                        <tr>
                          <td colSpan={filter === 'all' ? dutyTypes.length + 2 : 2} className="px-4 py-8 text-center text-sm text-gray-400">
                            No personnel in this category
                          </td>
                        </tr>
                      ) : sorted.map((s, i) => {
                        const total = filterPoints[s.name] ?? 0
                        const isMax = total === maxPts && sorted.length > 1 && total > 0
                        return (
                          <tr key={s.name} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.rank} {s.name}</td>
                            {filter === 'all' ? (
                              <>
                                {dutyTypes.map(dt => {
                                  const dtPoints = pointsByDutyType[s.name]?.[dt] ?? 0
                                  return (
                                    <td key={dt} className={`px-3 py-3 text-center ${dtPoints === 0 ? 'text-gray-200' : 'text-gray-700'}`}>
                                      {dtPoints === 0 ? '—' : dtPoints}
                                    </td>
                                  )
                                })}
                                <td className={`px-3 py-3 text-center font-bold ${isMax ? 'text-red-500' : 'text-gray-700'}`}>
                                  {total}
                                </td>
                              </>
                            ) : (
                              <td className={`px-3 py-3 text-center font-bold ${isMax ? 'text-red-500' : 'text-gray-700'}`}>
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

  if (embedded) return dashboardContent

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <nav className="sticky top-0 z-20 bg-amber-100 px-4 py-3 flex items-center gap-3 shadow-sm relative overflow-hidden">
        <div className="absolute inset-y-0 left-[34%] w-[7%] min-w-7 bg-red-300/50 pointer-events-none" />
        <div className="absolute inset-y-0 left-[42%] w-[16%] min-w-16 bg-red-300/50 pointer-events-none" />
        <div className="absolute inset-y-0 left-[59%] w-[7%] min-w-7 bg-red-300/50 pointer-events-none" />
        <Link href={`/${company}`} className="text-yellow-800 hover:text-yellow-600 text-sm font-medium transition-colors relative z-10">
          ← {label} Coy
        </Link>
        <span className="text-yellow-500 relative z-10">|</span>
        <h1 className="font-bold text-sm tracking-wide text-yellow-900 relative z-10">Dashboard</h1>
        {/* NOTE: this nav header is duplicated between DutyDashboard.tsx and CompanyContent.tsx —
            known follow-up, not addressed here. */}
        {!authLoading && isCommander && (
          <div className="ml-auto flex items-center gap-3 relative z-10">
            <Link href={`/${company}/settings`} title="Settings" className="text-yellow-700 hover:text-yellow-900 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <button onClick={signOut} className="text-xs text-yellow-700 hover:text-yellow-900 font-medium transition-colors">
              Sign Out
            </button>
          </div>
        )}
      </nav>

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {authLoading ? (
          <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
        ) : !isCommander ? (
          <CommanderLoginForm companyLabel={label} onSignIn={signIn} />
        ) : dashboardContent}
      </div>
    </div>
  )
}
