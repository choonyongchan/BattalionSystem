'use client'

import { useEffect, useMemo, useState } from 'react'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import type { Exception, Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { isActiveOn, isOnStrength, soldierIndex, soldierOf } from '@/backend/domain/exceptions/active'
import { generateRsiReport, isUrti, isUrtiException } from '@/backend/domain/rsi/rsi'
import { useSettingsQuery } from '@/frontend/hooks/useSettings'
import { todaySGDate } from '@/shared/dates'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'

/** Current Singapore time as "HH:MM". */
const nowSGTime = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })

type Form = { name: string; reason: string; urti: boolean; urtiTouched: boolean }
const EMPTY: Form = { name: '', reason: '', urti: false, urtiTouched: false }

/**
 * Report sick (RSI): key who reported sick and why. Each entry is a 'Report
 * Sick' exception (type URTI or Report Sick), so the parade state and conducts
 * pick it up as is; the RSI message is generated from the day's entries.
 */
export default function RsiTab({ company }: { company: Company }) {
  const [date, setDate] = useState(todaySGDate())
  const [time, setTime] = useState(nowSGTime())
  const [allSoldiers, setAllSoldiers] = useState<Soldier[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [copied, setCopied] = useState(false)
  const { data: settings } = useSettingsQuery(company)
  const delConfirm = useConfirmDelete<number>()
  const exceptionRepo = new ExceptionRepository(company)

  useEffect(() => { load() }, [company])

  /** Loads the roll and the company's report-sick exceptions. */
  async function load() {
    const [rollRes, exRes] = await Promise.all([
      new SoldierRepository(company).list(),
      exceptionRepo.list('Report Sick'),
    ])
    const err = rollRes.error ?? exRes.error
    if (err) setError(err.message)
    setAllSoldiers(rollRes.data)
    setExceptions(exRes.data)
    setLoading(false)
  }

  /** Runs a write with a busy flag; shows its error or reloads. Returns true on success. */
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>): Promise<boolean> {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    else await load()
    setBusy(false)
    return !error
  }

  const soldiers = useMemo(() => allSoldiers.filter(isOnStrength), [allSoldiers])
  const idx = useMemo(() => soldierIndex(allSoldiers), [allSoldiers])
  const entries = useMemo(
    () => exceptions.filter((e) => isActiveOn(e, date)).sort((a, b) => a.id - b.id),
    [exceptions, date],
  )
  const text = generateRsiReport(date, time, company, entries, idx)

  /** Adds a report sick for the picked soldier on the selected date. */
  async function add() {
    const soldier = soldiers.find((s) => s.name === form.name)
    const reason = form.reason.trim()
    if (!soldier || !reason) return
    const ok = await run(() => exceptionRepo.insert({
      name: soldier.name,
      soldier_id: soldier.id ?? null,
      scope: 'Report Sick',
      type: form.urti ? 'URTI' : 'Report Sick',
      reason,
      start: date,
      end: date,
      counts_as_absence: settings?.absence_scope_defaults['Report Sick'] ?? false,
    }))
    if (ok) setForm(EMPTY)
  }

  /** Marks a report sick as URTI or non-URTI. */
  const setUrti = (e: Exception, urti: boolean) =>
    run(() => exceptionRepo.update(e.id, { type: urti ? 'URTI' : 'Report Sick' }))
  /** Deletes a report sick. */
  const remove = (e: Exception) => run(() => exceptionRepo.remove(e.id))

  /** Copies the RSI report to the clipboard. */
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

  const input = 'w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus'
  /** Formats an entry's soldier as "<4D> <rank> <name>", or the stored name. */
  const who = (e: Exception) => {
    const s = soldierOf(e, idx)
    return s ? [s.four_d, s.rank, s.name].filter(Boolean).join(' ') : e.name
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Report Sick (RSI)</h2>
        <p className="text-xs text-ink-60">Entries go into the parade state under REPORT SICK and fall the soldier out of conducts.</p>
      </div>

      {error && <div className="bg-danger/5 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-60">Date<input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-xs text-ink-60">Time<input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>

      <div className="bg-parchment border border-hairline rounded-card p-4 space-y-3">
        <SearchDropdown
          items={soldiers}
          value={form.name}
          getKey={(s) => s.name}
          getLabel={(s) => `${s.rank} ${s.name}`.trim()}
          matches={(s, q) => `${s.four_d ?? ''} ${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase())}
          renderOption={(s) => (
            <div className="flex gap-2">
              <span className="font-mono text-xs text-ink-60 w-12 shrink-0 pt-0.5">{s.rank}</span>
              <span className="font-medium text-ink">{s.name}</span>
            </div>
          )}
          onChange={(name) => setForm({ ...form, name })}
          inputClass={input}
          placeholder="Search soldier..."
        />
        <input
          className={input}
          placeholder="Reason (e.g. Flu and phlegm)"
          value={form.reason}
          onChange={(e) => {
            const reason = e.target.value
            setForm({ ...form, reason, urti: form.urtiTouched ? form.urti : isUrti(reason) })
          }}
        />
        <label className="flex items-center gap-2 text-sm text-ink-80">
          <input type="checkbox" className="h-4 w-4" checked={form.urti} onChange={(e) => setForm({ ...form, urti: e.target.checked, urtiTouched: true })} />
          URTI
        </label>
        <button onClick={add} disabled={busy || !form.name || !form.reason.trim()} className="w-full py-2.5 bg-ink text-white text-sm font-medium rounded-lg disabled:opacity-50">
          Add report sick
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-center py-6 text-sm text-ink-60">No one reported sick on this day.</p>
      ) : (
        <ul className="divide-y divide-hairline border border-hairline rounded-lg">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink truncate">{who(e)}</div>
                <div className="text-xs text-ink-60 truncate">{e.reason}</div>
              </div>
              <label className="flex items-center gap-1 text-xs text-ink-80">
                <input type="checkbox" className="h-4 w-4" checked={isUrtiException(e)} disabled={busy} onChange={(ev) => setUrti(e, ev.target.checked)} />
                URTI
              </label>
              {delConfirm.isConfirming(e.id) ? (
                <>
                  <button className="px-2.5 py-1.5 text-xs bg-danger text-white rounded-lg" disabled={busy} onClick={() => delConfirm.resolve(() => remove(e))}>Delete</button>
                  <button className="px-2.5 py-1.5 text-xs border border-hairline text-ink-80 rounded-lg" onClick={delConfirm.cancel}>Keep</button>
                </>
              ) : (
                <button className="px-2.5 py-1.5 text-xs border border-danger/30 text-danger rounded-lg" onClick={() => delConfirm.request(e.id)}>Delete</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">RSI message</h3>
          <button onClick={copy} className="px-3 py-1.5 text-xs bg-ink text-white rounded-lg">{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <pre className="bg-parchment border border-hairline rounded-lg p-3 text-xs whitespace-pre-wrap font-mono">{text}</pre>
      </div>
    </div>
  )
}
