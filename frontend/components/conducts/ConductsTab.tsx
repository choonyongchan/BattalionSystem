'use client'

import { useEffect, useMemo, useState } from 'react'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { ConductRepository } from '@/backend/data/repositories/ConductRepository'
import type { Conduct, ConductDecision, Exception, Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { PARADE_CONFIG } from '@/shared/companies'
import { classifyConduct, conductDateRange, conductEnd, conductIncludesHQ, conductSoldiers, nearestConduct } from '@/backend/domain/conducts/conducts'
import { todaySGDate } from '@/shared/dates'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import ConductDetail from './ConductDetail'

type Form = { id: string | null; name: string; date: string; end_date: string; start_time: string; end_time: string }

/**
 * Conduct tracking: create a conduct, and for the one selected see who falls
 * out automatically (from exceptions), who needs a commander's call, and copy
 * the conduct state. Only manual calls are written (ConductDecisions).
 */
export default function ConductsTab({ company, companyLabel }: { company: Company; companyLabel: string }) {
  const today = todaySGDate()
  const platoons = PARADE_CONFIG[company].platoons
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [conducts, setConducts] = useState<Conduct[]>([])
  const [decisions, setDecisions] = useState<ConductDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [showPast, setShowPast] = useState(false)
  const delConfirm = useConfirmDelete<string>()
  const conductRepo = new ConductRepository(company)

  useEffect(() => { load() }, [company])

  /** Loads the roll, exceptions, conducts and decisions for the company. */
  async function load() {
    const [rollRes, exRes, cRes, dRes] = await Promise.all([
      new SoldierRepository(company).list(),
      new ExceptionRepository(company).list(),
      conductRepo.list(),
      conductRepo.listDecisions(),
    ])
    const err = rollRes.error ?? exRes.error ?? cRes.error ?? dRes.error
    if (err) setError(err.message)
    setSoldiers(rollRes.data)
    setExceptions(exRes.data)
    setConducts(cRes.data)
    setDecisions(dRes.data)
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

  const upcoming = conducts.filter((c) => conductEnd(c) >= today)
  const past = conducts.filter((c) => conductEnd(c) < today).reverse()
  const selected =
    conducts.find((c) => c.id === selectedId) ?? nearestConduct(upcoming.length ? upcoming : conducts, new Date())

  const parts = useMemo(
    () => (selected ? classifyConduct(selected, conductSoldiers(company, soldiers), exceptions, decisions, today) : []),
    [selected, company, soldiers, exceptions, decisions, today],
  )

  /** Creates or updates the conduct in the form, then selects it. */
  async function saveConduct() {
    if (!form || !form.name.trim() || !form.date) return
    const row = {
      name: form.name.trim(),
      date: form.date,
      end_date: form.end_date && form.end_date !== form.date ? form.end_date : null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    }
    const ok = await run(async () => {
      if (form.id) return conductRepo.update(form.id, row)
      const res = await conductRepo.insert(row)
      if (res.id) setSelectedId(res.id)
      return res
    })
    if (ok) setForm(null)
  }

  /** Deletes a conduct and clears the selection. */
  const deleteConduct = (c: Conduct) => run(() => conductRepo.remove(c.id)).then(() => setSelectedId(null))

  const actions = {
    decide: async (soldierId: string, participating: boolean, reason: string | null) => {
      if (!selected) return
      await run(() => conductRepo.decide(selected.id, soldierId, participating, reason))
    },
    undo: async (decisionId: string) => {
      await run(() => conductRepo.removeDecision(decisionId))
    },
  }

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300'
  /** Renders a selectable chip for one conduct. */
  const chip = (c: Conduct) => (
    <button
      key={c.id}
      onClick={() => { setSelectedId(c.id); setForm(null) }}
      className={`px-3 py-2 text-left rounded-xl border text-sm ${selected?.id === c.id ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
    >
      <span className="font-medium">{c.name}</span>
      <span className={`block text-xs ${selected?.id === c.id ? 'text-gray-300' : 'text-gray-400'}`}>{conductDateRange(c)}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Conducts</h2>
          <p className="text-xs text-gray-500">Fall-outs come from exceptions automatically; LD / RMJ need a call.</p>
        </div>
        <button
          onClick={() => setForm(form ? null : { id: null, name: '', date: today, end_date: '', start_time: '', end_time: '' })}
          className="px-4 py-3 bg-gray-800 text-white text-sm font-medium rounded-xl"
        >{form ? 'Cancel' : '+ New'}</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {form && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
          <input className={input} placeholder="Conduct name (e.g. IPPT1)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">Date<input type="date" className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="text-xs text-gray-500">Until (multi-day)<input type="date" className={input} value={form.end_date} min={form.date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
            <label className="text-xs text-gray-500">Start time<input type="time" className={input} value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></label>
            <label className="text-xs text-gray-500">End time<input type="time" className={input} value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></label>
          </div>
          <button onClick={saveConduct} disabled={busy || !form.name.trim() || !form.date} className="w-full py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl disabled:opacity-50">
            {form.id ? 'Save conduct' : 'Create conduct'}
          </button>
        </div>
      )}

      {conducts.length === 0 ? (
        <p className="text-center py-12 text-sm text-gray-400">No conducts yet.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">{upcoming.map(chip)}</div>
          {past.length > 0 && (
            <div>
              <button onClick={() => setShowPast(!showPast)} className="text-xs text-gray-500 hover:text-gray-700">
                {showPast ? '▾' : '▸'} Past conducts ({past.length})
              </button>
              {showPast && <div className="flex flex-wrap gap-2 mt-2">{past.map(chip)}</div>}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-lg font-semibold text-gray-900">{selected.name}</h3>
            <button
              onClick={() => setForm({
                id: selected.id, name: selected.name, date: selected.date, end_date: selected.end_date ?? '',
                start_time: selected.start_time?.slice(0, 5) ?? '', end_time: selected.end_time?.slice(0, 5) ?? '',
              })}
              className="px-2.5 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg"
            >Edit</button>
            {delConfirm.isConfirming(selected.id) ? (
              <>
                <button className="px-2.5 py-1.5 text-xs bg-red-500 text-white rounded-lg" disabled={busy} onClick={() => delConfirm.resolve(() => deleteConduct(selected))}>Delete conduct</button>
                <button className="px-2.5 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg" onClick={delConfirm.cancel}>Keep</button>
              </>
            ) : (
              <button className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg" onClick={() => delConfirm.request(selected.id)}>Delete</button>
            )}
          </div>
          <ConductDetail companyLabel={companyLabel} conduct={selected} parts={parts} platoons={platoons} includeHQ={conductIncludesHQ(company)} busy={busy} actions={actions} />
        </div>
      )}
    </div>
  )
}
