export interface ExceptionRowKey {
  dutyType: string
  dayType: string
}

/** True if two or more rows share the same duty type + day type combination. */
export function hasDuplicateExceptionRows(rows: ExceptionRowKey[]): boolean {
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.dutyType}:${row.dayType}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}
