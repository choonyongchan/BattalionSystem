import { PRIMARY_COMPANY, companyLabel } from '@/shared/companies'
import CompanyContent from '@/frontend/components/layout/CompanyContent'

/** Site root: the primary company's landing page and, once signed in, its workspace. */
export default function HomePage() {
  return <CompanyContent company={PRIMARY_COMPANY} label={companyLabel(PRIMARY_COMPANY)} />
}
