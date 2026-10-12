import Papa from 'papaparse'
import type { Soldier } from '@/shared/types'
import { VALID_RANKS } from '@/shared/ranks'

/** A CSV row that passed validation. */
export interface ParsedRow {
  rank: string
  name: string
  platoon: string
  fourD: string | null
  isOverwrite: boolean
}

/** One problem with one CSV row (1-based, as the spreadsheet numbers it). */
export interface RowError {
  row: number
  message: string
}

/** Rows to import, or every error; one error blocks the whole import. */
export interface ParseResult {
  valid: ParsedRow[]
  errors: RowError[]
}

/** Parses CSV text into rows of trimmed cells, skipping empty lines and stripping wrapping quotes. */
export function parseCSV(text: string): string[][] {
  const { data } = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
    transform: (v) => {
      const s = v.trim()
      return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s
    },
  })
  return data
}

/**
 * Validates CSV rows into soldiers to upsert, flagging bad rows and overwrites of existing names.
 * @param platoons Platoon keys the company accepts, HQ included.
 */
export function validateAndTransform(rows: string[][], existing: Soldier[], platoons: string[]): ParseResult {
  const validPlatoons = new Set(platoons)
  // Row 0 is the description/hint row from the Google Sheets template; row 1 is the header
  if (rows.length < 2) return { valid: [], errors: [{ row: 0, message: 'CSV is empty' }] }

  const header = rows[1].map((h) => h.toLowerCase())
  const required = ['4d', 'rank', 'name', 'platoon']
  const missing = required.filter((col) => !header.includes(col))
  if (missing.length > 0) {
    return { valid: [], errors: [{ row: 2, message: `Missing columns: ${missing.join(', ')}` }] }
  }

  const idx = {
    fourD: header.indexOf('4d'),
    rank: header.indexOf('rank'),
    name: header.indexOf('name'),
    platoon: header.indexOf('platoon'),
  }

  const existingNames = new Set(existing.map((s) => s.name.toUpperCase()))
  const seenInCSV = new Set<string>()
  const valid: ParsedRow[] = []
  const errors: RowError[] = []

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1
    const name = (row[idx.name] ?? '').trim().toUpperCase()
    const rank = (row[idx.rank] ?? '').trim()
    const platoon = (row[idx.platoon] ?? '').trim()
    const fourDRaw = (row[idx.fourD] ?? '').trim()

    if (name && seenInCSV.has(name)) {
      errors.push({ row: rowNum, message: `Duplicate name in CSV: ${name}` })
      continue
    }
    if (name) seenInCSV.add(name)

    const rowErrors: string[] = []
    if (!name) rowErrors.push('Name is empty')
    if (!VALID_RANKS.has(rank)) rowErrors.push(`"${rank}" is not a valid rank`)
    if (!validPlatoons.has(platoon)) rowErrors.push(`"${platoon}" is not a valid platoon`)
    if (fourDRaw && !/^\d{4}$/.test(fourDRaw)) rowErrors.push(`4D "${fourDRaw}" must be exactly 4 digits`)

    if (rowErrors.length > 0) {
      rowErrors.forEach((msg) => errors.push({ row: rowNum, message: msg }))
      continue
    }

    valid.push({
      rank,
      name,
      platoon,
      fourD: fourDRaw || null,
      isOverwrite: existingNames.has(name),
    })
  }

  // ponytail: all-or-nothing — one error blocks the whole import
  if (errors.length > 0) return { valid: [], errors }
  return { valid, errors }
}
