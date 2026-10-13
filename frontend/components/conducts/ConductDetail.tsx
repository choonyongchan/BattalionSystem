'use client'

import { useState } from 'react'
import type { Conduct } from '@/shared/types'
import type { PlatoonBlock } from '@/shared/companies'
import {
  conductBlocks, conductDateRange, conductTimeRange, generateConductState, generatePlatoonConductState,
  needsDecision, type Participation,
} from '@/backend/domain/conducts/conducts'
import MessageBox from '@/frontend/components/shared/MessageBox'
import { Button } from '@/frontend/components/ui/button'
import { SearchInput, inputClass } from '@/frontend/components/ui/fields'
import { SectionTitle } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'

/** The writes a conduct's calls make. */
export interface DecisionActions {
  decide: (soldierId: string, participating: boolean, reason: string | null) => Promise<void>
  undo: (decisionId: string) => Promise<void>
}

/**
 * One conduct: who needs a call, who's falling out, who's taking part, and the
 * copyable conduct state for the whole company or one block.
 */
export default function ConductDetail({ companyLabel, conduct, parts, platoons, includeHQ, busy, actions }: {
  companyLabel: string
  conduct: Conduct
  parts: Participation[]
  platoons: PlatoonBlock[]
  includeHQ: boolean
  busy: boolean
  actions: DecisionActions
}) {
  const blocks = conductBlocks(platoons, includeHQ)
  const [blockKey, setBlockKey] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [fallingOut, setFallingOut] = useState<{ id: string; reason: string } | null>(null)


  const q = search.trim().toLowerCase()
  const shown = parts.filter((p) =>
    (blockKey === 'ALL' || p.soldier.platoon === blockKey) &&
    (!q || p.soldier.name.toLowerCase().includes(q) || (p.soldier.four_d ?? '').toLowerCase().includes(q)),
  )
  const pending = needsDecision(shown)
  const out = shown.filter((p) => !p.participating && p.kind !== 'out-default')
  const taking = shown.filter((p) => p.participating)

  const block = blocks.find((b) => b.key === blockKey)
  const text = block
    ? generatePlatoonConductState(conduct, parts, block)
    : generateConductState(companyLabel, conduct, parts, platoons, includeHQ)


  /** Formats a participant as "<4D> <rank> <name>". */
  const who = (p: Participation) => `${p.soldier.four_d ? `${p.soldier.four_d} ` : ''}${p.soldier.rank} ${p.soldier.name}`
  const time = conductTimeRange(conduct)

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-60">
        {conductDateRange(conduct)}{time ? ` · ${time}HRS` : ''} · {parts.filter((p) => p.participating).length}/{parts.length} taking part
      </p>

      <Segmented
        aria-label="Block"
        value={blockKey}
        onChange={setBlockKey}
        options={[{ value: 'ALL', label: 'ALL' }, ...blocks.map((b) => ({ value: b.key, label: b.label }))]}
      />
      <SearchInput
        placeholder="Search name or 4D…"
        aria-label="Search conduct"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {pending.length > 0 && (
        <section className="space-y-2 rounded-card border border-warning/40 bg-warning/10 p-3">
          <SectionTitle className="mb-0 text-warning">Needs a call ({pending.length})</SectionTitle>
          <p className="text-xs text-warning">Falling out until a commander confirms.</p>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.soldier.id} className="flex items-center gap-2 bg-white rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{who(p)}</p>
                  <p className="text-xs text-ink-60">{p.reason}</p>
                </div>
                <Button variant="secondary" size="sm" className="border-success/40 text-success hover:bg-success/5" disabled={busy} onClick={() => actions.decide(p.soldier.id!, true, null)}>✓ Can</Button>
                <Button variant="danger-outline" size="sm" disabled={busy} onClick={() => actions.decide(p.soldier.id!, false, null)}>✗ Cannot</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle className="mb-0">Fall out – {out.length}</SectionTitle>
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
          {out.map((p) => (
            <li key={p.soldier.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink">{who(p)}</p>
                <p className="text-xs text-danger">{p.reason}{p.kind === 'out-auto' ? ' · auto' : ''}</p>
              </div>
              {p.decision && (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => actions.undo(p.decision!.id)}>Undo</Button>
              )}
            </li>
          ))}
          {out.length === 0 && <li className="px-3 py-3 text-sm text-ink-60">No one.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <SectionTitle className="mb-0">Taking part – {taking.length}</SectionTitle>
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
          {taking.map((p) => (
            <li key={p.soldier.id} className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">{who(p)}</p>
                  {p.note && <p className="text-xs text-warning">{p.note}{p.kind === 'in-confirmed' ? ' · confirmed can' : ''}</p>}
                </div>
                {p.decision ? (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => actions.undo(p.decision!.id)}>Undo</Button>
                ) : (
                  <Button
                    variant="danger-outline"
                    size="sm"
                    disabled={busy || !p.soldier.id}
                    onClick={() => setFallingOut({ id: p.soldier.id!, reason: p.note ?? '' })}
                  >Fall out…</Button>
                )}
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

      <MessageBox title={`Conduct state – ${block ? block.label : 'whole company'}`} text={text} />
    </div>
  )
}
