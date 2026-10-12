import { PRIMARY_COMPANY, companyLabel } from '@/shared/companies'
import SettingsPage from '@/frontend/components/settings/SettingsPage'

/** Settings for the primary company. */
export default function PrimarySettingsPage() {
  return <SettingsPage company={PRIMARY_COMPANY} label={companyLabel(PRIMARY_COMPANY)} />
}
