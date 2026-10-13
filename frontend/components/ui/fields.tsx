import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/shared/utils'

type FieldStyle = { compact?: boolean; error?: boolean }

/**
 * Classes for every text-like field (input, select, search combobox).
 * @param compact The small inline-edit size used inside table rows.
 * @param error Red when the field failed validation.
 */
export function inputClass({ compact = false, error = false }: FieldStyle = {}): string {
  return cn(
    'w-full rounded-lg border bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-action-focus',
    'disabled:cursor-not-allowed disabled:bg-parchment disabled:opacity-60',
    compact ? 'min-w-[6rem] px-2 py-1' : 'min-h-11 px-3 py-2',
    error ? 'border-danger ring-2 ring-danger' : 'border-hairline',
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldStyle

/** Native text/date/time/number input. */
export function Input({ compact, error, className, ...props }: InputProps) {
  return <input className={cn(inputClass({ compact, error }), className)} {...props} />
}

/** Native select. */
export function Select({ compact, error, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & FieldStyle) {
  return <select className={cn(inputClass({ compact, error }), className)} {...props} />
}

/** Pill search box for filtering a list. */
export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="search"
      className={cn('min-h-11 w-full rounded-pill border border-hairline bg-white px-5 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus', className)}
      {...props}
    />
  )
}

/** Native checkbox in the accent colour. */
export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn('h-5 w-5 shrink-0 cursor-pointer accent-action disabled:cursor-default', className)} {...props} />
}

/** On/off toggle: a native checkbox drawn as a switch. */
export function Switch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        'relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-pill bg-ink-48/50 transition-colors checked:bg-action disabled:cursor-not-allowed disabled:opacity-50',
        'before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Label above a single control, with optional required mark, hint and error.
 * Wraps the control in the label, so clicking the text focuses it.
 */
export function Field({ label, required, hint, error, className, children }: {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-60">
          {label}
          {required && <span aria-hidden className="text-danger"> *</span>}
        </span>
        {children}
      </label>
      {hint && <p className="mt-1 text-xs text-ink-60">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

/** A checkbox or switch with its label on the right. */
export function CheckField({ label, className, children }: { label: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-80', className)}>
      {children}
      {label}
    </label>
  )
}
