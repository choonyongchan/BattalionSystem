import type { AppSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import type { ParadeStateConfig } from '@/lib/companies'

export const FIXTURE_SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  parade_times: { 'First Parade': '09:30', 'Last Parade': '17:30' },
}

export const FIXTURE_PARADE_CONFIG: ParadeStateConfig = {
  header: ['STALLION COY PARADE STATE'],
  visibleDutyTypes: ['CDO'],
  scopeConfigs: [
    { key: 'Att C',       label: 'ATT C' },
    { key: 'Status',      label: 'STATUS' },
    { key: 'Off/Leave',   label: 'OFF/LEAVE' },
    { key: 'Guard Duty',  label: 'GUARD DUTY' },
    { key: 'Report Sick', label: 'REPORT SICK' },
    { key: 'MA',          label: 'MA' },
    { key: 'Others',      label: 'OTHERS' },
  ],
}
