import type { PostgrestError } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import type { Conduct, ConductDecision } from '@/shared/types'
import { supabase, tbl } from '@/backend/data/client'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'

/** Editable fields of a conduct. */
export type ConductFields = Omit<Conduct, 'id'>

/** Reads and writes a company's conducts and the manual participation calls on them. */
export class ConductRepository extends CompanyRepository {
  /** @param company Company whose conducts to use. */
  constructor(company: Company) {
    super(company, 'Conducts')
  }

  /** Starts a query on the company's ConductDecisions table. */
  private decisions() {
    return supabase.from(tbl(this.company, 'ConductDecisions'))
  }

  /** Lists conducts by date, then start time. */
  async list(): Promise<ListResult<Conduct>> {
    return rows<Conduct>(await this.from().select('*').order('date').order('start_time'))
  }

  /** Creates a conduct and returns its new id. */
  async insert(fields: ConductFields): Promise<{ id: string | null; error: PostgrestError | null }> {
    const { data, error } = await this.from().insert(fields).select('id').single()
    return { id: (data as { id: string } | null)?.id ?? null, error }
  }

  /** Updates the conduct with `id`. */
  async update(id: string, fields: ConductFields): Promise<WriteResult> {
    return this.from().update(fields).eq('id', id)
  }

  /** Deletes a conduct; its decisions cascade. */
  async remove(id: string): Promise<WriteResult> {
    return this.from().delete().eq('id', id)
  }

  /** Lists every manual participation call. */
  async listDecisions(): Promise<ListResult<ConductDecision>> {
    return rows<ConductDecision>(await this.decisions().select('*'))
  }

  /** Records whether a soldier takes part in a conduct, replacing any earlier call. */
  async decide(conductId: string, soldierId: string, participating: boolean, reason: string | null): Promise<WriteResult> {
    return this.decisions().upsert(
      { conduct_id: conductId, soldier_id: soldierId, participating, reason, group_kind: null },
      { onConflict: 'conduct_id,soldier_id' },
    )
  }

  /** Records many calls at once, e.g. the groups seeded from the Overview. */
  async decideMany(conductId: string, calls: Omit<ConductDecision, 'id' | 'conduct_id'>[]): Promise<WriteResult> {
    return this.decisions().upsert(calls.map((c) => ({ ...c, conduct_id: conductId })), { onConflict: 'conduct_id,soldier_id' })
  }

  /** Deletes a manual call so the soldier falls back to the automatic rule. */
  async removeDecision(id: string): Promise<WriteResult> {
    return this.decisions().delete().eq('id', id)
  }
}
