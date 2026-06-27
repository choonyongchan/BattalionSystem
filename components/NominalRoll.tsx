'use client'

import { useEffect, useState } from 'react'
import { supabase, tbl } from '@/lib/supabase'
import type { Soldier } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES, getRankType, RANKS_BY_TYPE, ALL_RANKS } from '@/lib/companies'
import { useConfirmDelete } from '@/lib/hooks'
import SearchDropdown from '@/components/SearchDropdown'
import BulkImportModal from '@/components/BulkImportModal'

function fieldInputClass(hasError: boolean, focusRing: string) {
  const base = 'border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 w-full'
  return hasError ? `${base} border-red-500 ring-2 ring-red-500` : `${base} border-gray-300 ${focusRing}`
}

const PLATOONS = ['HQ', '1', '2', '3', '4'] as const

const SECTION_ORDER = Object.keys(RANKS_BY_TYPE) as ('Officer' | 'WOSPEC' | 'Enlistee')[]
const RANK_ORDER = Object.fromEntries(Object.values(RANKS_BY_TYPE).flat().map((r, i) => [r, i]))

export default function NominalRoll({ company }: { company: Company }) {
  const theme = COMPANY_THEMES[company]

  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ rank: 'PTE', name: '', platoon: '' })
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const nameConfirm = useConfirmDelete<string>()

  const [editRow, setEditRow] = useState<{
    originalName: string
    rank: string
    name: string
    platoon: string
    four_d: string
  } | null>(null)
  const [editErrors, setEditErrors] = useState<Record<string, boolean>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteAllState, setDeleteAllState] = useState<'idle' | 'prompt' | 'deleting'>('idle')
  const [deleteAllPw, setDeleteAllPw] = useState('')
  const [deleteAllErr, setDeleteAllErr] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [company])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from(tbl(company, 'NominalRoll'))
      .select('*')
      .order('platoon')
    if (error) setError(error.message)
    else setSoldiers((data ?? []) as unknown as Soldier[])
    setLoading(false)
  }

  async function addSoldier() {
    if (!form.name.trim() || !form.platoon) return
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
    setDeletingName(name)
    await supabase.from(tbl(company, 'NominalRoll')).delete().eq('name', name)
    await load()
    setDeletingName(null)
  }

  async function deleteAll() {
    setDeleteAllState('deleting')
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: `${company}@40sar.internal`,
      password: deleteAllPw,
    })
    if (authErr) {
      setDeleteAllErr('Incorrect password')
      setDeleteAllState('prompt')
      return
    }
    const { error } = await supabase.from(tbl(company, 'NominalRoll')).delete().not('name', 'is', null)
    if (error) setError(error.message)
    else await load()
    setDeleteAllState('idle')
    setDeleteAllPw('')
    setDeleteAllErr(null)
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

  const sorted = [...filtered].sort((a, b) =>
    (a.four_d ?? '').localeCompare(b.four_d ?? '') ||
    (a.platoon ?? '').localeCompare(b.platoon ?? '') ||
    ((RANK_ORDER[b.rank] ?? 99) - (RANK_ORDER[a.rank] ?? 99)) ||
    a.name.localeCompare(b.name)
  )

  const grouped = SECTION_ORDER.reduce(
    (acc, type) => {
      acc[type] = sorted.filter((s) => getRankType(s.rank) === type)
      return acc
    },
    {} as Record<string, Soldier[]>,
  )

  const inputClass = `w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`

  const editClass = (field: string) => fieldInputClass(!!editErrors[field], theme.focusRing)

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
            onClick={() => { setDeleteAllState('prompt'); setDeleteAllPw(''); setDeleteAllErr(null) }}
            className="px-4 py-3 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors"
          >
            Delete All
          </button>
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

      {deleteAllState !== 'idle' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-red-700 font-medium">This will permanently delete all {soldiers.length} personnel. Enter your commander password to confirm.</p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Commander password"
              value={deleteAllPw}
              onChange={(e) => setDeleteAllPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') deleteAll(); if (e.key === 'Escape') setDeleteAllState('idle') }}
              autoFocus
              className="flex-1 border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <button
              onClick={deleteAll}
              disabled={deleteAllState === 'deleting' || !deleteAllPw}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            >
              {deleteAllState === 'deleting' ? '…' : 'Confirm'}
            </button>
            <button
              onClick={() => setDeleteAllState('idle')}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
          {deleteAllErr && <p className="text-xs text-red-600">{deleteAllErr}</p>}
        </div>
      )}

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
              <SearchDropdown
                items={ALL_RANKS}
                value={form.rank}
                getKey={r => r.rank}
                getLabel={r => r.rank}
                matches={(r, q) => r.rank.toLowerCase().startsWith(q.toLowerCase())}
                renderOption={r => (
                  <div className="flex gap-3 items-center">
                    <span className="font-mono font-medium text-gray-800 w-14 shrink-0">{r.rank}</span>
                    <span className="text-xs text-gray-400">{r.type}</span>
                  </div>
                )}
                onChange={rank => setForm({ ...form, rank })}
                inputClass={inputClass}
                placeholder="e.g. CPL, 3SG, LTA"
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
              {type}s – {group.length}
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
                                <SearchDropdown
                                  items={ALL_RANKS}
                                  value={editRow.rank}
                                  getKey={r => r.rank}
                                  getLabel={r => r.rank}
                                  matches={(r, q) => r.rank.toLowerCase().startsWith(q.toLowerCase())}
                                  renderOption={r => (
                                    <div className="flex gap-3 items-center">
                                      <span className="font-mono font-medium text-gray-800 w-14 shrink-0">{r.rank}</span>
                                      <span className="text-xs text-gray-400">{r.type}</span>
                                    </div>
                                  )}
                                  onChange={rank => setEditRow({ ...editRow, rank })}
                                  inputClass={editClass('rank')}
                                  placeholder="e.g. CPL, 3SG, LTA"
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
                                  className={editClass('name')}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <select
                                  value={editRow.platoon}
                                  onChange={(e) => setEditRow({ ...editRow, platoon: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') { setEditRow(null); setEditErrors({}) }
                                  }}
                                  className={editClass('platoon')}
                                >
                                  <option value="">–</option>
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
                                  placeholder="e.g. 1234"
                                  className={editClass('four_d')}
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
                              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.four_d ?? '–'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-end items-center">
                                  <button
                                    onClick={() => nameConfirm.isConfirming(s.name)
                                      ? nameConfirm.resolve(s.name, () => deleteSoldier(s.name))
                                      : (setEditRow({ originalName: s.name, rank: s.rank, name: s.name, platoon: s.platoon, four_d: s.four_d ?? '' }), setEditErrors({}))}
                                    disabled={deletingName === s.name}
                                    className={nameConfirm.isConfirming(s.name)
                                      ? 'px-3 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm'
                                      : 'text-gray-400 hover:text-gray-600 transition-colors text-xl p-3 disabled:opacity-50'}
                                    title={nameConfirm.isConfirming(s.name) ? 'Confirm delete' : 'Edit'}
                                  >
                                    {nameConfirm.isConfirming(s.name) ? 'Yes' : '✎'}
                                  </button>
                                  <button
                                    onClick={() => nameConfirm.isConfirming(s.name) ? nameConfirm.cancel() : nameConfirm.request(s.name)}
                                    disabled={deletingName === s.name}
                                    className={nameConfirm.isConfirming(s.name)
                                      ? 'px-3 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50'
                                      : 'text-gray-400 hover:text-red-500 transition-colors text-xl p-3 disabled:opacity-50'}
                                    title={nameConfirm.isConfirming(s.name) ? 'Cancel' : 'Remove'}
                                  >
                                    {nameConfirm.isConfirming(s.name) ? 'No' : '✕'}
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
