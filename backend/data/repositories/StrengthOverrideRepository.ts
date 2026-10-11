import type { Company } from '@/shared/companies'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'

/** A manual parade-state strength figure for one platoon and rank type. */
export interface StrengthOverride {
  platoon: string
  rank_type: string
  value: number
}

/** Reads and writes manual parade-state strength overrides. */
export class StrengthOverrideRepository extends CompanyRepository {
  /** @param company Company whose overrides to use. */
  constructor(company: Company) {
    super(company, 'StrengthOverride')
  }

  /** Lists every override. */
  async list(): Promise<ListResult<StrengthOverride>> {
    return rows<StrengthOverride>(await this.from().select('*'))
  }

  /** Sets an override value. */
  async upsert(row: StrengthOverride): Promise<WriteResult> {
    return this.from().upsert(row)
  }

  /** Clears the override for a platoon and rank type. */
  async remove(platoon: string, rankType: string): Promise<WriteResult> {
    return this.from().delete().eq('platoon', platoon).eq('rank_type', rankType)
  }
}
