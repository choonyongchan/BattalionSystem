import type { Company } from '@/shared/companies'
import type { MedicalReview } from '@/shared/types'
import { supabase, tbl } from '@/backend/data/client'
import { CompanyRepository, rows, type ListResult, type WriteResult } from './CompanyRepository'
import type { ExceptionFields } from './ExceptionRepository'

/** Review details written alongside the exception. */
export type MedicalReviewFields = Omit<MedicalReview, 'exception_id'>

/**
 * Reads and writes a company's medical review details. Each review is a 'Report Sick'
 * exception typed 'Medical Review'; deleting that exception deletes the details too.
 */
export class MedicalReviewRepository extends CompanyRepository {
  /** @param company Company whose medical reviews to use. */
  constructor(company: Company) {
    super(company, 'MedicalReviews')
  }

  /** Lists every review's details. */
  async list(): Promise<ListResult<MedicalReview>> {
    return rows<MedicalReview>(await this.from().select('*'))
  }

  /** Creates the review's exception, then its details; removes the exception if the details fail. */
  async add(exception: ExceptionFields, details: MedicalReviewFields): Promise<WriteResult> {
    const exceptions = () => supabase.from(tbl(this.company, 'Exceptions'))
    const { data, error } = await exceptions().insert(exception).select('id').single()
    if (error) return { error }
    const id = (data as unknown as { id: number }).id
    const res = await this.from().insert({ exception_id: id, ...details })
    if (res.error) await exceptions().delete().eq('id', id)
    return { error: res.error }
  }
}
