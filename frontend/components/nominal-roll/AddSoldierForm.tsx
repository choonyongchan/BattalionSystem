'use client'

import { useState } from 'react'
import type { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import RankDropdown from './RankDropdown'
import { THEME } from '@/frontend/theme'

/** Form for adding one soldier; names are stored upper-case. */
export default function AddSoldierForm({ platoons, repo, onAdded, onError }: {
  platoons: string[]
  repo: SoldierRepository
  onAdded: () => Promise<void>
  onError: (message: string) => void
}) {
  const [form, setForm] = useState({ rank: 'PTE', name: '', platoon: '' })
  const [submitting, setSubmitting] = useState(false)
  const inputClass = `w-full border border-hairline rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 ${THEME.focusRing}`

  /** Inserts the soldier; on success clears the form and notifies the parent. */
  async function add() {
    if (!form.name.trim() || !form.platoon) return
    setSubmitting(true)
    const { error } = await repo.insert({ rank: form.rank, name: form.name.trim().toUpperCase(), platoon: form.platoon })
    if (error) onError(error.message)
    else {
      setForm({ rank: 'PTE', name: '', platoon: '' })
      await onAdded()
    }
    setSubmitting(false)
  }

  return (
    <div className="bg-parchment border border-hairline rounded-card p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs text-ink-60 mb-1">Rank</label>
          <RankDropdown value={form.rank} onChange={(rank) => setForm({ ...form, rank })} inputClass={inputClass} />
        </div>
        <div>
          <label htmlFor="add-soldier-name" className="block text-xs text-ink-60 mb-1">Full Name</label>
          <input
            id="add-soldier-name"
            type="text"
            placeholder="TAN AH KOW"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>
        <div>
          <label htmlFor="add-soldier-platoon" className="block text-xs text-ink-60 mb-1">Platoon</label>
          <select id="add-soldier-platoon" value={form.platoon} onChange={(e) => setForm({ ...form, platoon: e.target.value })} className={inputClass}>
            <option value="">Select platoon</option>
            {platoons.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <button
        onClick={add}
        disabled={submitting || !form.name.trim() || !form.platoon}
        className={`w-full py-3 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      >
        {submitting ? 'Adding...' : 'Add Soldier'}
      </button>
    </div>
  )
}
