'use client'

import { useState } from 'react'
import type { Company } from '@/shared/companies'
import { signInCommander } from '@/backend/data/auth'
import type { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'

/** Password-confirmed "delete every soldier" prompt. */
export default function DeleteAllPanel({ company, count, repo, onDone, onError, onCancel }: {
  company: Company
  count: number
  repo: SoldierRepository
  onDone: () => Promise<void>
  onError: (message: string) => void
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  /** Re-checks the password, then deletes every soldier. */
  async function confirm() {
    setDeleting(true)
    // Re-check the commander password: a wiped roll cannot be undone
    if (await signInCommander(company, password)) {
      setAuthError('Incorrect password')
      setDeleting(false)
      return
    }
    const { error } = await repo.removeAll()
    if (error) onError(error.message)
    else await onDone()
    onCancel()
  }

  return (
    <div className="bg-danger/5 border border-danger/30 rounded-card p-4 space-y-3">
      <p className="text-sm text-danger font-medium">This will permanently delete all {count} personnel. Enter your commander password to confirm.</p>
      <div className="flex gap-2">
        <input
          type="password"
          placeholder="Commander password"
          aria-label="Commander password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') onCancel() }}
          autoFocus
          className="flex-1 border border-danger/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger"
        />
        <button
          onClick={confirm}
          disabled={deleting || !password}
          className="px-4 py-2 bg-danger hover:bg-danger text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {deleting ? '…' : 'Confirm'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-hairline text-ink-80 text-sm font-medium rounded-lg hover:bg-parchment transition-colors">
          Cancel
        </button>
      </div>
      {authError && <p role="alert" className="text-xs text-danger">{authError}</p>}
    </div>
  )
}
