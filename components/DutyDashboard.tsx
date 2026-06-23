'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getSupabaseClient, tbl } from '@/lib/supabase'
import type { Soldier, DutyEntry, Configuration } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES, PARADE_CONFIG, getRankType } from '@/lib/companies'
import { useAuth } from '@/lib/useAuth'
import CommanderLoginForm from './CommanderLoginForm'

const ALL_DUTY_TYPES = ['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4']

// ponytail: eligibility hardcoded per spec; rules change with policy, not data
const ELIGIBILITY: Record<string, (rank: string) => boolean> = {
  CDO:  r => getRankType(r) === 'Officer',
  CDS:  r => ['2SG','1SG','SSG','MSG','ME1','ME2','ME3','3WO','2WO','1WO','MWO','SWO','CWO'].includes(r),
  COS:  r => !['REC', 'PTE'].includes(r),
  PDS1: r => getRankType(r) === 'WOSPEC',
  PDS2: r => getRankType(r) === 'WOSPEC',
  PDS3: r => getRankType(r) === 'WOSPEC',
  PDS4: r => getRankType(r) === 'WOSPEC',
}

type RankFilter = 'all' | 'Officer' | 'WOSPEC' | 'Enlistee'

const FILTER_LABELS: [RankFilter, string][] = [
  ['all', 'All'],
  ['Officer', 'Officers'],
  ['WOSPEC', 'WOSPECs'],
  ['Enlistee', 'Troopers'],
]

const FILTER_DUTY_TYPES: Record<RankFilter, string[]> = {
  all:      ALL_DUTY_TYPES,
  Officer:  ['CDO', 'COS'],
  WOSPEC:   ['CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4'],
  Enlistee: ['COS'],
}

export default function DutyDashboard({ company, label }: { company: Company; label: string }) {
  const theme = COMPANY_THEMES[company]
  const { isCommander, loading: authLoading, signIn, signOut } = useAuth(company)

  // Use company's configured duty types; fall back to all 7
  const dutyTypes = PARADE_CONFIG[company].visibleDutyTypes.length > 0
    ? PARADE_CONFIG[company].visibleDutyTypes
    : ALL_DUTY_TYPES

  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [duties, setDuties] = useState<DutyEntry[]>([])
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RankFilter>('all')
  const [showWeights, setShowWeights] = useState(false)
  const [editWeights, setEditWeights] = useState<Record<string, string>>({})
  const [savingWeights, setSavingWeights] = useState(false)

  useEffect(() => { if (isCommander) load() }, [company, isCommander])

  async function load() {
    setLoading(true)
    const sb = getSupabaseClient(company)
    const [{ data: sol }, { data: dut }, { data: cfg }] = await Promise.all([
      sb.from(tbl(company, 'NominalRoll')).select('*'),
      sb.from(tbl(company, 'Duty')).select('*'),
      sb.from(tbl(company, 'Configuration')).select('*').like('parade_type', 'weight_%'),
    ])
    setSoldiers((sol ?? []) as unknown as Soldier[])
    setDuties((dut ?? []) as unknown as DutyEntry[])
    const w: Record<string, number> = {}
    for (const row of (cfg ?? []) as unknown as Configuration[]) {
      w[row.parade_type.replace('weight_', '')] = parseFloat(row.time) || 1
    }
    setWeights(w)
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

  const visible = useMemo(
    () => filter === 'all' ? soldiers : soldiers.filter(s => getRankType(s.rank) === filter),
    [soldiers, filter],
  )
  const sorted = useMemo(
    () => [...visible].sort((a, b) => (points[a.name] ?? 0) - (points[b.name] ?? 0)),
    [visible, points],
  )
  const maxPts = Math.max(sorted.length > 0 ? (points[sorted[sorted.length - 1].name] ?? 0) : 0, 1)

  const visibleDutyTypes = dutyTypes.filter(dt => FILTER_DUTY_TYPES[filter].includes(dt))

  function getSuggestion(dt: string) {
    return sorted.find(s => ELIGIBILITY[dt]?.(s.rank) && !backToBack.has(s.name)) ?? null
  }

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
        ) : loading ? (
          <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
        ) : (
          <div className="space-y-6">

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {FILTER_LABELS.map(([f, l]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f
                      ? `${theme.buttonBg} ${theme.buttonHoverBg} text-white`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Suggestions */}
            <div>
              <h3 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${theme.activeText}`}>
                Next Duty Suggestions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visibleDutyTypes.map(dt => {
                  const next = getSuggestion(dt)
                  return (
                    <div
                      key={dt}
                      className={`bg-white border border-gray-200 rounded-2xl p-4 shadow-sm border-l-4 ${next ? theme.activeBorder : 'border-l-gray-200'}`}
                    >
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{dt}</div>
                      {next ? (
                        <>
                          <div className="text-sm font-semibold text-gray-900 leading-tight">{next.rank} {next.name}</div>
                          <span className={`mt-1.5 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
                            {points[next.name] ?? 0} pts
                          </span>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 italic">No eligible personnel</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

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
                        <th className="text-right px-4 py-3 font-medium text-gray-500 w-16">Pts</th>
                        <th className="px-4 py-3 w-28" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                            No personnel in this category
                          </td>
                        </tr>
                      ) : sorted.map((s, i) => {
                        const pts = points[s.name] ?? 0
                        const pct = (pts / maxPts) * 100
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
                              {pts}
                            </td>
                            <td className="px-4 py-3">
                              <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${theme.buttonBg}`}
                                  style={{ width: `${Math.max(pct, 3)}%` }}
                                />
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
            </div>

            {/* Weight editor */}
            <div className="pb-2">
              <button
                onClick={() => {
                  if (!showWeights) setEditWeights(Object.fromEntries(dutyTypes.map(dt => [dt, String(weights[dt] ?? 1)])))
                  setShowWeights(v => !v)
                }}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
              >
                {showWeights ? '▾' : '▸'} Edit Duty Weights
              </button>
              {showWeights && (
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
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
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
