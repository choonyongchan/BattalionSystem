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
import { Checkbox, inputClass } from '@/frontend/components/ui/fields'
import { Badge } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'
import { EditActions, RowActions, SortTh, TD, TD_EDIT, Table, Th, rowClass } from '@/frontend/components/ui/table'
import { REASON_HINTS, soldierDropdownProps } from './parade-ui'

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
  const fieldClass = (field: string) => inputClass({ compact: true, error: errors[field] })

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
    <SortTh label={label} dir={sort?.column === column ? sort.dir : null} onSort={() => setSort((prev) => nextSort(prev, column))} />
  )

  let rowIdx = -1
  return (
    <Table head={<>
      <Th>4D</Th>
      <Th>Name</Th>
      <Th>Scope</Th>
      <Th>Reason</Th>
      {sortHeader('start', 'Start')}
      {sortHeader('end', 'End')}
      <Th>Absent?</Th>
      <th />
    </>}>
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
                <tr key={e.id} className={rowClass(rowIdx, isEditing, isEditing ? 'border-b-0' : undefined)}>
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
                      <td className={`${TD} text-xs text-ink-60`}>{e.start ? toSGDate(e.start) : '–'}</td>
                      <td className={`${TD} text-xs text-ink-60`}>{e.end ? toSGDate(e.end) : '–'}</td>
                      <td className={TD}><Checkbox checked={e.counts_as_absence} disabled /></td>
                      <td className={TD}>
                        <RowActions
                          confirming={confirm.isConfirming(e.id)}
                          onEdit={() => { setEdit({ ...e }); setAbsenceTouched(false); setErrors({}) }}
                          onRequest={() => confirm.request(e.id)}
                          onConfirm={() => confirm.resolve(() => mutate(() => repos.exceptions.remove(e.id)))}
                          onCancel={confirm.cancel}
                        />
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </React.Fragment>
        )
      })}
    </Table>
  )
}

/** Read-only 4D, name and scope cells shared by a soldier's rows in one scope. */
function ReadGroupCells({ soldiers, e, rowSpan }: { soldiers: Soldier[]; e: Exception; rowSpan?: number }) {
  const soldier = soldiers.find((s) => s.name === e.name)
  return (
    <>
      <td className={`${TD} font-mono text-xs text-ink-60`} rowSpan={rowSpan}>{soldier?.four_d ?? '–'}</td>
      <td className={`${TD} font-medium`} rowSpan={rowSpan}>{soldier?.rank ? `${soldier.rank} ${e.name}` : e.name}</td>
      <td className={TD} rowSpan={rowSpan}><Badge>{e.scope ?? '–'}</Badge></td>
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

  return (
    <>
      {showGroupCells && (
        <>
          <td className={`${TD} font-mono text-xs text-ink-60`} rowSpan={rowSpan}>
            {soldiers.find((s) => s.name === edit.name)?.four_d ?? '–'}
          </td>
          <td className={TD_EDIT} rowSpan={rowSpan}>
            <SearchDropdown {...soldierDropdownProps} items={soldiers} value={edit.name} onChange={(name) => setEdit({ ...edit, name })} inputClass={fieldClass('name')} />
          </td>
          <td className={`${TD_EDIT} max-w-xs`} rowSpan={rowSpan}>
            <Segmented
              size="sm"
              aria-label="Scope"
              value={edit.scope as ExceptionScope}
              onChange={(s) => setEdit({ ...edit, scope: s, counts_as_absence: absenceTouched ? edit.counts_as_absence : (settings?.absence_scope_defaults[s] ?? false) })}
              options={EDIT_SCOPES}
            />
          </td>
        </>
      )}
      <td className={TD_EDIT}>
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
            <Segmented
              size="sm"
              aria-label="In/Out"
              value={edit.in_out ?? ''}
              onChange={(v) => setEdit({ ...edit, in_out: v || null })}
              options={[{ value: '', label: '—' }, 'IN', 'OUT']}
            />
          )}
        </div>
      </td>
      <td className={TD_EDIT}>
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
      <td className={TD_EDIT}>
        {singleDate ? (
          <span className="text-xs text-ink-60">same as start</span>
        ) : (
          <input type="date" value={edit.end ?? ''} onChange={(ev) => setEdit({ ...edit, end: ev.target.value })} className={fieldClass('end')} />
        )}
      </td>
      <td className={TD_EDIT}>
        <label className="flex h-full cursor-pointer items-center justify-center py-2">
          <Checkbox
            aria-label="Absent?"
            checked={edit.counts_as_absence}
            onChange={(ev) => { setEdit({ ...edit, counts_as_absence: ev.target.checked }); onAbsenceTouched() }}
          />
        </label>
      </td>
      <td className={TD_EDIT}>
        <EditActions onSave={onSave} onCancel={onCancel} saving={saving} disabled={!isEditExceptionValid(edit)} />
      </td>
    </>
  )
}
