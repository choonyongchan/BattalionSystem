'use client'

import { useState } from 'react'
import type { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import RankDropdown from './RankDropdown'
import { Button } from '@/frontend/components/ui/button'
import { Field, Input, Select, inputClass } from '@/frontend/components/ui/fields'
import { Panel } from '@/frontend/components/ui/layout'

/** Form for adding one soldier; names are stored upper-case. */
export default function AddSoldierForm({ platoons, repo, onAdded, onError }: {
  platoons: string[]
  repo: SoldierRepository
  onAdded: () => Promise<void>
  onError: (message: string) => void
}) {
  const [form, setForm] = useState({ rank: 'PTE', name: '', platoon: '' })
  const [submitting, setSubmitting] = useState(false)

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
    <Panel>
      <Field label="Rank">
        <RankDropdown value={form.rank} onChange={(rank) => setForm({ ...form, rank })} inputClass={inputClass()} />
      </Field>
      <Field label="Full Name">
        <Input
          type="text"
          placeholder="TAN AH KOW"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
      </Field>
      <Field label="Platoon">
        <Select value={form.platoon} onChange={(e) => setForm({ ...form, platoon: e.target.value })}>
          <option value="">Select platoon</option>
          {platoons.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </Field>
      <Button block onClick={add} disabled={submitting || !form.name.trim() || !form.platoon}>
        {submitting ? 'Adding...' : 'Add Soldier'}
      </Button>
    </Panel>
  )
}
