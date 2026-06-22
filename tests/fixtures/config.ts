import type { Configuration } from '@/lib/supabase'
import type { ParadeStateConfig } from '@/lib/companies'

export const FIXTURE_CONFIG: Configuration[] = [
  { parade_type: 'First Parade', time: '09:30:00' },
  { parade_type: 'Last Parade', time: '17:30:00' },
]

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
