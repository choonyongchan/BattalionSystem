'use client'

import React, { useState } from 'react'
import type { Exception, Soldier } from '@/shared/types'
import { toSGDate } from '@/shared/dates'
import type { AppSettings } from '@/backend/domain/settings/settings'
import {
  EXCEPTION_SCOPES, IN_OUT_SCOPES, SINGLE_DATE_SCOPES,
  isEditExceptionValid, validateEditEx, type ExceptionScope,
} from '@/backend/domain/exceptions/exception-validation'
import { buildExceptionGroups, type ExceptionSort } from '@/backend/domain/parade/exception-table'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { CONFIRM_BTN, ICON_BTN, ICON_BTN_DANGER, fieldInputClass } from '@/frontend/components/shared/styles'
import { REASON_HINTS, soldierDropdownProps } from './parade-ui'
import { THEME } from '@/frontend/theme'

// Guard Duty rows are managed in the Duties tab
const EDIT_SCOPES = EXCEPTION_SCOPES.filter((s) => s !== 'Guard Duty')

/** Cycles a column's sort: ascending, descending, then off. */
function nextSort(prev: ExceptionSort, column: 'start' | 'end'): ExceptionSort {
  if (!prev || prev.column !== column) return { column, dir: 'asc' }
  return prev.dir === 'asc' ? { column, dir: 'desc' } : null
}

/**
 * Exceptions grouped by scope and soldier (merged name cells), sortable by start/end,
 * with inline edit and confirm-to-delete.
 */
