'use client'

import { useState, type KeyboardEvent } from 'react'
import type { Company } from '@/shared/companies'
import type { Exception, Soldier } from '@/shared/types'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import type { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { isOnStrength } from '@/backend/domain/exceptions/active'
import { bunkOf } from '@/backend/domain/overview/bunks'
import { validateEdit, type EditRow } from '@/backend/domain/nominal-roll/nominal-roll-validation'
import { groupByRankType, RANK_SECTIONS, sortSoldiers, type SoldierSortKey, type SortDir } from '@/backend/domain/nominal-roll/roster'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import { inputClass } from '@/frontend/components/ui/fields'
import { SectionTitle } from '@/frontend/components/ui/layout'
import { EditActions, RowActions, SortTh, TD, TD_EDIT, Table, Th, rowClass } from '@/frontend/components/ui/table'
import RankDropdown from './RankDropdown'

const COLUMNS: { key: SoldierSortKey; label: string }[] = [
  { key: 'four_d', label: '4D' },
  { key: 'platoon', label: 'Platoon' },
  { key: 'rank', label: 'Rank' },
  { key: 'name', label: 'Name' },
]

/** Left border at a glance: out of strength today, on an exception but present, or clear. */
function whereaboutsBorder(active: Exception[]): string {
  if (active.some((e) => e.counts_as_absence)) return 'border-l-4 border-l-danger/60'
  if (active.length) return 'border-l-4 border-l-warning/60'
  return 'border-l-4 border-l-success/60'
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
  const editClass = (field: string) => inputClass({ compact: true, error: errors[field] })

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
      bunk: edit.bunk?.trim().toUpperCase() || null,
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
            <SectionTitle className="mb-1">{type}s – {group.length}</SectionTitle>
            <Table head={<>
              {COLUMNS.map((c) => (
                <SortTh key={c.key} label={c.label} dir={sortKey === c.key ? sortDir : null} onSort={() => toggleSort(c.key)} />
              ))}
              <Th>Bunk</Th>
              <th />
            </>}>
              {group.map((s, i) => {
                const isEditing = edit?.originalName === s.name
                return (
                  <tr key={s.name} className={rowClass(i, isEditing)}>
                    {isEditing && edit ? (
                      <>
                        <td className={TD_EDIT}>
                          <input type="text" autoFocus value={edit.four_d} onChange={(e) => setEdit({ ...edit, four_d: e.target.value })} onKeyDown={keys} placeholder="e.g. 1234" className={editClass('four_d')} />
                        </td>
                        <td className={TD_EDIT}>
                          <select value={edit.platoon} onChange={(e) => setEdit({ ...edit, platoon: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && cancel()} className={editClass('platoon')}>
                            <option value="">–</option>
                            {platoons.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className={TD_EDIT}>
                          <RankDropdown value={edit.rank} onChange={(rank) => setEdit({ ...edit, rank })} inputClass={editClass('rank')} />
                        </td>
                        <td className={TD_EDIT}>
                          <input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={keys} className={editClass('name')} />
                        </td>
                        <td className={TD_EDIT}>
                          <input type="text" aria-label="Bunk" value={edit.bunk ?? ''} onChange={(e) => setEdit({ ...edit, bunk: e.target.value })} onKeyDown={keys} placeholder={bunkOf({ ...s, bunk: null }) ?? 'e.g. ASA + MEDIC BUNK'} className={editClass('bunk')} />
                        </td>
                        <td className={TD_EDIT}>
                          <EditActions onSave={save} onCancel={cancel} saving={saving} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`${TD} font-mono text-xs text-ink-60 ${whereaboutsBorder(activeFor(s))}`}>{s.four_d ?? '–'}</td>
                        <td className={`${TD} text-ink-60`}>{s.platoon}</td>
                        <td className={`${TD} font-mono text-xs text-ink-80`}>{s.rank}</td>
                        <td className={`${TD} font-medium`}>
                          <button onClick={() => onOpen(s)} className="text-left hover:underline">{s.name}</button>
                          {!isOnStrength(s) && <span className="ml-2 text-xs text-danger">posted out</span>}
                        </td>
                        <td className={`${TD} text-xs ${s.bunk ? 'text-ink-80' : 'text-ink-60'}`}>{bunkOf(s) ?? '–'}</td>
                        <td className={TD}>
                          <RowActions
                            confirming={confirm.isConfirming(s.name)}
                            disabled={deletingName === s.name}
                            onEdit={() => { setEdit({ originalName: s.name, rank: s.rank, name: s.name, platoon: s.platoon, four_d: s.four_d ?? '', bunk: s.bunk ?? '' }); setErrors({}) }}
                            onRequest={() => confirm.request(s.name)}
                            onConfirm={() => confirm.resolve(() => remove(s.name))}
                            onCancel={confirm.cancel}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </Table>
          </div>
        )
      })}
    </>
  )
}
