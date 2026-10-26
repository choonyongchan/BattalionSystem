import type { Company } from '@/shared/companies'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'

/** A hand-marked absence ('out') or presence-despite-reason ('present') on one Overview date. */
export type OverviewMark = { date: string; key: string; kind: 'out' | 'present' }

/** Reads and writes a company's shared Overview marks. */
export class OverviewMarkRepository extends CompanyRepository {
  /** @param company Company whose marks to use. */
  constructor(company: Company) {
    super(company, 'OverviewMarks')
  }

  /** Lists the marks on one date. */
  async list(date: string): Promise<ListResult<OverviewMark>> {
    return rows<OverviewMark>(await this.select().eq('date', date))
  }

  /** Sets a mark, replacing any earlier one for the soldier. */
  async set(mark: OverviewMark): Promise<WriteResult> {
    return this.from().upsert(this.own(mark), { onConflict: 'company,date,key' })
  }

  /** Removes a mark. */
  async clear(date: string, key: string): Promise<WriteResult> {
    return this.from().delete().eq('company', this.company).eq('date', date).eq('key', key)
  }
}
