'use client'

import { useState, type KeyboardEvent } from 'react'
import type { Company } from '@/shared/companies'
import type { Exception, Soldier } from '@/shared/types'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import type { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { isOnStrength } from '@/backend/domain/exceptions/active'
import { validateEdit, type EditRow } from '@/backend/domain/nominal-roll/nominal-roll-validation'
import { groupByRankType, RANK_SECTIONS, sortSoldiers, type SoldierSortKey, type SortDir } from '@/backend/domain/nominal-roll/roster'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import { fieldInputClass } from '@/frontend/components/shared/styles'
import RankDropdown from './RankDropdown'
import { THEME } from '@/frontend/theme'

const COLUMNS: { key: SoldierSortKey; label: string }[] = [
  { key: 'four_d', label: '4D' },
  { key: 'platoon', label: 'Platoon' },
  { key: 'rank', label: 'Rank' },
  { key: 'name', label: 'Name' },
]

/** Left border at a glance: out of strength today, on an exception but present, or clear. */
function whereaboutsBorder(active: Exception[]): string {
  if (active.some((e) => e.counts_as_absence)) return 'border-l-4 border-l-red-400'
  if (active.length) return 'border-l-4 border-l-amber-400'
  return 'border-l-4 border-l-green-400'
}

/**
 * One sortable table per rank type (Officer / WOSPEC / Enlistee) with inline edit,
 * confirm-to-delete, and a click-through to the soldier's sheet.
 */
export default function SoldierTables({ company, platoons, soldiers, repo, activeFor, onOpen, onChanged, onError }: {
  company: Company
  platoons: string[]
  soldiers: Soldier[]
  repo: SoldierRepository
  activeFor: (s: Soldier) => Exception[]
  onOpen: (s: Soldier) => void
  onChanged: () => Promise<void>
  onError: (message: string) => void
}) {
  const [sortKey, setSortKey] = useState<SoldierSortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [edit, setEdit] = useState<EditRow | null>(null)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const confirm = useConfirmDelete<string>()

  const grouped = groupByRankType(sortSoldiers(soldiers, sortKey, sortDir))
  /** Inline-edit input class for a field, red when invalid. */
  const editClass = (field: string) => fieldInputClass(!!errors[field], THEME.focusRing, 'min-w-[6rem]')

  /** Cycles a column's sort: ascending, descending, then default order. */
  function toggleSort(key: SoldierSortKey) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortKey(null); setSortDir('asc') }
  }

  /** Leaves edit mode and clears errors. */
  function cancel() {
    setEdit(null)
    setErrors({})
  }

  /** Validates and saves the edited soldier, renaming their exceptions too. */
  async function save() {
    const errs = validateEdit(edit)
    setErrors(errs)
    if (!edit || Object.keys(errs).length > 0) return
    setSaving(true)
    const newName = edit.name.trim().toUpperCase()
    let { error } = await repo.update(edit.originalName, {
      rank: edit.rank,
      name: newName,
      platoon: edit.platoon,
      four_d: edit.four_d.trim() || null,
    })
    // Exceptions are linked by soldier_id now, but they also carry the name as text —
    // keep it in step so every screen (and rows written before the link) reads the new name
    if (!error && newName !== edit.originalName) {
      ;({ error } = await new ExceptionRepository(company).rename(edit.originalName, newName))
    }
    if (error) onError(error.message)
    else {
      cancel()
      await onChanged()
    }
    setSaving(false)
  }

  /** Deletes a soldier and reloads. */
  async function remove(name: string) {
    setDeletingName(name)
    await repo.remove(name)
    await onChanged()
    setDeletingName(null)
  }

  /** Enter saves, Escape cancels the inline edit. */
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') cancel()
  }

  return (
    <>
      {RANK_SECTIONS.map((type) => {
        const group = grouped[type]
        if (group.length === 0) return null
        return (
          <div key={type}>
            <h3 className="text-sm font-semibold text-ink mb-1">{type}s – {group.length}</h3>
            <div className="bg-white border border-hairline rounded-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-parchment border-b border-hairline">
                      {COLUMNS.map((c) => (
                        <th key={c.key} className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap"
                          aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                          <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-ink-80 transition-colors">
                            {c.label}
                            {sortKey === c.key && <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                          </button>
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((s, i) => {
                      const isEditing = edit?.originalName === s.name
                      const confirming = confirm.isConfirming(s.name)
                      return (
                        <tr key={s.name} className={`border-b border-hairline last:border-0 group ${i % 2 === 0 ? '' : 'bg-parchment/50'} ${isEditing ? 'bg-action/5' : ''}`}>
                          {isEditing && edit ? (
                            <>
                              <td className="px-2 py-1">
                                <input type="text" autoFocus value={edit.four_d} onChange={(e) => setEdit({ ...edit, four_d: e.target.value })} onKeyDown={keys} placeholder="e.g. 1234" className={editClass('four_d')} />
                              </td>
                              <td className="px-2 py-1">
                                <select value={edit.platoon} onChange={(e) => setEdit({ ...edit, platoon: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && cancel()} className={editClass('platoon')}>
                                  <option value="">–</option>
                                  {platoons.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1">
                                <RankDropdown value={edit.rank} onChange={(rank) => setEdit({ ...edit, rank })} inputClass={editClass('rank')} />
                              </td>
                              <td className="px-2 py-1">
                                <input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={keys} className={editClass('name')} />
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex gap-1 justify-end">
                                  <button onClick={save} disabled={saving} className={`px-2 py-1 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50`}>
                                    {saving ? '…' : 'Save'}
                                  </button>
                                  <button onClick={cancel} className="px-2 py-1 border border-hairline text-ink-80 text-xs rounded-lg hover:bg-parchment">Cancel</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className={`px-3 py-1.5 whitespace-nowrap text-ink-60 font-mono text-xs ${whereaboutsBorder(activeFor(s))}`}>{s.four_d ?? '–'}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-ink-60">{s.platoon}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs text-ink-80">{s.rank}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap font-medium">
                                <button onClick={() => onOpen(s)} className="text-left hover:underline">{s.name}</button>
                                {!isOnStrength(s) && <span className="ml-2 text-xs text-danger">posted out</span>}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <div className="flex gap-1 justify-end items-center">
                                  <button
                                    onClick={() => confirming
                                      ? confirm.resolve(() => remove(s.name))
                                      : (setEdit({ originalName: s.name, rank: s.rank, name: s.name, platoon: s.platoon, four_d: s.four_d ?? '' }), setErrors({}))}
                                    disabled={deletingName === s.name}
                                    className={confirming
                                      ? 'px-2 py-1 bg-danger hover:bg-danger active:bg-danger text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50'
                                      : 'text-ink-60 hover:text-ink-80 transition-colors text-base px-2 py-1 disabled:opacity-50'}
                                    title={confirming ? 'Confirm delete' : 'Edit'}
                                  >
                                    {confirming ? 'Yes' : '✎'}
                                  </button>
                                  <button
                                    onClick={() => confirming ? confirm.cancel() : confirm.request(s.name)}
                                    disabled={deletingName === s.name}
                                    className={confirming
                                      ? 'px-2 py-1 bg-parchment hover:bg-hairline active:bg-hairline text-ink-80 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50'
                                      : 'text-ink-60 hover:text-danger transition-colors text-base px-2 py-1 disabled:opacity-50'}
                                    title={confirming ? 'Cancel' : 'Remove'}
                                  >
                                    {confirming ? 'No' : '✕'}
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
    </>
  )
}
