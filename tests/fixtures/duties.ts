import type { DutyEntry } from '@/lib/supabase'
import { FIXTURE_DATE } from './exceptions'

export const FIXTURE_DUTIES: DutyEntry[] = [
  { duty_type: 'CDO', date: FIXTURE_DATE, name: 'TEST_SOLDIER_TWO' },
]
