'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getSupabaseClient, tbl } from '@/lib/supabase'
import type { Soldier, DutyEntry, Configuration } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES, PARADE_CONFIG, DUTY_ELIGIBILITY } from '@/lib/companies'
import { useAuth } from '@/lib/useAuth'
import CommanderLoginForm from './CommanderLoginForm'

const ALL_DUTY_TYPES = ['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4']

export default function DutyDashboard({ company, label, embedded }: { company: Company; label: string; embedded?: boolean }) {
  const theme = COMPANY_THEMES[company]
  const { isCommander, loading: authLoading, signIn, signOut } = useAuth(company)

  // Use company's configured duty types; fall back to all 7
  const dutyTypes = PARADE_CONFIG[company].visibleDutyTypes.length > 0
    ? PARADE_CONFIG[company].visibleDutyTypes
    : ALL_DUTY_TYPES

  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [duties, setDuties] = useState<DutyEntry[]>([])
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [eligibilityOverrides, setEligibilityOverrides] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'total' | 'cos'>('total')
  const [showWeights, setShowWeights] = useState(false)
  const [editWeights, setEditWeights] = useState<Record<string, string>>({})
  const [savingWeights, setSavingWeights] = useState(false)

  useEffect(() => { if (isCommander || embedded) load() }, [company, isCommander, embedded])

  async function load() {
    setLoading(true)
    const sb = getSupabaseClient(company)
    const [{ data: sol }, { data: dut }, { data: cfg }, { data: elig }] = await Promise.all([
      sb.from(tbl(company, 'NominalRoll')).select('*'),
      sb.from(tbl(company, 'Duty')).select('*'),
      sb.from(tbl(company, 'Configuration')).select('*').like('parade_type', 'weight_%'),
      sb.from(tbl(company, 'Configuration')).select('*').like('parade_type', 'eligible_%'),
    ])
    setSoldiers((sol ?? []) as unknown as Soldier[])
    setDuties((dut ?? []) as unknown as DutyEntry[])
    const w: Record<string, number> = {}
    for (const row of (cfg ?? []) as unknown as Configuration[]) {
      w[row.parade_type.replace('weight_', '')] = parseFloat(row.time) || 1
    }
    setWeights(w)
    const ov: Record<string, string[]> = {}
    for (const row of (elig ?? []) as unknown as Configuration[]) {
      try { ov[row.parade_type.replace('eligible_', '')] = JSON.parse(row.time) } catch {}
    }
    setEligibilityOverrides(ov)
    setLoading(false)
  }

  // ponytail: O(n) scan — battalion data is small; upgrade to RPC if duties > 10k rows
  const points = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const d of duties) acc[d.name] = (acc[d.name] ?? 0) + (weights[d.duty_type] ?? 1)
    return acc
  }, [duties, weights])

  const dutyCounts = useMemo(() => {
    const acc: Record<string, Record<string, number>> = {}
    for (const d of duties) {
      acc[d.name] ??= {}
      acc[d.name][d.duty_type] = (acc[d.name][d.duty_type] ?? 0) + 1
    }
    return acc
  }, [duties])

  const today = new Date().toISOString().slice(0, 10)
  const backToBack = useMemo(
    () => new Set(duties.filter(d => d.date === today).map(d => d.name)),
    [duties, today],
  )

  function isEligible(dt: string, s: Soldier) {
    const ov = eligibilityOverrides[dt]
    if (ov && ov.length > 0) return ov.includes(s.name)
    return DUTY_ELIGIBILITY[dt]?.(s.rank) ?? false
  }

  const visible = useMemo(
    () => filter === 'all' ? soldiers : soldiers.filter(s => isEligible(filter, s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [soldiers, filter, eligibilityOverrides],
  )

  const cosPoints = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const d of duties) {
      if (d.duty_type === 'COS') acc[d.name] = (acc[d.name] ?? 0) + (weights['COS'] ?? 1)
    }
    return acc
  }, [duties, weights])

  const sorted = useMemo(
    () => [...visible].sort((a, b) => {
      const va = sortBy === 'cos' ? (cosPoints[a.name] ?? 0) : (points[a.name] ?? 0)
      const vb = sortBy === 'cos' ? (cosPoints[b.name] ?? 0) : (points[b.name] ?? 0)
      return va - vb
    }),
    [visible, points, cosPoints, sortBy],
  )
  const maxPts = Math.max(...sorted.map(s => points[s.name] ?? 0), 1)

  async function saveWeights() {
    setSavingWeights(true)
    const sb = getSupabaseClient(company)
    const rows = dutyTypes.map(dt => ({
      parade_type: `weight_${dt}`,
      time: String(parseFloat(editWeights[dt] ?? '1') || 1),
    }))
    await sb.from(tbl(company, 'Configuration')).upsert(rows, { onConflict: 'parade_type' } as any)
    const newW: Record<string, number> = {}
    for (const dt of dutyTypes) newW[dt] = parseFloat(editWeights[dt] ?? '1') || 1
    setWeights(newW)
    setSavingWeights(false)
    setShowWeights(false)
  }


  const dashboardContent = loading ? (
    <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
  ) : (
    <div className="space-y-6">

            {/* Filter pills + settings gear */}
            <div className="flex items-center gap-2">
              <div className="flex gap-2 flex-wrap flex-1">
                {['all', ...dutyTypes].map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); if (f !== 'COS') setSortBy('total') }}
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
              <button
                onClick={() => {
                  if (!showWeights) setEditWeights(Object.fromEntries(dutyTypes.map(dt => [dt, String(weights[dt] ?? 1)])))
                  setShowWeights(v => !v)
                }}
                title="Edit Duty Weights"
                className={`shrink-0 p-2 rounded-xl transition-colors ${showWeights ? `${theme.buttonBg} text-white` : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {/* Weights panel — appears inline below filter row */}
            {showWeights && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs text-gray-500">Points awarded per duty type.</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {dutyTypes.map(dt => (
                    <div key={dt}>
                      <label className="block text-xs text-gray-500 mb-1">{dt}</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={editWeights[dt] ?? '1'}
                        onChange={e => setEditWeights(w => ({ ...w, [dt]: e.target.value }))}
                        className={`w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={saveWeights}
                  disabled={savingWeights}
                  className={`px-4 py-2 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors`}
                >
                  {savingWeights ? 'Saving…' : 'Save Weights'}
                </button>
              </div>
            )}

            {/* Leaderboard */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-semibold uppercase tracking-widest ${theme.activeText}`}>
                  Point Leaderboard
                </h3>
                <span className="text-xs text-gray-400">{sorted.length} personnel</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 w-10">#</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 w-16">Rank</th>
                        <th className="text-right px-4 py-3 w-20">
                          <button
                            onClick={() => setSortBy('total')}
                            className={`font-medium underline-offset-2 transition-colors ${sortBy === 'total' ? `${theme.activeText} underline` : 'text-gray-500 hover:text-gray-700 hover:underline'}`}
                          >
                            Total Pts {sortBy === 'total' ? '↑' : ''}
                          </button>
                        </th>
                        {filter === 'COS' && (
                          <th className="text-right px-4 py-3 w-20">
                            <button
                              onClick={() => setSortBy('cos')}
                              className={`font-medium underline-offset-2 transition-colors ${sortBy === 'cos' ? `${theme.activeText} underline` : 'text-gray-500 hover:text-gray-700 hover:underline'}`}
                            >
                              COS Pts {sortBy === 'cos' ? '↑' : ''}
                            </button>
                          </th>
                        )}
                        <th className="px-4 py-3 w-28" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.length === 0 ? (
                        <tr>
                          <td colSpan={filter === 'COS' ? 6 : 5} className="px-4 py-8 text-center text-sm text-gray-400">
                            No personnel in this category
                          </td>
                        </tr>
                      ) : sorted.map((s, i) => {
                        const totalPts = points[s.name] ?? 0
                        const cosPts = cosPoints[s.name] ?? 0
                        const nonCosPts = totalPts - cosPts
                        const nonCosPct = (nonCosPts / maxPts) * 100
                        const cosPct = (cosPts / maxPts) * 100
                        const isTop = i === 0
                        const isBot = i === sorted.length - 1 && sorted.length > 1
                        return (
                          <tr
                            key={s.name}
                            className={`border-b border-gray-100 last:border-0 ${
                              isTop ? theme.badgeBg : isBot ? 'bg-red-50' : i % 2 === 1 ? 'bg-gray-50/50' : ''
                            }`}
                          >
                            <td className={`px-4 py-3 font-bold text-xs ${isTop ? theme.badgeText : isBot ? 'text-red-400' : 'text-gray-300'}`}>
                              {i + 1}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.rank}</td>
                            <td className={`px-4 py-3 text-right font-bold ${isTop ? theme.badgeText : isBot ? 'text-red-500' : 'text-gray-700'}`}>
                              {totalPts}
                            </td>
                            {filter === 'COS' && (
                              <td className="px-4 py-3 text-right text-gray-500 text-sm">
                                {cosPts > 0 ? cosPts : <span className="text-gray-200">—</span>}
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden flex">
                                <div className={`h-1.5 ${theme.buttonBg}`} style={{ width: `${nonCosPct}%` }} />
                                <div className="h-1.5 bg-gray-400" style={{ width: `${cosPct}%` }} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Breakdown — hidden when a specific duty type is selected */}
            {filter === 'all' && <div>
              <h3 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${theme.activeText}`}>
                Duty Breakdown
              </h3>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                        {dutyTypes.map(dt => (
                          <th key={dt} className="text-center px-3 py-3 font-medium text-gray-500 w-14">{dt}</th>
                        ))}
                        <th className="text-center px-3 py-3 font-medium text-gray-500 w-14">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.length === 0 ? (
                        <tr>
                          <td colSpan={dutyTypes.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">
                            No personnel in this category
                          </td>
                        </tr>
                      ) : sorted.map((s, i) => {
                        const total = points[s.name] ?? 0
                        const isMax = total === maxPts && sorted.length > 1 && total > 0
                        return (
                          <tr key={s.name} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.rank} {s.name}</td>
                            {dutyTypes.map(dt => {
                              const count = dutyCounts[s.name]?.[dt] ?? 0
                              return (
                                <td key={dt} className={`px-3 py-3 text-center ${count === 0 ? 'text-gray-200' : 'text-gray-700'}`}>
                                  {count === 0 ? '—' : count}
                                </td>
                              )
                            })}
                            <td className={`px-3 py-3 text-center font-bold ${isMax ? 'text-red-500' : 'text-gray-700'}`}>
                              {total}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>}


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
        {!authLoading && isCommander && (
          <div className="ml-auto relative z-10">
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
