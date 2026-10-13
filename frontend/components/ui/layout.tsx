import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/utils'

/** A tab's heading row: title, a one-line summary and optional actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Heading for a block inside a tab. */
export function SectionTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('mb-2 text-sm font-semibold text-ink', className)} {...props} />
}

/** White surface with a hairline border; content blocks and tables. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-hairline bg-white', className)} {...props} />
}

/** Pale-amber surface for an add/edit form. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-4 rounded-card border border-hairline bg-parchment p-4', className)} {...props} />
}

const TONES = {
  error: 'border-danger/30 bg-danger/5 text-danger',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  success: 'border-success/30 bg-success/5 text-success',
}

/** Inline status message; errors are announced as alerts, the rest politely. */
export function Banner({ tone = 'error', className, children }: { tone?: keyof typeof TONES; className?: string; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', TONES[tone], className)}>
      {children}
    </div>
  )
}

/** Placeholder while a tab's data loads. */
export function Loading({ className }: { className?: string }) {
  return <div role="status" className={cn('py-8 text-center text-sm text-ink-60', className)}>Loading...</div>
}

/** "Nothing here" message for an empty list. */
export function Empty({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('py-12 text-center text-sm text-ink-60', className)}>{children}</div>
}

/** Small pale-amber tag, e.g. an exception's scope. */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('inline-block whitespace-nowrap rounded-lg bg-parchment px-2 py-0.5 text-xs font-medium text-ink-80', className)}>{children}</span>
}

/** A removable tag in a picked-items list. */
export function Chip({ onRemove, removeLabel, children }: { onRemove: () => void; removeLabel: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-parchment py-1 pr-1 pl-2 text-xs text-ink-80">
      {children}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="inline-flex size-6 items-center justify-center rounded-md text-ink-60 hover:text-danger">×</button>
    </span>
  )
}
