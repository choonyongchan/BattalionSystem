import type { Company } from '@/shared/companies'
import type { DutyEntry } from '@/shared/types'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'

/** Reads and writes a company's duty roster. */
export class DutyRepository extends CompanyRepository {
  /** @param company Company whose duty roster to use. */
  constructor(company: Company) {
    super(company, 'Duty')
  }

  /** Lists all duties, or only those dated within [from, to] (ISO dates, inclusive). */
  async list(from?: string, to?: string): Promise<ListResult<DutyEntry>> {
    const q = this.from().select('*')
    return rows<DutyEntry>(await (from && to ? q.gte('date', from).lte('date', to) : q))
  }

  /** Lists duties on one ISO date. */
  async listOn(date: string): Promise<ListResult<DutyEntry>> {
    return rows<DutyEntry>(await this.from().select('*').eq('date', date))
  }

  /** Sets who holds a duty on a date. */
  async upsert(entry: DutyEntry): Promise<WriteResult> {
    return this.from().upsert(entry)
  }

  /** Clears a duty on a date. */
  async remove(dutyType: string, date: string): Promise<WriteResult> {
    return this.from().delete().eq('duty_type', dutyType).eq('date', date)
  }
}
