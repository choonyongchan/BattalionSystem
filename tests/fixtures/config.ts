import type { AppSettings } from '@/backend/domain/settings/settings'
import { DEFAULT_SETTINGS } from '@/backend/domain/settings/settings'
import type { ParadeStateConfig } from '@/shared/companies'

export const FIXTURE_SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  parade_times: { 'First Parade': '09:30', 'Last Parade': '17:30' },
}

export const FIXTURE_PARADE_CONFIG: ParadeStateConfig = {
  companyName: 'STALLION',
  visibleDutyTypes: ['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3'],
  platoons: [
    { key: '1', label: 'PL 1', pdsLabel: 'PDS 1' },
    { key: '2', label: 'PL 2', pdsLabel: 'PDS 2' },
    { key: '3', label: 'PL 3', pdsLabel: 'PDS 3' },
  ],
}
