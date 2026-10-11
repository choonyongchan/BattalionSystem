import type { Exception } from '../supabase'
import type { Company } from '../companies'
import { exceptionType, soldierOf, type SoldierIndex } from '../exceptions/active'

/**
 * Report sick (RSI) message: who reported sick on a day, split URTI / NON-URTI.
 * Entries are ordinary 'Report Sick' exceptions, so the parade state and
 * conducts read them with no double entry; `type` carries the split.
 */

// ponytail: keyword heuristic for the default only; the URTI toggle overrides it per entry
const URTI_RE = /\b(urti|flu|cough\w*|sore\s*throat|phlegm|runny\s*nose|blocked\s*nose|sneez\w*|fever|cold)\b/i

export const isUrti = (reason: string): boolean => URTI_RE.test(reason)

export const isUrtiException = (e: Exception): boolean => exceptionType(e) === 'URTI'

/** "HQ COY" for Hercules (the battalion's HQ company), else "<NAME> COY". */
export const rsiCompanyLabel = (company: Company): string =>
  company === 'hercules' ? 'HQ COY' : `${company.toUpperCase()} COY`

const pad2 = (n: number) => String(n).padStart(2, '0')
const ddmmyy = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(2, 4)}`

function entryLines(e: Exception, n: number, idx: SoldierIndex): string[] {
  // Current rank and name off the roll, so a rename shows through
  const s = soldierOf(e, idx)
  const who = s ? [s.four_d, s.rank, s.name].filter(Boolean).join(' ') : e.name
  return [`S/N: ${pad2(n + 1)}`, `R/N: ${who}`, `REASON: ${e.reason ?? ''}`]
}

function section(title: string, entries: Exception[], idx: SoldierIndex): string[] {
  if (!entries.length) return [title, 'NIL']
  return [title, ...entries.flatMap((e, i) => [...(i ? [''] : []), ...entryLines(e, i, idx)])]
}

/** `time` is "HH:MM" or "HHMM". Entries print in the order given. */
export function generateRsiReport(date: string, time: string, company: Company, entries: Exception[], idx: SoldierIndex): string {
  const header = `${ddmmyy(date)} ${rsiCompanyLabel(company)} 40SAR ${time.replace(':', '')}HRS`
  return [
    header,
    ...section('URTI', entries.filter(isUrtiException), idx),
    '',
    ...section('NON-URTI', entries.filter((e) => !isUrtiException(e)), idx),
  ].join('\n')
}
