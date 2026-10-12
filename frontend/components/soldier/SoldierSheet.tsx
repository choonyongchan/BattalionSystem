'use client'

import { useState } from 'react'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import type { Exception, Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { EXCEPTION_SCOPES, SINGLE_DATE_SCOPES } from '@/backend/domain/exceptions/exception-validation'
import type { ExceptionScope } from '@/backend/domain/exceptions/exception-validation'
import { SCOPE_TYPES, exceptionType, isActiveOn, isRevoked } from '@/backend/domain/exceptions/active'
import { useSettingsQuery } from '@/frontend/hooks/queries'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import { ddmmyy, todaySGDate } from '@/shared/dates'


/** Short date range for an exception, e.g. "since 010326" or "010326–030326". */
function dateRange(e: Exception): string {
  if (!e.start && !e.end) return 'no dates'
  if (e.start && !e.end) return `since ${ddmmyy(e.start)}`
  if (!e.start || e.start === e.end) return ddmmyy(e.end!)
  return `${ddmmyy(e.start)}–${ddmmyy(e.end!)}`
}

type Form = { id: number | null; scope: ExceptionScope; type: string; reason: string; start: string; end: string; counts_as_absence: boolean }

/**
 * One soldier's exceptions in one place: what's running or coming up, what's
 * over, and what was revoked — with add, edit, end today, revoke and delete.
 * Rows are keyed to him by soldier_id (see backend/domain/exceptions/active.ts).
 */
export default function SoldierSheet({ company, soldier, exceptions, onClose, onChanged }: {
  company: Company
  soldier: Soldier
  /** This soldier's rows only, revoked included. */
  exceptions: Exception[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const today = todaySGDate()
  const { data: settings } = useSettingsQuery(company)
  const [tab, setTab] = useState<'current' | 'history'>('current')
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const delConfirm = useConfirmDelete<number>()

  const live = exceptions.filter((e) => !isRevoked(e))
  /** Newest start date first. */
  const byStart = (a: Exception, b: Exception) => (b.start ?? '').localeCompare(a.start ?? '')
  const current = live.filter((e) => isActiveOn(e, today) || (e.start ?? '') > today).sort(byStart)
  const past = live.filter((e) => !current.includes(e)).sort(byStart)
  const revoked = exceptions.filter(isRevoked).sort(byStart)

  /** Whether a scope counts as absent by default, per settings. */
  const absenceDefault = (scope: string) => settings?.absence_scope_defaults[scope] ?? false

  /** Blank form for a new exception (MC today). */
  function newForm(): Form {
    return { id: null, scope: 'Att C', type: 'MC', reason: '', start: today, end: today, counts_as_absence: absenceDefault('Att C') }
  }

  /** Form prefilled from an existing exception. */
  function editForm(e: Exception): Form {
    return {
      id: e.id, scope: e.scope as ExceptionScope, type: exceptionType(e), reason: e.reason ?? '',
      start: e.start ?? '', end: e.end ?? '', counts_as_absence: e.counts_as_absence,
    }
  }

  /** Runs a write with a busy flag; shows its error or refreshes. Returns true on success. */
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    else await onChanged()
    setBusy(false)
    return !error
  }

  const exceptionRepo = new ExceptionRepository(company)

  /** Inserts or updates the exception in the form. */
  async function save() {
    if (!form) return
    const singleDate = SINGLE_DATE_SCOPES.includes(form.scope)
    const row = {
      name: soldier.name,
      soldier_id: soldier.id ?? null,
      scope: form.scope,
      type: form.type,
      reason: form.reason.trim() || null,
      start: (singleDate ? form.end : form.start) || null,
      end: form.end || null,
      counts_as_absence: form.counts_as_absence,
    }
    const ok = await run(() =>
      form.id === null
        ? exceptionRepo.insert(row)
        : exceptionRepo.update(form.id, row),
    )
    if (ok) setForm(null)
  }

  /** Ends an exception today. */
  const endToday = (e: Exception) => run(() => exceptionRepo.update(e.id, { end: today }))
  /** Revokes (or restores) an exception; revoked rows count nowhere but stay in history. */
  const setRevoked = (e: Exception, on: boolean) =>
    run(() => exceptionRepo.update(e.id, { revoked_at: on ? new Date().toISOString() : null }))
  /** Deletes an exception outright. */
  const remove = (e: Exception) => run(() => exceptionRepo.remove(e.id))
  /** Posts the soldier out (off strength) or back in. */
  const setOnStrength = (on: boolean) =>
    run(() => new SoldierRepository(company).update(soldier.name, { on_strength: on }))

  const btn = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50'

  /** Renders one exception row with the actions for its list. */
  function row(e: Exception, actions: 'current' | 'past' | 'revoked') {
    const confirming = delConfirm.isConfirming(e.id)
    return (
      <li key={e.id} className="border border-hairline rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-parchment text-ink-80 shrink-0">{exceptionType(e)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink break-words">{e.reason || e.scope}</p>
            <p className="text-xs text-ink-60">
              {dateRange(e)} · {e.scope}{e.counts_as_absence ? ' · out of strength' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {actions !== 'revoked' && (
            <button className={`${btn} border-hairline text-ink-80 hover:bg-parchment`} disabled={busy} onClick={() => setForm(editForm(e))}>Edit</button>
          )}
          {actions === 'current' && isActiveOn(e, today) && e.end !== today && (
            <button className={`${btn} border-hairline text-ink-80 hover:bg-parchment`} disabled={busy} onClick={() => endToday(e)}>End today</button>
          )}
          {actions !== 'revoked'
            ? <button className={`${btn} border-amber-200 text-amber-700 hover:bg-amber-50`} disabled={busy} onClick={() => setRevoked(e, true)} title="Keyed wrongly or withdrawn — stops counting, kept here">Revoke</button>
            : <button className={`${btn} border-hairline text-ink-80 hover:bg-parchment`} disabled={busy} onClick={() => setRevoked(e, false)}>Restore</button>}
          {confirming ? (
            <>
              <button className={`${btn} border-danger bg-danger text-white`} disabled={busy} onClick={() => delConfirm.resolve(() => remove(e))}>Delete for good</button>
              <button className={`${btn} border-hairline text-ink-80`} onClick={delConfirm.cancel}>Keep</button>
            </>
          ) : (
            <button className={`${btn} border-danger/30 text-danger hover:bg-danger/5`} disabled={busy} onClick={() => delConfirm.request(e.id)}>Delete</button>
          )}
        </div>
      </li>
    )
  }

  const input = 'w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus'
  const onStrength = soldier.on_strength !== false

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`${soldier.rank} ${soldier.name}`}
        className="w-full max-w-md h-full bg-white overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-hairline px-4 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-ink">{soldier.rank} {soldier.name}</h2>
            <p className="text-xs text-ink-60">
              {soldier.four_d ? `${soldier.four_d} · ` : ''}{soldier.platoon === 'HQ' ? 'HQ' : `PLT ${soldier.platoon}`}
              {!onStrength && <span className="ml-2 text-danger font-medium">Posted out</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-60 hover:text-ink-80 text-xl leading-none p-1" aria-label="Close">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="bg-danger/5 border border-danger/30 text-danger px-3 py-2 rounded-lg text-sm">{error}</div>}

          {form ? (
            <div className="bg-parchment border border-hairline rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium text-ink-80">{form.id === null ? 'Add exception' : 'Edit exception'}</p>
              <div className="flex flex-wrap gap-1.5">
                {EXCEPTION_SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, scope: s, type: SCOPE_TYPES[s][0], counts_as_absence: absenceDefault(s) })}
                    className={`px-2.5 py-1 text-xs rounded-full border ${form.scope === s ? 'bg-ink text-white border-ink' : 'border-hairline text-ink-80'}`}
                  >{s}</button>
                ))}
              </div>
              {SCOPE_TYPES[form.scope].length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {SCOPE_TYPES[form.scope].map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`px-2.5 py-1 text-xs rounded-full border ${form.type === t ? 'bg-action text-white border-action' : 'border-hairline text-ink-80'}`}
                    >{t}</button>
                  ))}
                </div>
              )}
              <input className={input} placeholder="Reason (e.g. FEVER, LD)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                {!SINGLE_DATE_SCOPES.includes(form.scope) && (
                  <label className="text-xs text-ink-60">From<input type="date" className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
                )}
                <label className="text-xs text-ink-60">{SINGLE_DATE_SCOPES.includes(form.scope) ? 'Date' : 'To (blank = open-ended)'}
                  <input type="date" className={input} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-80">
                <input type="checkbox" className="h-4 w-4" checked={form.counts_as_absence} onChange={(e) => setForm({ ...form, counts_as_absence: e.target.checked })} />
                Out of camp (counts against strength)
              </label>
              <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="flex-1 py-2 bg-ink text-white text-sm font-medium rounded-lg disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setForm(null)} className="px-4 py-2 border border-hairline text-ink-80 text-sm rounded-lg">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setForm(newForm())} className="w-full py-2.5 bg-ink text-white text-sm font-medium rounded-lg">+ Add exception</button>
          )}

          <div className="flex border-b border-hairline">
            {([['current', `Active & upcoming (${current.length})`], ['history', `History (${past.length + revoked.length})`]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 text-sm font-medium border-b-2 ${tab === id ? 'border-ink text-ink' : 'border-transparent text-ink-60'}`}
              >{label}</button>
            ))}
          </div>

          {tab === 'current' ? (
            current.length ? <ul className="space-y-2">{current.map((e) => row(e, 'current'))}</ul>
              : <p className="text-sm text-ink-60 text-center py-6">Nothing running or coming up.</p>
          ) : (
            <div className="space-y-4">
              {past.length ? <ul className="space-y-2">{past.map((e) => row(e, 'past'))}</ul>
                : <p className="text-sm text-ink-60 text-center py-4">No past exceptions.</p>}
              {revoked.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-2">Revoked</h3>
                  <ul className="space-y-2 opacity-70">{revoked.map((e) => row(e, 'revoked'))}</ul>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-hairline pt-4">
            <label className="flex items-center justify-between gap-3 text-sm text-ink-80">
              <span>
                On strength
                <span className="block text-xs text-ink-60">Off = posted out: hidden from the roll and strength, history kept.</span>
              </span>
              <input type="checkbox" className="h-5 w-5" checked={onStrength} disabled={busy} onChange={(e) => setOnStrength(e.target.checked)} />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
