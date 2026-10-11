'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase, tbl } from '@/lib/supabase'
import type { Exception, Soldier } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { isActiveOn, isOnStrength, soldierIndex, soldierOf } from '@/lib/exceptions/active'
import { generateRsiReport, isUrti, isUrtiException } from '@/lib/rsi/rsi'
import { useSettingsQuery } from '@/lib/settings'
import { todaySGDate } from '@/lib/utils'
import { useConfirmDelete } from '@/hooks/hooks'
import SearchDropdown from '@/components/shared/SearchDropdown'

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

  useEffect(() => { load() }, [company])

  async function load() {
    const [rollRes, exRes] = await Promise.all([
      supabase.from(tbl(company, 'NominalRoll')).select('*'),
      supabase.from(tbl(company, 'Exceptions')).select('*').eq('scope', 'Report Sick'),
    ])
    const err = rollRes.error ?? exRes.error
    if (err) setError(err.message)
    setAllSoldiers((rollRes.data ?? []) as unknown as Soldier[])
    setExceptions((exRes.data ?? []) as unknown as Exception[])
    setLoading(false)
  }

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

  async function add() {
    const soldier = soldiers.find((s) => s.name === form.name)
    const reason = form.reason.trim()
    if (!soldier || !reason) return
    const ok = await run(() => supabase.from(tbl(company, 'Exceptions')).insert({
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

  const setUrti = (e: Exception, urti: boolean) =>
    run(() => supabase.from(tbl(company, 'Exceptions')).update({ type: urti ? 'URTI' : 'Report Sick' }).eq('id', e.id))
  const remove = (e: Exception) => run(() => supabase.from(tbl(company, 'Exceptions')).delete().eq('id', e.id))

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300'
  const who = (e: Exception) => {
    const s = soldierOf(e, idx)
    return s ? [s.four_d, s.rank, s.name].filter(Boolean).join(' ') : e.name
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Report Sick (RSI)</h2>
        <p className="text-xs text-gray-500">Entries go into the parade state under REPORT SICK and fall the soldier out of conducts.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">Date<input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-xs text-gray-500">Time<input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
        <SearchDropdown
          items={soldiers}
          value={form.name}
          getKey={(s) => s.name}
          getLabel={(s) => `${s.rank} ${s.name}`.trim()}
          matches={(s, q) => `${s.four_d ?? ''} ${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase())}
          renderOption={(s) => (
            <div className="flex gap-2">
              <span className="font-mono text-xs text-gray-400 w-12 shrink-0 pt-0.5">{s.rank}</span>
              <span className="font-medium text-gray-800">{s.name}</span>
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
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4" checked={form.urti} onChange={(e) => setForm({ ...form, urti: e.target.checked, urtiTouched: true })} />
          URTI
        </label>
        <button onClick={add} disabled={busy || !form.name || !form.reason.trim()} className="w-full py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl disabled:opacity-50">
          Add report sick
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-center py-6 text-sm text-gray-400">No one reported sick on this day.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">{who(e)}</div>
                <div className="text-xs text-gray-500 truncate">{e.reason}</div>
              </div>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" className="h-4 w-4" checked={isUrtiException(e)} disabled={busy} onChange={(ev) => setUrti(e, ev.target.checked)} />
                URTI
              </label>
              {delConfirm.isConfirming(e.id) ? (
                <>
                  <button className="px-2.5 py-1.5 text-xs bg-red-500 text-white rounded-lg" disabled={busy} onClick={() => delConfirm.resolve(e.id, () => remove(e))}>Delete</button>
                  <button className="px-2.5 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg" onClick={delConfirm.cancel}>Keep</button>
                </>
              ) : (
                <button className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg" onClick={() => delConfirm.request(e.id)}>Delete</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">RSI message</h3>
          <button onClick={copy} className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg">{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs whitespace-pre-wrap font-mono">{text}</pre>
      </div>
    </div>
  )
}
