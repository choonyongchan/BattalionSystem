import type { Exception } from '@/lib/supabase'

// Fixed past date so tests don't depend on "today"
export const FIXTURE_DATE = '2026-01-15'

export const FIXTURE_EXCEPTIONS: Omit<Exception, 'id'>[] = [
  {
    name: 'TEST_SOLDIER_ONE',
    scope: 'Off/Leave',
    reason: 'Annual Leave',
    start: '2026-01-15',
    end: '2026-01-15',
    counts_as_absence: true,
  },
]
