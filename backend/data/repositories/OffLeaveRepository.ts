import type { Company } from '@/shared/companies'
import type { OffLeave } from '@/shared/types'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'

/** Reads and writes each soldier's off and leave balances. */
export class OffLeaveRepository extends CompanyRepository {
  /** @param company Company whose balances to use. */
  constructor(company: Company) {
    super(company, 'OffLeave')
  }

  /** Lists every balance row. */
  async list(): Promise<ListResult<OffLeave>> {
    return rows<OffLeave>(await this.select())
  }

  /** Inserts or replaces a soldier's balance row. */
  async upsert(record: OffLeave): Promise<WriteResult> {
    return this.from().upsert(this.own(record), { onConflict: 'company,name' })
  }

  /** Overwrites a soldier's off and leave balances. */
  async update(name: string, off: number, leave: number): Promise<WriteResult> {
    return this.from().update({ off, leave }).eq('company', this.company).eq('name', name)
  }

  /** Deletes a soldier's balance row. */
  async remove(name: string): Promise<WriteResult> {
    return this.from().delete().eq('company', this.company).eq('name', name)
  }
}
