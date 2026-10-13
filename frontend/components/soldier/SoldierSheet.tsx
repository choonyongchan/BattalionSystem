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
import { Button } from '@/frontend/components/ui/button'
import { Dialog } from '@/frontend/components/ui/dialog'
import { CheckField, Checkbox, Field, Input, Switch } from '@/frontend/components/ui/fields'
import { Badge, Banner, Empty, Panel, SectionTitle } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'

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

  /** Renders one exception row with the actions for its list. */
  function row(e: Exception, actions: 'current' | 'past' | 'revoked') {
    const confirming = delConfirm.isConfirming(e.id)
    return (
      <li key={e.id} className="space-y-2 rounded-card border border-hairline p-3">
        <div className="flex items-start gap-2">
          <Badge className="shrink-0">{exceptionType(e)}</Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink break-words">{e.reason || e.scope}</p>
            <p className="text-xs text-ink-60">
              {dateRange(e)} · {e.scope}{e.counts_as_absence ? ' · out of strength' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {actions !== 'revoked' && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setForm(editForm(e))}>Edit</Button>
          )}
          {actions === 'current' && isActiveOn(e, today) && e.end !== today && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => endToday(e)}>End today</Button>
          )}
          {actions !== 'revoked'
            ? <Button variant="secondary" size="sm" className="border-warning/40 text-warning hover:bg-warning/10" disabled={busy} onClick={() => setRevoked(e, true)} title="Keyed wrongly or withdrawn — stops counting, kept here">Revoke</Button>
            : <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRevoked(e, false)}>Restore</Button>}
          {confirming ? (
            <>
              <Button variant="danger" size="sm" disabled={busy} onClick={() => delConfirm.resolve(() => remove(e))}>Delete for good</Button>
              <Button variant="soft" size="sm" onClick={delConfirm.cancel}>Keep</Button>
            </>
          ) : (
            <Button variant="danger-outline" size="sm" disabled={busy} onClick={() => delConfirm.request(e.id)}>Delete</Button>
          )}
        </div>
      </li>
    )
  }

  const onStrength = soldier.on_strength !== false

  return (
    <Dialog placement="right" onClose={onClose} aria-label={`${soldier.rank} ${soldier.name}`}>
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-hairline bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{soldier.rank} {soldier.name}</h2>
          <p className="text-xs text-ink-60">
            {soldier.four_d ? `${soldier.four_d} · ` : ''}{soldier.platoon === 'HQ' ? 'HQ' : `PLT ${soldier.platoon}`}
            {!onStrength && <span className="ml-2 font-medium text-danger">Posted out</span>}
          </p>
        </div>
        <Button variant="icon" onClick={onClose} aria-label="Close">✕</Button>
      </div>

      <div className="space-y-4 p-4">
        {error && <Banner>{error}</Banner>}

        {form ? (
          <Panel className="space-y-3">
            <SectionTitle className="mb-0">{form.id === null ? 'Add exception' : 'Edit exception'}</SectionTitle>
            <Segmented
              size="sm"
              aria-label="Scope"
              value={form.scope}
              onChange={(s) => setForm({ ...form, scope: s, type: SCOPE_TYPES[s][0], counts_as_absence: absenceDefault(s) })}
              options={EXCEPTION_SCOPES}
            />
            {SCOPE_TYPES[form.scope].length > 1 && (
              <Segmented size="sm" aria-label="Type" value={form.type} onChange={(type) => setForm({ ...form, type })} options={SCOPE_TYPES[form.scope]} />
            )}
            <Field label="Reason">
              <Input placeholder="Reason (e.g. FEVER, LD)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {!SINGLE_DATE_SCOPES.includes(form.scope) && (
                <Field label="From"><Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
              )}
              <Field label={SINGLE_DATE_SCOPES.includes(form.scope) ? 'Date' : 'To (blank = open-ended)'}>
                <Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </Field>
            </div>
            <CheckField label="Out of camp (counts against strength)">
              <Checkbox checked={form.counts_as_absence} onChange={(e) => setForm({ ...form, counts_as_absence: e.target.checked })} />
            </CheckField>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </Panel>
        ) : (
          <Button block onClick={() => setForm(newForm())}>+ Add exception</Button>
        )}

        <Segmented
          aria-label="Exceptions"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'current', label: `Active & upcoming (${current.length})` },
            { value: 'history', label: `History (${past.length + revoked.length})` },
          ]}
        />

        {tab === 'current' ? (
          current.length ? <ul className="space-y-2">{current.map((e) => row(e, 'current'))}</ul>
            : <Empty className="py-6">Nothing running or coming up.</Empty>
        ) : (
          <div className="space-y-4">
            {past.length ? <ul className="space-y-2">{past.map((e) => row(e, 'past'))}</ul>
              : <Empty className="py-4">No past exceptions.</Empty>}
            {revoked.length > 0 && (
              <div>
                <SectionTitle>Revoked</SectionTitle>
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
            <Switch checked={onStrength} disabled={busy} onChange={(e) => setOnStrength(e.target.checked)} />
          </label>
        </div>
      </div>
    </Dialog>
  )
}
