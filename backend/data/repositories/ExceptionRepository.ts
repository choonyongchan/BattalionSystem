import type { Company } from '@/shared/companies'
import type { Exception } from '@/shared/types'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'

/** Fields written when creating or editing an exception. */
export type ExceptionFields = Partial<Omit<Exception, 'id'>>

/** Reads and writes a company's exceptions (leave, status, MC, guard duty, ...). */
export class ExceptionRepository extends CompanyRepository {
  /** @param company Company whose exceptions to use. */
  constructor(company: Company) {
    super(company, 'Exceptions')
  }

  /** Lists exceptions, optionally only those in one scope. */
  async list(scope?: string): Promise<ListResult<Exception>> {
    const q = this.select()
    return rows<Exception>(await (scope ? q.eq('scope', scope) : q))
  }

  /** Adds one or more exceptions. */
  async insert(fields: ExceptionFields | ExceptionFields[]): Promise<WriteResult> {
    return this.from().insert(Array.isArray(fields) ? fields.map(this.own) : this.own(fields))
  }

  /** Updates the exception with `id`. */
  async update(id: number, patch: ExceptionFields): Promise<WriteResult> {
    return this.from().update(patch).eq('company', this.company).eq('id', id)
  }

  /** Deletes the exception with `id`. */
  async remove(id: number): Promise<WriteResult> {
    return this.from().delete().eq('company', this.company).eq('id', id)
  }

  /** Rewrites the soldier name stored on every exception after a rename. */
  async rename(oldName: string, newName: string): Promise<WriteResult> {
    return this.from().update({ name: newName }).eq('company', this.company).eq('name', oldName)
  }
}
