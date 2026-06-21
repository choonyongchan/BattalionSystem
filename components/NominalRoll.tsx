'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseClient, tbl } from '@/lib/supabase'
import type { Soldier } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES } from '@/lib/companies'
import BulkImportModal from '@/components/BulkImportModal'

function RankSearch({
  value,
  onChange,
  inputClass,
}: {
  value: string
  onChange: (rank: string) => void
  inputClass: string
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? ALL_RANKS.filter((r) => r.rank.toLowerCase().startsWith(query.toLowerCase()))
    : ALL_RANKS

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(rank: string) {
    onChange(rank)
    setQuery(rank)
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange('')
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder="e.g. CPL, 3SG, LTA"
        className={inputClass}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {filtered.map((r) => (
            <li key={r.rank}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(r.rank) }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex gap-3 items-center"
              >
                <span className="font-mono font-medium text-gray-800 w-14 shrink-0">{r.rank}</span>
                <span className="text-xs text-gray-400">{r.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const RANKS_BY_TYPE = {
  Officer: ['2LT', 'LTA', 'CPT', 'CPT(DR)', 'MAJ', 'LTC', 'SLTC', 'COL', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8'],
  WOSPEC: ['3WO', '2WO', '1WO', 'MWO', 'SWO', 'CWO', 'ME1', 'ME2', 'ME3'],
  Enlistee: ['REC', 'PTE', 'LCP', 'CPL', 'CFC', '3SG', '2SG', '1SG', 'SSG', 'MSG'],
}

function getRankType(rank: string): 'Officer' | 'WOSPEC' | 'Enlistee' {
  if (RANKS_BY_TYPE.Officer.some((p) => rank.startsWith(p))) return 'Officer'
  if (RANKS_BY_TYPE.WOSPEC.includes(rank)) return 'WOSPEC'
  return 'Enlistee'
}

const SECTION_ORDER = Object.keys(RANKS_BY_TYPE) as ('Officer' | 'WOSPEC' | 'Enlistee')[]

const ALL_RANKS = Object.entries(RANKS_BY_TYPE).flatMap(([type, ranks]) =>
  ranks.map((rank) => ({ rank, type })),
)

export default function NominalRoll({ company }: { company: Company }) {
  const theme = COMPANY_THEMES[company]

  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const PLATOONS = ['HQ', '1', '2', '3', '4'] as const

  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ rank: 'PTE', name: '', platoon: '' })
  const [deletingName, setDeletingName] = useState<string | null>(null)

  const [editRow, setEditRow] = useState<{
    originalName: string
    rank: string
    name: string
    platoon: string
    four_d: string
  } | null>(null)
  const [editErrors, setEditErrors] = useState<Record<string, boolean>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    load()
  }, [company])

  async function load() {
    const supabase = getSupabaseClient(company)
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from(tbl(company, 'NominalRoll'))
      .select('*')
      .order('platoon')
    if (error) setError(error.message)
    else setSoldiers(data ?? [])
    setLoading(false)
  }

  async function addSoldier() {
    if (!form.name.trim() || !form.platoon) return
    const supabase = getSupabaseClient(company)
    setSubmitting(true)
    const { error } = await supabase.from(tbl(company, 'NominalRoll')).insert({
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
    const supabase = getSupabaseClient(company)
    setDeletingName(name)
    await supabase.from(tbl(company, 'NominalRoll')).delete().eq('name', name)
    await load()
    setDeletingName(null)
  }

  function validateEdit() {
    if (!editRow) return false
    const errors: Record<string, boolean> = {}
    if (!editRow.name.trim()) errors.name = true
    if (!editRow.platoon) errors.platoon = true
    if (!ALL_RANKS.some((r) => r.rank === editRow.rank)) errors.rank = true
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function updateSoldier() {
    if (!editRow || !validateEdit()) return
    const supabase = getSupabaseClient(company)
    setSavingEdit(true)
    const { error } = await supabase
      .from(tbl(company, 'NominalRoll'))
      .update({
        rank: editRow.rank,
        name: editRow.name.trim().toUpperCase(),
        platoon: editRow.platoon,
        four_d: editRow.four_d.trim() || null,
      })
      .eq('name', editRow.originalName)
    if (error) {
      setError(error.message)
    } else {
      setEditRow(null)
      setEditErrors({})
      await load()
    }
    setSavingEdit(false)
  }

  const query = search.toLowerCase()
  const filtered = query
    ? soldiers.filter((s) =>
        [s.rank, s.name, s.platoon, s.four_d].some((v) => v?.toLowerCase().includes(query))
      )
    : soldiers

  const grouped = SECTION_ORDER.reduce(
    (acc, type) => {
      acc[type] = filtered.filter((s) => getRankType(s.rank) === type)
      return acc
    },
    {} as Record<string, Soldier[]>,
  )

  const inputClass = `w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`

  function editInputClass(field: string) {
    const base = 'border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 w-full'
    return editErrors[field]
      ? `${base} border-red-500 ring-2 ring-red-500`
      : `${base} border-gray-300 ${theme.focusRing}`
  }

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Nominal Roll</h2>
          <p className="text-xs text-gray-500">{soldiers.length} personnel</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors"
          >
            Bulk Import
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`px-4 py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors`}
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <input
          type="search"
          placeholder="Search by rank, name, platoon…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rank</label>
              <RankSearch
                value={form.rank}
                onChange={(rank) => setForm({ ...form, rank })}
                inputClass={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="TAN AH KOW"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                onKeyDown={(e) => e.key === 'Enter' && addSoldier()}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Platoon</label>
              <select
                value={form.platoon}
                onChange={(e) => setForm({ ...form, platoon: e.target.value })}
                className={inputClass}
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
            className={`w-full py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            {submitting ? 'Adding...' : 'Add Soldier'}
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
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Rank</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Platoon</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">4D</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((s, i) => {
                      const isEditing = editRow?.originalName === s.name
                      return (
                        <tr
                          key={s.name}
                          className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30' : ''}`}
                        >
                          {isEditing ? (
                            <>
                              <td className="px-2 py-2">
                                <RankSearch
                                  value={editRow.rank}
                                  onChange={(rank) => setEditRow({ ...editRow, rank })}
                                  inputClass={editInputClass('rank')}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editRow.name}
                                  onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateSoldier()
                                    if (e.key === 'Escape') { setEditRow(null); setEditErrors({}) }
                                  }}
                                  className={editInputClass('name')}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <select
                                  value={editRow.platoon}
                                  onChange={(e) => setEditRow({ ...editRow, platoon: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') { setEditRow(null); setEditErrors({}) }
                                  }}
                                  className={editInputClass('platoon')}
                                >
                                  <option value="">—</option>
                                  {PLATOONS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={editRow.four_d}
                                  onChange={(e) => setEditRow({ ...editRow, four_d: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateSoldier()
                                    if (e.key === 'Escape') { setEditRow(null); setEditErrors({}) }
                                  }}
                                  placeholder="e.g. 1234A"
                                  className={editInputClass('four_d')}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex gap-1 justify-end">
                                  <button
                                    onClick={updateSoldier}
                                    disabled={savingEdit}
                                    className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50`}
                                  >
                                    {savingEdit ? '…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => { setEditRow(null); setEditErrors({}) }}
                                    className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.rank}</td>
                              <td className="px-4 py-3 font-medium">{s.name}</td>
                              <td className="px-4 py-3 text-gray-500">{s.platoon}</td>
                              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.four_d ?? '—'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-end items-center">
                                  <button
                                    onClick={() => {
                                      setEditRow({ originalName: s.name, rank: s.rank, name: s.name, platoon: s.platoon, four_d: s.four_d ?? '' })
                                      setEditErrors({})
                                    }}
                                    className="text-gray-300 hover:text-gray-600 transition-colors text-sm p-1 opacity-0 group-hover:opacity-100"
                                    title="Edit"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    onClick={() => deleteSoldier(s.name)}
                                    disabled={deletingName === s.name}
                                    className="text-gray-300 hover:text-red-500 transition-colors text-xs disabled:opacity-50 p-1 opacity-0 group-hover:opacity-100"
                                    title="Remove"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })}

      {soldiers.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No soldiers yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className={`mt-3 text-sm ${theme.activeText} hover:underline`}
          >
            Add the first soldier
          </button>
        </div>
      )}

      {showImport && (
        <BulkImportModal
          company={company}
          soldiers={soldiers}
          onClose={() => setShowImport(false)}
          onImported={async () => { await load(); setShowImport(false) }}
        />
      )}
    </div>
  )
}
