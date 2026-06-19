'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import type { Soldier } from '@/lib/supabase'
import type { Company } from '@/lib/companies'

const OFFICER_PREFIXES = ['2LT', 'LTA', 'CPT', 'MAJ', 'LTC', 'SLTC', 'COL', 'BG', 'MG', 'LG', 'GEN', 'ME']
const WOSPEC_RANKS = ['3WO', '2WO', '1WO', 'MWO', 'SWO', 'CWO']

const RANKS_BY_TYPE = {
  Officer: ['2LT', 'LTA', 'CPT', 'MAJ', 'LTC', 'SLTC', 'COL', 'ME1', 'ME2', 'ME3', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8'],
  WOSPEC: ['3WO', '2WO', '1WO', 'MWO', 'SWO', 'CWO'],
  Enlistee: ['REC', 'PTE', 'LCP', 'CPL', 'CFC', '3SG', '2SG', '1SG', 'SSG', 'MSG'],
}

function getRankType(rank: string): 'Officer' | 'WOSPEC' | 'Enlistee' {
  if (OFFICER_PREFIXES.some((p) => rank.startsWith(p))) return 'Officer'
  if (WOSPEC_RANKS.includes(rank)) return 'WOSPEC'
  return 'Enlistee'
}

const SECTION_ORDER: ('Officer' | 'WOSPEC' | 'Enlistee')[] = ['Officer', 'WOSPEC', 'Enlistee']

export default function NominalRoll({ company }: { company: Company }) {
  const supabase = getSupabaseClient(company)

  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const PLATOONS = ['HQ', '1', '2', '3', '4'] as const

  const [form, setForm] = useState({ rank: 'PTE', name: '', platoon: '' })
  const [deletingName, setDeletingName] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [company])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('NominalRoll')
      .select('*')
      .order('platoon')
    if (error) setError(error.message)
    else setSoldiers(data ?? [])
    setLoading(false)
  }

  async function addSoldier() {
    if (!form.name.trim() || !form.platoon) return
    setSubmitting(true)
    const { error } = await supabase.from('NominalRoll').insert({
      rank: form.rank,
      name: form.name.trim().toUpperCase(),
      platoon: form.platoon,
    })
    if (error) {
      setError(error.message)
    } else {
      setForm({ rank: 'PTE', name: '', platoon: '' })
      setShowForm(false)
      await load()
    }
    setSubmitting(false)
  }

  async function deleteSoldier(name: string) {
    setDeletingName(name)
    await supabase.from('NominalRoll').delete().eq('name', name)
    await load()
    setDeletingName(null)
  }

  const grouped = SECTION_ORDER.reduce(
    (acc, type) => {
      acc[type] = soldiers.filter((s) => getRankType(s.rank) === type)
      return acc
    },
    {} as Record<string, Soldier[]>,
  )

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Nominal Roll</h2>
          <p className="text-sm text-gray-500">{soldiers.length} personnel</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Soldier'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-medium text-gray-700 text-sm">New Soldier</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rank</label>
              <select
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(RANKS_BY_TYPE).map(([type, ranks]) => (
                  <optgroup key={type} label={type}>
                    {ranks.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="TAN AH KOW"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                onKeyDown={(e) => e.key === 'Enter' && addSoldier()}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Platoon</label>
              <select
                value={form.platoon}
                onChange={(e) => setForm({ ...form, platoon: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select platoon</option>
                {PLATOONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={addSoldier}
            disabled={submitting || !form.name.trim() || !form.platoon}
            className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </div>
      )}

      {SECTION_ORDER.map((type) => {
        const group = grouped[type]
        if (group.length === 0) return null
        return (
          <div key={type}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              {type}s — {group.length}
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Rank</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Platoon</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {group.map((s, i) => (
                    <tr
                      key={s.name}
                      className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.rank}</td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500">{s.platoon}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteSoldier(s.name)}
                          disabled={deletingName === s.name}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xs disabled:opacity-50"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {soldiers.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No soldiers yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-green-600 text-sm hover:underline"
          >
            Add the first soldier
          </button>
        </div>
      )}
    </div>
  )
}
