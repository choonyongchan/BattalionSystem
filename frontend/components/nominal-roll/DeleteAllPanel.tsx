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
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
      <p className="text-sm text-red-700 font-medium">This will permanently delete all {count} personnel. Enter your commander password to confirm.</p>
      <div className="flex gap-2">
        <input
          type="password"
          placeholder="Commander password"
          aria-label="Commander password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') onCancel() }}
          autoFocus
          className="flex-1 border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <button
          onClick={confirm}
          disabled={deleting || !password}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
        >
          {deleting ? '…' : 'Confirm'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
      {authError && <p role="alert" className="text-xs text-red-600">{authError}</p>}
    </div>
  )
}
