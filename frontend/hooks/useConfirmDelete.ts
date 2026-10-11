import { useState } from 'react'

/** Two-click delete confirmation state: request, then resolve or cancel. */
export function useConfirmDelete<T extends string | number>() {
  const [confirming, setConfirming] = useState<T | null>(null)
  return {
    confirming,
    isConfirming: (id: T) => confirming === id,
    request:      (id: T) => setConfirming(id),
    resolve:      (id: T, fn: () => void) => { setConfirming(null); fn() },
    cancel:       () => setConfirming(null),
  }
}
