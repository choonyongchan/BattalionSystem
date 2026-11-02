'use client'

import { useState } from 'react'
import type { Conduct } from '@/shared/types'
import { conductDateRange, conductTimeRange, generateConductState, inCamp, type Participation } from '@/backend/domain/conducts/conducts'
import MessageBox from '@/frontend/components/shared/MessageBox'
import { Button } from '@/frontend/components/ui/button'
import { SearchInput, inputClass } from '@/frontend/components/ui/fields'
import { SectionTitle } from '@/frontend/components/ui/layout'

/** The writes a conduct's calls make. */
export interface DecisionActions {
  decide: (soldierId: string, participating: boolean, reason: string | null) => Promise<void>
}

/**
 * One conduct: who's taking part, who's fallen out, who's out of camp, and the
 * copyable conduct state.
 */
export default function ConductDetail({ companyLabel, conduct, parts, busy, actions }: {
  companyLabel: string
  conduct: Conduct
  parts: Participation[]
  busy: boolean
  actions: DecisionActions
}) {
  const [search, setSearch] = useState('')
  const [fallingOut, setFallingOut] = useState<{ id: string; reason: string } | null>(null)


  const q = search.trim().toLowerCase()
  const shown = parts.filter((p) =>
    (!q || p.soldier.name.toLowerCase().includes(q) || (p.soldier.four_d ?? '').toLowerCase().includes(q)),
  )
  const out = shown.filter((p) => p.kind === 'fall-out')
  const away = shown.filter((p) => !inCamp(p))
  const taking = shown.filter((p) => p.kind === 'in')
  const text = generateConductState(companyLabel, conduct, parts)


  /** Formats a participant as "<4D> <rank> <name>". */
  const who = (p: Participation) => `${p.soldier.four_d ? `${p.soldier.four_d} ` : ''}${p.soldier.rank} ${p.soldier.name}`
  const time = conductTimeRange(conduct)

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-60">
        {conductDateRange(conduct)}{time ? ` · ${time}HRS` : ''} · {parts.filter((p) => p.kind === 'in').length}/{parts.filter(inCamp).length} taking part
      </p>

      <SearchInput
        placeholder="Search name or 4D…"
        aria-label="Search conduct"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <section className="space-y-2">
        <SectionTitle className="mb-0">Participating – {taking.length}</SectionTitle>
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
          {taking.map((p) => (
            <li key={p.soldier.id} className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">{who(p)}</p>
                </div>
                <Button
                  variant="danger-outline"
                  size="sm"
                  disabled={busy || !p.soldier.id}
                  onClick={() => setFallingOut({ id: p.soldier.id!, reason: '' })}
                >Fall out…</Button>
              </div>
              {fallingOut && fallingOut.id === p.soldier.id && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={fallingOut.reason}
                    onChange={(e) => setFallingOut({ id: fallingOut.id, reason: e.target.value })}
                    placeholder="Reason (e.g. Duty)"
                    aria-label="Fall-out reason"
                    className={inputClass({ compact: true }) + ' flex-1'}
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={async () => { await actions.decide(fallingOut.id, false, fallingOut.reason.trim() || null); setFallingOut(null) }}
                  >Fall out</Button>
                  <Button variant="secondary" size="sm" onClick={() => setFallingOut(null)}>Cancel</Button>
                </div>
              )}
            </li>
          ))}
          {taking.length === 0 && <li className="px-3 py-3 text-sm text-ink-60">No one.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <SectionTitle className="mb-0">Fall out – {out.length}</SectionTitle>
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
          {out.map((p) => (
            <li key={p.soldier.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink">{who(p)}</p>
                <p className="text-xs text-danger">{p.reason}</p>
              </div>
              <ParticipateButton p={p} busy={busy} actions={actions} />
            </li>
          ))}
          {out.length === 0 && <li className="px-3 py-3 text-sm text-ink-60">No one.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <SectionTitle className="mb-0">Out of camp – {away.length}</SectionTitle>
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
          {away.map((p) => (
            <li key={p.soldier.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink">{who(p)}</p>
                <p className="text-xs text-ink-60">{p.reason}</p>
              </div>
              <ParticipateButton p={p} busy={busy} actions={actions} />
            </li>
          ))}
          {away.length === 0 && <li className="px-3 py-3 text-sm text-ink-60">No one.</li>}
        </ul>
      </section>

      <MessageBox title="Conduct state" text={text} />
    </div>
  )
}

/** Calls a soldier in to take part, e.g. a fall-out or someone out of camp. */
function ParticipateButton({ p, busy, actions }: { p: Participation; busy: boolean; actions: DecisionActions }) {
  return (
    <Button variant="secondary" size="sm" className="border-success/40 text-success hover:bg-success/5" disabled={busy || !p.soldier.id} onClick={() => actions.decide(p.soldier.id!, true, null)}>
      ✓ Participate
    </Button>
  )
}
