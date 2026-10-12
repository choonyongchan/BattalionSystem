import type { Company } from '@/shared/companies'
import { AppSettingsSchema, mergeSettings, type AppSettings } from '@/backend/domain/settings/settings'
import { CompanyRepository } from './CompanyRepository'

/** Reads and writes a company's single settings row (id = 1). */
export class SettingsRepository extends CompanyRepository {
  /** @param company Company whose settings to use. */
  constructor(company: Company) {
    super(company, 'Settings')
  }

  /** Loads settings, falling back to the company's defaults per field when missing or malformed. */
  async load(): Promise<AppSettings> {
    const { data, error } = await this.from().select('*').eq('id', 1).maybeSingle()
    return mergeSettings(error ? null : data, this.company)
  }

  /** Validates and saves the given settings fields; throws on invalid input or DB error. */
  async save(partial: Partial<AppSettings>): Promise<void> {
    const parsed = AppSettingsSchema.partial().parse(partial)
    const { error } = await this.from().update(parsed).eq('id', 1)
    if (error) throw error
  }
}