export default function ExceptionsTable({ settings, data, rows }: {
  settings: AppSettings | undefined
  data: ParadeData
  rows: Exception[]
}) {
  const { soldiers, repos, mutate, linkFields } = data
  const [edit, setEdit] = useState<Exception | null>(null)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [absenceTouched, setAbsenceTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sort, setSort] = useState<ExceptionSort>(null)
  const confirm = useConfirmDelete<number>()

  const groups = buildExceptionGroups(rows, sort, soldiers)
  /** Inline-edit input class for a field, red when invalid. */
  const fieldClass = (field: string) => fieldInputClass(!!errors[field], THEME.focusRing)

  /** Leaves edit mode and clears errors. */
  function cancel() {
    setEdit(null)
    setErrors({})
  }

  /** Validates and saves the edited exception. */
  async function save() {
    if (!edit) return
    const errs = validateEditEx(edit)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    const singleDate = SINGLE_DATE_SCOPES.includes(edit.scope as ExceptionScope)
    const reason = (edit.reason ?? '').trim() || null
    const ok = await mutate(() => repos.exceptions.update(edit.id, {
      name: edit.name,
      scope: edit.scope,
      reason,
      start: (singleDate ? edit.end : edit.start) || null,
      end: edit.end || null,
      counts_as_absence: edit.counts_as_absence,
      time: edit.scope === 'MA' ? (edit.time || null) : null,
      location: (edit.location ?? '').trim() || null,
      in_out: IN_OUT_SCOPES.includes(edit.scope as ExceptionScope) && edit.in_out ? edit.in_out : null,
      ...linkFields(edit.name, edit.scope, reason, edit.type),
    }))
    if (ok) cancel()
    setSaving(false)
  }

  /** Sortable column header for start or end date. */
  const sortHeader = (column: 'start' | 'end', label: string) => (
    <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap" aria-sort={sort?.column === column ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((prev) => nextSort(prev, column))} className="flex items-center gap-1 hover:text-ink-80 transition-colors">
        {label}
        <span className="text-ink-48 text-[10px]">{sort?.column === column ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    </th>
  )

  let rowIdx = -1
  return (
    <div className="bg-white border border-hairline rounded-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-parchment border-b border-hairline">
              <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">4D</th>
              <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Name</th>
              <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Scope</th>
              <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Reason</th>
              {sortHeader('start', 'Start')}
              {sortHeader('end', 'End')}
              <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Absent?</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => {
              const isGroupEditing = group.some((entry) => edit?.id === entry.id)
              return (
                <React.Fragment key={`${group[0].scope}-${group[0].name}-${gi}`}>
                  {group.map((e, ei) => {
                    rowIdx++
                    const isEditing = edit?.id === e.id
                    const showGroupCells = ei === 0 || isGroupEditing
                    const rowSpan = ei === 0 && !isGroupEditing ? group.length : undefined
                    return (
                      <tr key={e.id} className={`border-b border-hairline last:border-0 group ${rowIdx % 2 === 0 ? '' : 'bg-parchment/50'} ${isEditing ? 'bg-action/5 border-b-0' : ''}`}>
                        {isEditing && edit ? (
                          <EditCells
                            settings={settings} soldiers={soldiers} edit={edit} setEdit={setEdit}
                            showGroupCells={showGroupCells} rowSpan={rowSpan} fieldClass={fieldClass}
                            absenceTouched={absenceTouched} onAbsenceTouched={() => setAbsenceTouched(true)}
                            saving={saving} onSave={save} onCancel={cancel}
                          />
                        ) : (
                          <>
                            {showGroupCells && <ReadGroupCells soldiers={soldiers} e={e} rowSpan={rowSpan} />}
                            <td className="px-3 py-1.5 text-ink-60"><div className="w-max max-w-sm whitespace-normal">{e.reason ?? '–'}</div></td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-ink-60 text-xs">{e.start ? toSGDate(e.start) : '–'}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-ink-60 text-xs">{e.end ? toSGDate(e.end) : '–'}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <input type="checkbox" className="h-5 w-5" checked={e.counts_as_absence} disabled />
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <div className="flex gap-1 justify-end items-center">
                                <button
                                  onClick={() => {
                                    if (confirm.isConfirming(e.id)) return confirm.resolve(() => mutate(() => repos.exceptions.remove(e.id)))
                                    setEdit({ ...e })
                                    setAbsenceTouched(false)
                                    setErrors({})
                                  }}
                                  className={confirm.isConfirming(e.id) ? CONFIRM_BTN : ICON_BTN}
                                  title={confirm.isConfirming(e.id) ? 'Confirm delete' : 'Edit'}
                                >
                                  {confirm.isConfirming(e.id) ? 'Yes' : '✎'}
                                </button>
                                <button
                                  onClick={() => confirm.isConfirming(e.id) ? confirm.cancel() : confirm.request(e.id)}
                                  className={confirm.isConfirming(e.id)
                                    ? 'px-2 py-1 bg-parchment hover:bg-hairline active:bg-hairline text-ink-80 text-xs font-semibold rounded-lg transition-colors'
                                    : ICON_BTN_DANGER}
                                  title={confirm.isConfirming(e.id) ? 'Cancel' : 'Remove'}
                                >
                                  {confirm.isConfirming(e.id) ? 'No' : '✕'}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Read-only 4D, name and scope cells shared by a soldier's rows in one scope. */
function ReadGroupCells({ soldiers, e, rowSpan }: { soldiers: Soldier[]; e: Exception; rowSpan?: number }) {
  const soldier = soldiers.find((s) => s.name === e.name)
  return (
    <>
      <td className="px-3 py-1.5 whitespace-nowrap text-ink-60 font-mono text-xs" rowSpan={rowSpan}>{soldier?.four_d ?? '–'}</td>
      <td className="px-3 py-1.5 whitespace-nowrap font-medium" rowSpan={rowSpan}>{soldier?.rank ? `${soldier.rank} ${e.name}` : e.name}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" rowSpan={rowSpan}>
        <span className={`inline-block ${THEME.badgeBg} ${THEME.badgeText} text-xs font-medium px-2 py-0.5 rounded-lg whitespace-nowrap`}>{e.scope ?? '–'}</span>
      </td>
    </>
  )
}

/** Inline edit cells for one exception row. */
function EditCells({
  settings, soldiers, edit, setEdit, showGroupCells, rowSpan, fieldClass,
  absenceTouched, onAbsenceTouched, saving, onSave, onCancel,
}: {
  settings: AppSettings | undefined
  soldiers: Soldier[]
  edit: Exception
  setEdit: (e: Exception) => void
  showGroupCells: boolean
  rowSpan?: number
  fieldClass: (field: string) => string
  absenceTouched: boolean
  onAbsenceTouched: () => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const singleDate = SINGLE_DATE_SCOPES.includes(edit.scope as ExceptionScope)
  /** Classes for a toggle chip, filled when active. */
  const chip = (active: boolean) => active ? `${THEME.buttonBg} text-white border-transparent` : 'bg-white border-hairline text-ink-80 hover:border-hairline'

  return (
    <>
      {showGroupCells && (
        <>
          <td className="px-3 py-1.5 whitespace-nowrap text-ink-60 font-mono text-xs" rowSpan={rowSpan}>
            {soldiers.find((s) => s.name === edit.name)?.four_d ?? '–'}
          </td>
          <td className="px-2 py-1" rowSpan={rowSpan}>
            <SearchDropdown {...soldierDropdownProps} items={soldiers} value={edit.name} onChange={(name) => setEdit({ ...edit, name })} inputClass={fieldClass('name')} />
          </td>
          <td className="px-2 py-1" rowSpan={rowSpan}>
            <div className="flex flex-wrap gap-1">
              {EDIT_SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={edit.scope === s}
                  onClick={() => setEdit({ ...edit, scope: s, counts_as_absence: absenceTouched ? edit.counts_as_absence : (settings?.absence_scope_defaults[s] ?? false) })}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${chip(edit.scope === s)}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </td>
        </>
      )}
      <td className="px-2 py-1">
        <div className="space-y-1">
          <input
            type="text"
            value={edit.reason ?? ''}
            onChange={(ev) => setEdit({ ...edit, reason: ev.target.value })}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') onSave()
              if (ev.key === 'Escape') onCancel()
            }}
            placeholder={REASON_HINTS[edit.scope as ExceptionScope]}
            className={fieldClass('reason')}
          />
          <input type="text" value={edit.location ?? ''} onChange={(ev) => setEdit({ ...edit, location: ev.target.value })} placeholder="Location (optional)" className={fieldClass('location')} />
          {IN_OUT_SCOPES.includes(edit.scope as ExceptionScope) && (
            <div className="flex gap-1">
              {(['', 'IN', 'OUT'] as const).map((v) => (
                <button
                  key={v || 'blank'}
                  type="button"
                  onClick={() => setEdit({ ...edit, in_out: v || null })}
                  className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-colors ${chip((edit.in_out ?? '') === v)}`}
                >
                  {v || '—'}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-2 py-1">
        {singleDate ? (
          <div className="space-y-1">
            <input type="date" value={edit.end ?? ''} onChange={(ev) => setEdit({ ...edit, end: ev.target.value, start: ev.target.value })} className={fieldClass('start')} />
            {edit.scope === 'MA' && (
              <input type="time" value={edit.time ?? ''} onChange={(ev) => setEdit({ ...edit, time: ev.target.value })} className={fieldClass('time')} />
            )}
          </div>
        ) : (
          <input type="date" value={edit.start ?? ''} onChange={(ev) => setEdit({ ...edit, start: ev.target.value })} className={fieldClass('start')} />
        )}
      </td>
      <td className="px-2 py-1">
        {singleDate ? (
          <span className="text-ink-60 text-xs">same as start</span>
        ) : (
          <input type="date" value={edit.end ?? ''} onChange={(ev) => setEdit({ ...edit, end: ev.target.value })} className={fieldClass('end')} />
        )}
      </td>
      <td className="px-2 py-1">
        <label className="flex items-center justify-center h-full py-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={edit.counts_as_absence}
            onChange={(ev) => { setEdit({ ...edit, counts_as_absence: ev.target.checked }); onAbsenceTouched() }}
          />
        </label>
      </td>
      <td className="px-2 py-1">
        <div className="flex gap-1 justify-end">
          <button
            onClick={onSave}
            disabled={saving || !isEditExceptionValid(edit)}
            className={`px-2 py-1 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={onCancel} className="px-2 py-1 border border-hairline text-ink-80 text-xs rounded-lg hover:bg-parchment">
            Cancel
          </button>
        </div>
      </td>
    </>
  )
}
