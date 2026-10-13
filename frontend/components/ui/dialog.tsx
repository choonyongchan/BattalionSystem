'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/shared/utils'

const PLACEMENT = {
  center: 'm-auto w-[calc(100%-2rem)] max-w-lg rounded-card bg-white',
  right: 'my-0 mr-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-white',
  bottom: 'mx-0 mt-auto mb-0 w-full max-w-none rounded-t-card bg-pearl pb-[env(safe-area-inset-bottom)]',
}

/**
 * Modal on the native <dialog>: focus trap, Escape and the backdrop come free. Render it
 * only while open; Escape and a click on the backdrop call `onClose`.
 */
export function Dialog({ onClose, placement = 'center', className, children, ...aria }: {
  onClose: () => void
  placement?: keyof typeof PLACEMENT
  className?: string
  children: ReactNode
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      {...aria}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 text-ink backdrop:bg-black/30', PLACEMENT[placement], className)}
    >
      {/* Fills the box, so only a click on the backdrop itself closes */}
      <div className="min-h-full">{children}</div>
    </dialog>
  )
}
