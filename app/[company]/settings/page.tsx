import { DISABLED_COMPANIES, PRIMARY_COMPANY, companyHref, companyLabel } from '@/shared/companies'
import SettingsPage from '@/frontend/components/settings/SettingsPage'
import ComingSoon from '@/frontend/components/shared/ComingSoon'
import Redirect from '@/frontend/components/shared/Redirect'
import { companyFromParams } from '../company-param'

export { generateStaticParams } from '../company-param'

/** A non-primary company's settings page; the primary company's lives at /settings. */
export default async function CompanySettingsPage({ params }: { params: Promise<{ company: string }> }) {
  const company = await companyFromParams(params)
  if (company === PRIMARY_COMPANY) return <Redirect to={companyHref(company, 'settings')} />
  if (DISABLED_COMPANIES.has(company)) return <ComingSoon company={company} />
  return <SettingsPage company={company} label={companyLabel(company)} />
}
