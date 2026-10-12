'use client'

import { useState } from 'react'
import type { AppSettings } from '@/backend/domain/settings/settings'
import {
  EXCEPTION_SCOPES, IN_OUT_SCOPES, SINGLE_DATE_SCOPES,
  isExceptionValid, validateAddEx,
  type ExForm, type StatusRow,
} from '@/backend/domain/exceptions/exception-validation'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { REASON_HINTS, soldierDropdownProps } from './parade-ui'
import { THEME } from '@/frontend/theme'

// Guard Duty is added in the Duties tab; new report sicks are keyed in the RSI tab
const ADD_SCOPES = EXCEPTION_SCOPES.filter((s) => s !== 'Guard Duty' && s !== 'Report Sick')

/** Blank form for a new exception dated `date`. */
const emptyForm = (date: string): ExForm =>
  ({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true, time: '', location: '', in_out: '' })

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
  const inputClass = `w-full border border-hairline rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 ${THEME.focusRing}`
  /** Input class for a field, red when it failed validation. */
  const fieldClass = (field: string) => errors[field]
    ? 'w-full border border-danger rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 ring-2 ring-danger'
    : inputClass
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
        in_out: IN_OUT_SCOPES.includes(form.scope) && form.in_out ? form.in_out : null,
        ...(form.scope === 'MA' && form.time ? { time: form.time } : {}),
        ...linkFields(form.name, form.scope, reason),
      }
    if (await mutate(() => repos.exceptions.insert(rows))) onDone()
  }

  /** Classes for a toggle chip, filled when active. */
  const choiceClass = (active: boolean) => active
    ? `${THEME.buttonBg} ${THEME.buttonHoverBg} text-white border-transparent`
    : 'bg-white border-hairline text-ink-80 hover:border-hairline'

  return (
    <div className="bg-parchment border border-hairline rounded-card p-4 space-y-4">
      <div>
        <label className="block text-xs text-ink-60 mb-1">Soldier <span className="text-danger">*</span></label>
        <SearchDropdown
          {...soldierDropdownProps}
          items={soldiers}
          value={form.name}
          onChange={(name) => setForm({ ...form, name })}
          inputClass={fieldClass('name')}
        />
      </div>

      <div>
        <label className="block text-xs text-ink-60 mb-2">Scope <span className="text-danger">*</span></label>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {ADD_SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={form.scope === s}
              onClick={() => setForm({ ...form, scope: s, counts_as_absence: absenceTouched ? form.counts_as_absence : (settings?.absence_scope_defaults[s] ?? false) })}
              className={`flex-none px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${choiceClass(form.scope === s)}`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-60 mt-1">Report sick → RSI tab</p>
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
                    <button type="button" onClick={() => setStatusRows((r) => r.filter((_, j) => j !== i))} className="text-xs text-ink-60 hover:text-danger transition-colors">
                      × Remove
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink-60 mb-1">From</label>
                    <input type="date" value={row.start} onChange={(e) => updateStatusRow(i, { start: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-60 mb-1">To</label>
                    <input type="date" value={row.end} onChange={(e) => updateStatusRow(i, { end: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1">
                    {isDupe
                      ? <span className="text-amber-700 font-medium">Reason must be unique across entries</span>
                      : <span className="text-ink-60">Reason</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={REASON_HINTS.Status}
                    value={row.reason}
                    onChange={(e) => updateStatusRow(i, { reason: e.target.value })}
                    className={isDupe ? `${inputClass} !border-amber-300 !ring-2 !ring-amber-100` : inputClass}
                  />
                </div>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setStatusRows((r) => [...r, { start: date, end: date, reason: '' }])}
            className="w-full py-2 text-sm text-ink-60 border border-dashed border-hairline hover:border-hairline rounded-lg transition-colors"
          >
            + Add Status
          </button>
        </>
      ) : singleDate ? (
        <div>
          <label className="block text-xs text-ink-60 mb-1">Date</label>
          <input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={fieldClass('end')} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink-60 mb-1">From</label>
            <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={fieldClass('start')} />
          </div>
          <div>
            <label className="block text-xs text-ink-60 mb-1">To</label>
            <input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={fieldClass('end')} />
          </div>
        </div>
      )}

      {form.scope === 'MA' && (
        <div>
          <label className="block text-xs text-ink-60 mb-1">Appointment Time (optional)</label>
          <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={fieldClass('time')} />
        </div>
      )}

      {form.scope !== 'Status' && (
        <div>
          <label className="block text-xs text-ink-60 mb-1">Reason</label>
          <input type="text" placeholder={REASON_HINTS[form.scope]} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={fieldClass('reason')} />
        </div>
      )}

      <div>
        <label className="block text-xs text-ink-60 mb-1">Location (optional)</label>
        <input type="text" placeholder="e.g. CGH, NUH, Raffles" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={fieldClass('location')} />
      </div>

      {IN_OUT_SCOPES.includes(form.scope) && (
        <div>
          <label className="block text-xs text-ink-60 mb-2">In/Out (optional)</label>
          <div className="flex gap-2">
            {(['', 'IN', 'OUT'] as const).map((v) => (
              <button
                key={v || 'blank'}
                type="button"
                onClick={() => setForm({ ...form, in_out: v })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${choiceClass(form.in_out === v)}`}
              >
                {v || '—'}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-ink-80 -mx-1 px-1 py-2 cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={form.counts_as_absence}
          onChange={(e) => { setForm({ ...form, counts_as_absence: e.target.checked }); setAbsenceTouched(true) }}
        />
        Absent?
      </label>

      <button
        onClick={add}
        disabled={!isExceptionValid(form, statusRows)}
        className={`w-full py-3 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        Add Exception
      </button>
    </div>
  )
}
