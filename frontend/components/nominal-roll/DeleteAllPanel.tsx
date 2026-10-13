'use client'

import { useState } from 'react'
import type { Company } from '@/shared/companies'
import { signInCommander } from '@/backend/data/auth'
import type { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/fields'

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
    <div className="space-y-3 rounded-card border border-danger/30 bg-danger/5 p-4">
      <p className="text-sm text-danger font-medium">This will permanently delete all {count} personnel. Enter your commander password to confirm.</p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="password"
          placeholder="Commander password"
          aria-label="Commander password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') onCancel() }}
          autoFocus
          className="w-auto min-w-48 flex-1"
        />
        <Button variant="danger" onClick={confirm} disabled={deleting || !password}>{deleting ? '…' : 'Confirm'}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
      {authError && <p role="alert" className="text-xs text-danger">{authError}</p>}
    </div>
  )
}
