'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/utils'

type Option<T> = T | { value: T; label: ReactNode }

/**
 * The one single-choice control: a pill track of options, used for radios, choice chips
 * and in-page sub-navigation alike. Each option is a real radio, so arrow keys and
 * screen readers work natively; it scrolls sideways when the options don't fit.
 */
export function Segmented<T extends string | number | boolean>({ label, value, onChange, options, size = 'md', className, ...aria }: {
  label?: ReactNode
  'aria-label'?: string
  value: T
  onChange: (value: T) => void
  options: readonly Option<T>[]
  size?: 'md' | 'sm'
  className?: string
}) {
  const name = useId()
  return (
    <fieldset className={cn('min-w-0', className)} {...aria}>
      {label && <legend className="mb-1 text-xs text-ink-60">{label}</legend>}
      <div className="flex gap-1 overflow-x-auto rounded-pill bg-hairline/60 p-1">
        {options.map((o) => {
          const opt = typeof o === 'object' ? o : { value: o, label: String(o) }
          return (
            <label key={String(opt.value)} className="relative flex flex-1">
              <input type="radio" name={name} className="peer absolute inset-0 cursor-pointer opacity-0" checked={opt.value === value} onChange={() => onChange(opt.value)} />
              <span className={cn(
                'flex flex-1 items-center justify-center rounded-pill whitespace-nowrap text-ink-80 transition-colors peer-hover:text-ink',
                'peer-checked:bg-white peer-checked:font-semibold peer-checked:text-ink',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-action-focus',
                size === 'md' ? 'min-h-9 px-3 text-sm' : 'min-h-7 px-2 text-xs',
              )}>
                {opt.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
