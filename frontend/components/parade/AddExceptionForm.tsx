'use client'

import { useState } from 'react'
import type { AppSettings } from '@/backend/domain/settings/settings'
import {
  EXCEPTION_SCOPES, SINGLE_DATE_SCOPES,
  isExceptionValid, validateAddEx,
  type ExForm, type StatusRow,
} from '@/backend/domain/exceptions/exception-validation'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { REASON_HINTS, soldierDropdownProps } from './parade-ui'
import { Button } from '@/frontend/components/ui/button'
import { CheckField, Checkbox, Field, Input, inputClass } from '@/frontend/components/ui/fields'
import { Panel } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'

// New report sicks are keyed in the Report Sick tab
const ADD_SCOPES = EXCEPTION_SCOPES.filter((s) => s !== 'Report Sick')

/** Blank form for a new exception dated `date`. */
const emptyForm = (date: string): ExForm =>
  ({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true, time: '', location: '' })

/**
 * Form for adding an exception. STATUS can hold several rows (one per status) that are
 * saved together; other scopes save one row.
 */
export default function AddExceptionForm({ date, settings, data, onDone }: {
  date: string
  settings: AppSettings | undefined
  data: ParadeData
  onDone: () => void
}) {
  const { soldiers, repos, mutate, linkFields } = data
  const [form, setForm] = useState<ExForm>(() => emptyForm(date))
  const [absenceTouched, setAbsenceTouched] = useState(false)
  const [statusRows, setStatusRows] = useState<StatusRow[]>([{ start: date, end: date, reason: '' }])
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const singleDate = SINGLE_DATE_SCOPES.includes(form.scope)
  /** Patches one STATUS row. */
  const updateStatusRow = (i: number, patch: Partial<StatusRow>) =>
    setStatusRows((rows) => rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  /** Validates and inserts the exception (one row per STATUS entry). */
  async function add() {
    const errs = validateAddEx(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0 || !isExceptionValid(form, statusRows)) return
    const reason = form.reason.trim() || null
    const rows = form.scope === 'Status'
      ? statusRows.map((r) => ({
        name: form.name, scope: form.scope, reason: r.reason.trim() || null, start: r.start || null, end: r.end || null,
        counts_as_absence: form.counts_as_absence, ...linkFields(form.name, form.scope, r.reason.trim() || null),
      }))
      : {
        name: form.name,
        scope: form.scope,
        reason,
        start: (singleDate ? form.end : form.start) || null,
        end: form.end || null,
        counts_as_absence: form.counts_as_absence,
        location: form.location.trim() || null,
        ...(form.scope === 'MA' && form.time ? { time: form.time } : {}),
        ...linkFields(form.name, form.scope, reason),
      }
    if (await mutate(() => repos.exceptions.insert(rows))) onDone()
  }

  return (
    <Panel>
      <Field label="Soldier" required>
        <SearchDropdown
          {...soldierDropdownProps}
          items={soldiers}
          value={form.name}
          onChange={(name) => setForm({ ...form, name })}
          inputClass={inputClass({ error: errors.name })}
        />
      </Field>

      <div>
        <Segmented
          label={<>Scope <span aria-hidden className="text-danger">*</span></>}
          value={form.scope}
          onChange={(s) => setForm({ ...form, scope: s, counts_as_absence: absenceTouched ? form.counts_as_absence : (settings?.absence_scope_defaults[s] ?? false) })}
          options={ADD_SCOPES}
        />
        <p className="text-xs text-ink-60 mt-1">Report sick → Report Sick tab</p>
      </div>

      {form.scope === 'Status' ? (
        <>
          {statusRows.map((row, i) => {
            const reasonKey = row.reason.trim().toLowerCase()
            const isDupe = reasonKey !== '' && statusRows.filter((r) => r.reason.trim().toLowerCase() === reasonKey).length > 1
            return (
              <div key={i} className={`space-y-3 ${i > 0 ? 'pt-3 border-t border-hairline' : ''}`}>
                {statusRows.length > 1 && (
                  <div className="flex justify-end">
                    <Button variant="icon-danger" type="button" onClick={() => setStatusRows((r) => r.filter((_, j) => j !== i))} title="Remove status" aria-label="Remove status">
                      ✕
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From"><Input type="date" value={row.start} onChange={(e) => updateStatusRow(i, { start: e.target.value })} /></Field>
                  <Field label="To"><Input type="date" value={row.end} onChange={(e) => updateStatusRow(i, { end: e.target.value })} /></Field>
                </div>
                <Field label="Reason" error={isDupe && 'Reason must be unique across entries'}>
                  <Input type="text" placeholder={REASON_HINTS.Status} value={row.reason} onChange={(e) => updateStatusRow(i, { reason: e.target.value })} error={isDupe} />
                </Field>
              </div>
            )
          })}
          <Button variant="secondary" size="sm" block type="button" className="border-dashed" onClick={() => setStatusRows((r) => [...r, { start: date, end: date, reason: '' }])}>
            + Add Status
          </Button>
        </>
      ) : singleDate ? (
        <Field label="Date"><Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} error={errors.end} /></Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} error={errors.start} /></Field>
          <Field label="To"><Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} error={errors.end} /></Field>
        </div>
      )}

      {form.scope === 'MA' && (
        <Field label="Appointment Time (optional)">
          <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} error={errors.time} />
        </Field>
      )}

      {form.scope !== 'Status' && (
        <Field label="Reason">
          <Input type="text" placeholder={REASON_HINTS[form.scope]} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={errors.reason} />
        </Field>
      )}

      <Field label="Location (optional)">
        <Input type="text" placeholder="e.g. CGH, NUH, Raffles" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} error={errors.location} />
      </Field>

      <CheckField label="Absent?">
        <Checkbox
          checked={form.counts_as_absence}
          onChange={(e) => { setForm({ ...form, counts_as_absence: e.target.checked }); setAbsenceTouched(true) }}
        />
      </CheckField>

      <Button block onClick={add} disabled={!isExceptionValid(form, statusRows)}>Add Exception</Button>
    </Panel>
  )
}
