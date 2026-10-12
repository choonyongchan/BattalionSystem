// ISO dates ("YYYY-MM-DD") are calendar days: all math runs in UTC so the host timezone never shifts a day.

/** Returns today's date in Singapore as an ISO date (YYYY-MM-DD). */
export function todaySGDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}

/** Formats an ISO date for display, e.g. "05 Mar 26". */
export function toSGDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' })
}

/** Returns the ISO date `days` after `iso` (negative goes back). */
export function offsetDate(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole days from ISO date `a` to `b`. */
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000)

/** Returns the Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay()
  return offsetDate(iso, day === 0 ? -6 : 1 - day)
}

/** Returns the seven ISO dates (Mon–Sun) of the week containing `iso`. */
export function weekDates(iso: string): string[] {
  const monday = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => offsetDate(monday, i))
}

/** Splits an ISO date into a weekday ("Mon") and a day label ("05 Mar") for calendar headers. */
export function dayHeaderLabel(iso: string): { weekday: string; day: string } {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return {
    weekday: d.toLocaleDateString('en-SG', { weekday: 'short', timeZone: 'UTC' }),
    day: d.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
  }
}

/** Orders ISO dates ascending with nulls first; ISO strings sort as text. */
export function compareNullableISO(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return (a ? 1 : 0) - (b ? 1 : 0)
  return a < b ? -1 : a > b ? 1 : 0
}

/** Formats an ISO date (YYYY-MM-DD...) as DDMMYY, e.g. "2026-03-05" -> "050326". */
export const ddmmyy = (iso: string): string => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(2, 4)}`

/** Pads a number to two digits, e.g. 7 -> "07". */
export const pad2 = (n: number): string => String(n).padStart(2, '0')
