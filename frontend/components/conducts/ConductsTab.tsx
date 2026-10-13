'use client'

import { useMemo, useState } from 'react'
import { ConductRepository } from '@/backend/data/repositories/ConductRepository'
import type { Conduct } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { classifyConduct, conductDateRange, conductEnd, conductSoldiers, nearestConduct } from '@/backend/domain/conducts/conducts'
import { todaySGDate } from '@/shared/dates'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import { combine, useConductDecisions, useConducts, useExceptions, useSettingsQuery, useSoldiers, useWrite } from '@/frontend/hooks/queries'
import { Button } from '@/frontend/components/ui/button'
import { Field, Input } from '@/frontend/components/ui/fields'
import { Banner, Empty, Loading, PageHeader, Panel } from '@/frontend/components/ui/layout'
import { cn } from '@/shared/utils'
import ConductDetail from './ConductDetail'

type Form = { id: string | null; name: string; date: string; end_date: string; start_time: string; end_time: string }

/**
 * Conduct tracking: create a conduct, and for the one selected see who falls
 * out automatically (from exceptions), who needs a commander's call, and copy
 * the conduct state. Only manual calls are written (ConductDecisions).
 */
export default function ConductsTab({ company, companyLabel }: { company: Company; companyLabel: string }) {
  const today = todaySGDate()
  const soldiersQ = useSoldiers(company)
  const exceptionsQ = useExceptions(company)
  const conductsQ = useConducts(company)
  const decisionsQ = useConductDecisions(company)
  const settingsQ = useSettingsQuery(company)
  const { run, busy, error: writeError } = useWrite(company)
  const { loading, error: loadError } = combine(soldiersQ, exceptionsQ, conductsQ, decisionsQ, settingsQ)
  const error = writeError ?? loadError
  const conducts = conductsQ.data ?? []
  const settings = settingsQ.data
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [showPast, setShowPast] = useState(false)
  const delConfirm = useConfirmDelete<string>()
  const conductRepo = new ConductRepository(company)
  const upcoming = conducts.filter((c) => conductEnd(c) >= today)
  const past = conducts.filter((c) => conductEnd(c) < today).reverse()
  const selected =
    conducts.find((c) => c.id === selectedId) ?? nearestConduct(upcoming.length ? upcoming : conducts, new Date())

  const parts = useMemo(
    () => (selected && settings
      ? classifyConduct(selected, conductSoldiers(soldiersQ.data ?? [], settings.conducts.include_hq), exceptionsQ.data ?? [], decisionsQ.data ?? [], today, settings.conducts.needs_call_types)
      : []),
    [selected, settings, soldiersQ.data, exceptionsQ.data, decisionsQ.data, today],
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

  if (loading || !settings) return <Loading />

  /** Renders a selectable chip for one conduct. */
  const chip = (c: Conduct) => (
    <button
      key={c.id}
      onClick={() => { setSelectedId(c.id); setForm(null) }}
      aria-pressed={selected?.id === c.id}
      className={cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors', selected?.id === c.id ? 'border-transparent bg-action text-white' : 'border-hairline bg-white text-ink-80 hover:bg-parchment')}
    >
      <span className="font-medium">{c.name}</span>
      <span className={`block text-xs ${selected?.id === c.id ? 'text-ink-48' : 'text-ink-60'}`}>{conductDateRange(c)}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conducts"
        subtitle={`Troopers only. Fall-outs come from exceptions automatically; ${settings.conducts.needs_call_types.join(' / ') || 'nothing'} need a call.`}
        actions={
          <Button
            variant={form ? 'secondary' : 'primary'}
            onClick={() => setForm(form ? null : { id: null, name: '', date: today, end_date: '', start_time: '', end_time: '' })}
          >{form ? 'Cancel' : '+ New'}</Button>
        }
      />

      {error && <Banner>{error}</Banner>}

      {form && (
        <Panel className="space-y-3">
          <Field label="Conduct name">
            <Input placeholder="Conduct name (e.g. IPPT1)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Until (multi-day)"><Input type="date" value={form.end_date} min={form.date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
            <Field label="Start time"><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
            <Field label="End time"><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
          </div>
          <Button block onClick={saveConduct} disabled={busy || !form.name.trim() || !form.date}>
            {form.id ? 'Save conduct' : 'Create conduct'}
          </Button>
        </Panel>
      )}

      {conducts.length === 0 ? (
        <Empty>No conducts yet.</Empty>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">{upcoming.map(chip)}</div>
          {past.length > 0 && (
            <div>
              <button onClick={() => setShowPast(!showPast)} aria-expanded={showPast} className="min-h-11 text-xs text-ink-60 hover:text-ink-80 md:min-h-8">
                {showPast ? '▾' : '▸'} Past conducts ({past.length})
              </button>
              {showPast && <div className="flex flex-wrap gap-2 mt-2">{past.map(chip)}</div>}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="border-t border-hairline pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-lg font-semibold text-ink">{selected.name}</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setForm({
                id: selected.id, name: selected.name, date: selected.date, end_date: selected.end_date ?? '',
                start_time: selected.start_time?.slice(0, 5) ?? '', end_time: selected.end_time?.slice(0, 5) ?? '',
              })}
            >Edit</Button>
            {delConfirm.isConfirming(selected.id) ? (
              <>
                <Button variant="danger" size="sm" disabled={busy} onClick={() => delConfirm.resolve(() => deleteConduct(selected))}>Delete conduct</Button>
                <Button variant="soft" size="sm" onClick={delConfirm.cancel}>Keep</Button>
              </>
            ) : (
              <Button variant="danger-outline" size="sm" onClick={() => delConfirm.request(selected.id)}>Delete</Button>
            )}
          </div>
          <ConductDetail companyLabel={companyLabel} conduct={selected} parts={parts} platoons={settings.platoons} includeHQ={settings.conducts.include_hq} busy={busy} actions={actions} />
        </div>
      )}
    </div>
  )
}
