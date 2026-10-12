/**
 * Class list for a compact inline-edit input, red when invalid.
 * @param hasError Whether the field failed validation.
 * @param focusRing The company theme's focus ring class.
 * @param extra Extra classes, e.g. a min width.
 */
export function fieldInputClass(hasError: boolean, focusRing: string, extra = ''): string {
  const base = `border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 w-full ${extra}`.trim()
  return hasError ? `${base} border-red-500 ring-2 ring-red-500` : `${base} border-gray-300 ${focusRing}`
}

/** Red "Yes" button shown while a delete awaits confirmation. */
export const CONFIRM_BTN = 'inline-flex min-h-11 items-center px-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm md:min-h-8 md:px-2 md:text-xs'

/** Quiet icon button (edit ✎ / delete ✕); a full 44px tap target on phones. */
export const ICON_BTN = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 active:bg-gray-100 transition-colors text-base md:min-h-8 md:min-w-8'

/** Quiet icon button that turns red on hover, for destructive actions. */
export const ICON_BTN_DANGER = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:text-red-500 active:bg-red-50 transition-colors text-base md:min-h-8 md:min-w-8'
