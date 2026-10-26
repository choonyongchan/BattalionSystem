import type { AppSettings } from '@/backend/domain/settings/settings'
import { defaultSettings } from '@/backend/domain/settings/settings'
import type { ParadeConfig } from '@/backend/domain/parade/parade-report'

export const FIXTURE_SETTINGS: AppSettings = {
  ...defaultSettings('test'),
  parade_times: { 'First Parade': '09:30', 'Last Parade': '17:30' },
}

export const FIXTURE_PARADE_CONFIG: ParadeConfig = {
  companyName: 'STALLION',
  inOutScopes: ['Att C', 'Report Sick', 'MA', 'Others'],
  platoons: [
    { key: '1', label: 'PL 1', pdsLabel: 'PDS 1' },
    { key: '2', label: 'PL 2', pdsLabel: 'PDS 2' },
    { key: '3', label: 'PL 3', pdsLabel: 'PDS 3' },
  ],
}

const { duty_base_weights, duty_day_multipliers, duty_weight_exceptions, eligibility_name_overrides, eligibility_rank_overrides, guard_duty_rank_overrides, absence_scope_defaults, parade_times } = defaultSettings('test')

/** The settings columns that predate the nullable ones; tests reset the live test Settings row with these. */
export const RESET_SETTINGS = { duty_base_weights, duty_day_multipliers, duty_weight_exceptions, eligibility_name_overrides, eligibility_rank_overrides, guard_duty_rank_overrides, absence_scope_defaults, parade_times }
