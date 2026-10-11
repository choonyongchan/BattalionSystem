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
export const CONFIRM_BTN = 'px-2 py-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm'

/** Quiet icon button (edit ✎ / delete ✕). */
export const ICON_BTN = 'text-gray-400 hover:text-gray-600 transition-colors text-base px-2 py-1'

/** Quiet icon button that turns red on hover, for destructive actions. */
export const ICON_BTN_DANGER = 'text-gray-400 hover:text-red-500 transition-colors text-base px-2 py-1'
