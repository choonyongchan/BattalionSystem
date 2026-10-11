'use client'

import { useState } from 'react'
import type { Conduct } from '@/lib/supabase'
import type { PlatoonBlock } from '@/lib/companies'
import {
  conductBlocks, conductDateRange, conductTimeRange, generateConductState, generatePlatoonConductState,
  needsDecision, type Participation,
} from '@/lib/conducts/conducts'

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
  const [copied, setCopied] = useState(false)

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

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const who = (p: Participation) => `${p.soldier.four_d ? `${p.soldier.four_d} ` : ''}${p.soldier.rank} ${p.soldier.name}`
  const small = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50'
  const time = conductTimeRange(conduct)

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {conductDateRange(conduct)}{time ? ` · ${time}HRS` : ''} · {parts.filter((p) => p.participating).length}/{parts.length} taking part
      </p>

      <div className="flex flex-wrap gap-1.5">
        {[{ key: 'ALL', label: 'ALL' }, ...blocks].map((b) => (
          <button
            key={b.key}
            onClick={() => setBlockKey(b.key)}
            className={`px-3 py-1 text-xs rounded-full border ${blockKey === b.key ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'}`}
          >{b.label}</button>
        ))}
      </div>
      <input
        type="search"
        placeholder="Search name or 4D…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
      />

      {pending.length > 0 && (
        <section className="border border-amber-300 bg-amber-50 rounded-2xl p-3 space-y-2">
          <h3 className="text-sm font-semibold text-amber-800">Needs a call ({pending.length})</h3>
          <p className="text-xs text-amber-700">LD / RMJ — falling out until a commander confirms.</p>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.soldier.id} className="flex items-center gap-2 bg-white rounded-xl p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{who(p)}</p>
                  <p className="text-xs text-gray-500">{p.reason}</p>
                </div>
                <button className={`${small} border-green-300 text-green-700 hover:bg-green-50`} disabled={busy} onClick={() => actions.decide(p.soldier.id!, true, null)}>✓ Can</button>
                <button className={`${small} border-red-300 text-red-700 hover:bg-red-50`} disabled={busy} onClick={() => actions.decide(p.soldier.id!, false, null)}>✗ Cannot</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Fall out – {out.length}</h3>
        <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
          {out.map((p) => (
            <li key={p.soldier.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{who(p)}</p>
                <p className="text-xs text-red-600">{p.reason}{p.kind === 'out-auto' ? ' · auto' : ''}</p>
              </div>
              {p.decision && (
                <button className={`${small} border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => actions.undo(p.decision!.id)}>Undo</button>
              )}
            </li>
          ))}
          {out.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">No one.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Taking part – {taking.length}</h3>
        <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
          {taking.map((p) => (
            <li key={p.soldier.id} className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{who(p)}</p>
                  {p.note && <p className="text-xs text-amber-700">{p.note}{p.kind === 'in-confirmed' ? ' · confirmed can' : ''}</p>}
                </div>
                {p.decision ? (
                  <button className={`${small} border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => actions.undo(p.decision!.id)}>Undo</button>
                ) : (
                  <button
                    className={`${small} border-red-200 text-red-600 hover:bg-red-50`}
                    disabled={busy || !p.soldier.id}
                    onClick={() => setFallingOut({ id: p.soldier.id!, reason: p.note ?? '' })}
                  >Fall out…</button>
                )}
              </div>
              {fallingOut && fallingOut.id === p.soldier.id && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={fallingOut.reason}
                    onChange={(e) => setFallingOut({ id: fallingOut.id, reason: e.target.value })}
                    placeholder="Reason (e.g. Duty)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    className={`${small} border-red-500 bg-red-500 text-white`}
                    disabled={busy}
                    onClick={async () => { await actions.decide(fallingOut.id, false, fallingOut.reason.trim() || null); setFallingOut(null) }}
                  >Fall out</button>
                  <button className={`${small} border-gray-200 text-gray-600`} onClick={() => setFallingOut(null)}>Cancel</button>
                </div>
              )}
            </li>
          ))}
          {taking.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">No one.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Conduct state – {block ? block.label : 'whole company'}
          </h3>
          <button onClick={copy} className="px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg">
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <pre className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs whitespace-pre-wrap font-mono">{text}</pre>
      </section>
    </div>
  )
}
