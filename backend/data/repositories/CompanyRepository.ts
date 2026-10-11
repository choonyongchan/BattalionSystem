import type { PostgrestError } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import { supabase, tbl } from '@/backend/data/client'

/** Outcome of a write: the Supabase error, or null on success. */
export type WriteResult = { error: PostgrestError | null }

/** Outcome of a read: rows (empty on failure) plus the Supabase error, if any. */
export type ListResult<T> = { data: T[]; error: PostgrestError | null }

/** Base for repositories over one per-company table, e.g. "Hercules_NominalRoll". */
export abstract class CompanyRepository {
  /**
   * @param company Company whose table this repository reads and writes.
   * @param table Table suffix after the company label, e.g. "NominalRoll".
   */
  constructor(protected readonly company: Company, private readonly table: string) {}

  /** Starts a query on this company's table. */
  protected from() {
    return supabase.from(tbl(this.company, this.table))
  }
}

/** Casts a raw Supabase list response into typed rows, defaulting to an empty list. */
export function rows<T>(res: { data: unknown; error: PostgrestError | null }): ListResult<T> {
  return { data: (res.data ?? []) as T[], error: res.error }
}
