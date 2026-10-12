import type { Exception, MedicalReview } from '@/shared/types'
import { wordsRegex } from '@/shared/names'
import { exceptionType, soldierOf, type SoldierIndex } from '@/backend/domain/exceptions/active'
import { ddmmyy, pad2 } from '@/shared/dates'

/**
 * Report sick: RSI (inside camp), RSO (outside) and medical reviews. All three are
 * ordinary 'Report Sick' exceptions, so the parade state and conducts read them with
 * no double entry. `in_out` tells RSI (IN, or unset on older rows) from RSO (OUT);
 * `type` carries the URTI split and marks a 'Medical Review'.
 */

// ponytail: keyword heuristic for the default only; the URTI toggle overrides it per entry
/** True when a reason names any of the URTI keywords from Settings > Report Sick. */
export const isUrti = (reason: string, keywords: string[]): boolean => wordsRegex(keywords).test(reason)

/** True when a report sick is typed URTI. */
export const isUrtiException = (e: Exception): boolean => exceptionType(e) === 'URTI'

/** True for a medical review. */
export const isMedicalReview = (e: Exception): boolean => exceptionType(e) === 'Medical Review'

/** True for a report sick outside (RSO). */
export const isRso = (e: Exception): boolean => e.in_out === 'OUT' && !isMedicalReview(e)

/** True for a report sick inside (RSI); older rows without in/out count as RSI. */
export const isRsi = (e: Exception): boolean => !isRso(e) && !isMedicalReview(e)


/** "<rank> <name>" off the roll, so a rename shows through; else the stored name. */
function rankName(e: Exception, idx: SoldierIndex): string {
  const s = soldierOf(e, idx)
  return s ? `${s.rank} ${s.name}` : e.name
}

/** S/N, R/N and REASON lines for one report sick. */
function entryLines(e: Exception, n: number, idx: SoldierIndex): string[] {
  const s = soldierOf(e, idx)
  const who = s ? [s.four_d, s.rank, s.name].filter(Boolean).join(' ') : e.name
  return [`S/N: ${pad2(n + 1)}`, `R/N: ${who}`, `REASON: ${e.reason ?? ''}`]
}

/** A titled section of numbered entries; nothing when there are none. */
function section(title: string, entries: Exception[], idx: SoldierIndex): string[] {
  return entries.length ? [title, ...entries.flatMap((e, i) => [...(i ? [''] : []), ...entryLines(e, i, idx)])] : []
}

/**
 * RSI message; RSO and medical reviews are left out. `time` is "HH:MM" or "HHMM";
 * `headerLabel` is Settings > Report Sick, e.g. "HQ COY".
 * Empty sections are dropped, so a day with no RSI is the header alone.
 */
export function generateRsiReport(date: string, time: string, headerLabel: string, entries: Exception[], idx: SoldierIndex): string {
  const rsi = entries.filter(isRsi)
  const sections = [
    section('URTI', rsi.filter(isUrtiException), idx),
    section('NON-URTI', rsi.filter((e) => !isUrtiException(e)), idx),
  ].filter((s) => s.length)
  const header = `${ddmmyy(date)} ${headerLabel} 40SAR ${time.replace(':', '')}HRS`
  return [header, ...sections.flatMap((s, i) => [...(i ? [''] : []), ...s])].join('\n')
}

/** Medical review message, one numbered block per review, in the order given. */
export function generateMedicalReviewReport(
  reviews: { exception: Exception; review: MedicalReview }[], idx: SoldierIndex,
): string {
  const date = (d: string | null) => (d ? ddmmyy(d) : '- NIL')
  const blocks = reviews.map(({ exception: e, review: r }, i) => [
    `S/N: ${pad2(i + 1)}`,
    `Rank + Name: ${rankName(e, idx)}`,
    `Coy: ${r.coy}`,
    `NRIC: ${r.nric}`,
    `Diagnosis/Issue: ${e.reason ?? ''}`,
    `Date of most recent Medical Appointment: ${date(r.last_ma)}`,
    `Date of Next MA: ${date(r.next_ma)}`,
    `Memo (Yes/No): ${r.memo ? 'Yes' : 'No'}`,
    `Remarks/Requests: ${r.remarks?.trim() || 'NIL'}`,
  ].join('\n'))
  return ['*MEDICAL REVIEW*', blocks.join('\n\n') || 'NIL'].join('\n')
}
