import { companyHref } from '@/shared/companies'
import Redirect from '@/frontend/components/shared/Redirect'
import { companyFromParams } from '../company-param'

export { generateStaticParams } from '../company-param'

/** Old standalone dashboard URL: now the Duty Dashboard tab of the workspace. */
export default async function DashboardPage({ params }: { params: Promise<{ company: string }> }) {
  return <Redirect to={`${companyHref(await companyFromParams(params))}?tab=dashboard`} />
}
