import type { Company } from '@/shared/companies'
import type { Soldier } from '@/shared/types'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'

/** Editable fields of a nominal roll row. */
export type SoldierFields = Pick<Soldier, 'rank' | 'name' | 'platoon'> & Partial<Pick<Soldier, 'four_d' | 'on_strength' | 'bunk'>>

/** Reads and writes a company's nominal roll. */
export class SoldierRepository extends CompanyRepository {
  /** @param company Company whose nominal roll to use. */
  constructor(company: Company) {
    super(company, 'NominalRoll')
  }

  /** Lists every soldier, optionally ordered by platoon. */
  async list(orderByPlatoon = false): Promise<ListResult<Soldier>> {
    const q = this.from().select('*')
    return rows<Soldier>(await (orderByPlatoon ? q.order('platoon') : q))
  }

  /** Adds one soldier. */
  async insert(soldier: SoldierFields): Promise<WriteResult> {
    return this.from().insert(soldier)
  }

  /** Inserts or replaces soldiers matched by name (bulk import). */
  async upsertMany(soldiers: SoldierFields[]): Promise<WriteResult> {
    return this.from().upsert(soldiers, { onConflict: 'name' })
  }

  /** Updates the soldier currently named `name`. */
  async update(name: string, patch: Partial<SoldierFields>): Promise<WriteResult> {
    return this.from().update(patch).eq('name', name)
  }

  /** Deletes the soldier named `name`. */
  async remove(name: string): Promise<WriteResult> {
    return this.from().delete().eq('name', name)
  }

  /** Deletes every soldier in the roll. */
  async removeAll(): Promise<WriteResult> {
    return this.from().delete().not('name', 'is', null)
  }
}
