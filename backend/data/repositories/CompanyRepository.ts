import type { PostgrestError } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import { supabase } from '@/backend/data/client'

/** Outcome of a write: the Supabase error, or null on success. */
export type WriteResult = { error: PostgrestError | null }

/** Outcome of a read: rows (empty on failure) plus the Supabase error, if any. */
export type ListResult<T> = { data: T[]; error: PostgrestError | null }

/** Base for repositories over one shared table, e.g. "NominalRoll", scoped to a company by its `company` column. */
export abstract class CompanyRepository {
  /**
   * @param company Company whose rows this repository reads and writes.
   * @param table Table name, e.g. "NominalRoll".
   */
  constructor(protected readonly company: Company, private readonly table: string) {}

  /** Starts a query on the table; filter with `.eq('company', ...)` or write through `own`. */
  protected from() {
    return supabase.from(this.table)
  }

  /** Reads this company's rows. */
  protected select() {
    return this.from().select('*').eq('company', this.company)
  }

  /** Stamps the company on a row to write; `rows.map(this.own)` for several. */
  protected own = <T extends object>(row: T) => ({ ...row, company: this.company })
}

/** Casts a raw Supabase list response into typed rows, defaulting to an empty list. */
export function rows<T>(res: { data: unknown; error: PostgrestError | null }): ListResult<T> {
  return { data: (res.data ?? []) as T[], error: res.error }
}
