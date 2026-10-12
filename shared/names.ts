import type { Soldier } from './types'

// Duties that allow two names (e.g. "JOSHUA / CHOONYONG") store them joined by this separator.
export const DUTY_NAME_SEP = ' / '

// Sentinel name for a duty partner who is outside the nominal roll (e.g. a second Duty Clerk
// borrowed from another unit). Stored like a normal duty name so the roll soldier still gets
// their usual point share, but it's stripped from the Parade State output text.
export const EXTERNAL_DUTY_PERSON = '<EXTERNAL>'

/** Splits a stored duty name into its (one or two) names. */
export function splitDutyNames(name: string): string[] {
  return name.split(DUTY_NAME_SEP).map((n) => n.trim()).filter((n) => n !== '')
}

/** Prefixes a name with the soldier's rank when known. */
function displayOneName(name: string, soldiers: Soldier[]): string {
  const rank = soldiers.find(s => s.name === name)?.rank
  return rank ? `${rank} ${name}` : name
}

/** Rank-prefixed display of a (possibly two-name) duty name. */
export function displayName(name: string, soldiers: Soldier[]): string {
  return splitDutyNames(name).map((n) => displayOneName(n, soldiers)).join(DUTY_NAME_SEP)
}

/** Like displayName, but drops an EXTERNAL_DUTY_PERSON partner, who only counts for points. */
export function displayDutyName(name: string, soldiers: Soldier[]): string {
  const filtered = splitDutyNames(name).filter((n) => n !== EXTERNAL_DUTY_PERSON).join(DUTY_NAME_SEP)
  return displayName(filtered, soldiers)
}

/**
 * Case-insensitive whole-word match for any of `words`; spaces inside a word match any
 * whitespace ("sore throat" ~ "sore  throat"). Matches nothing when `words` is empty.
 */
export function wordsRegex(words: string[]): RegExp {
  const alts = words.map((w) => w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')).filter(Boolean)
  return alts.length ? new RegExp(`\\b(?:${alts.join('|')})\\b`, 'i') : /(?!)/
}
