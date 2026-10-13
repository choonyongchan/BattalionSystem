import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'danger-outline' | 'icon' | 'icon-danger'
export type ButtonSize = 'md' | 'sm'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-action text-white',
  secondary: 'border border-hairline bg-white text-ink-80 hover:bg-parchment',
  soft: 'bg-parchment text-ink-80 hover:bg-hairline',
  danger: 'bg-danger text-white',
  'danger-outline': 'border border-danger/30 bg-white text-danger hover:bg-danger/5',
  icon: 'text-ink-60 hover:text-ink active:bg-parchment',
  'icon-danger': 'text-ink-60 hover:text-danger active:bg-danger/5',
}

// md: the pill call to action; sm: the compact 8px utility button used in tables and toolbars
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 rounded-pill px-[22px] text-sm',
  sm: 'min-h-11 rounded-lg px-3 text-sm md:min-h-8 md:px-2.5 md:text-xs',
}
const ICON_SIZE = 'min-h-11 min-w-11 rounded-lg text-base md:min-h-8 md:min-w-8'

/**
 * Classes for the app's one button grammar; for links styled as buttons.
 * @param variant Colour role; icon variants are square and ignore size.
 * @param size md (pill) or sm (8px utility).
 * @param block Full width.
 */
export function buttonClass({ variant = 'primary', size = 'md', block = false }: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
} = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
    VARIANTS[variant],
    variant.startsWith('icon') ? ICON_SIZE : SIZES[size],
    block && 'w-full',
  )
}

/** The app button. Leaves `type` to the caller so form submits keep working. */
export function Button({ variant, size, block, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}) {
  return <button className={cn(buttonClass({ variant, size, block }), className)} {...props} />
}
