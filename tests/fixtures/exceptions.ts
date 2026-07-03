import type { Exception } from '@/lib/supabase'

// Fixed past date so tests don't depend on "today"
export const FIXTURE_DATE = '2026-01-15'

export const FIXTURE_EXCEPTIONS: Omit<Exception, 'id'>[] = [
  // Off/Leave — CPT TAN WEI LIANG on Annual Leave (counts as absence)
  {
    name: 'TAN WEI LIANG',
    scope: 'Off/Leave',
    reason: 'Annual Leave',
    start: '2026-01-14',
    end: '2026-01-16',
    counts_as_absence: true,
  },
  // Report Sick — LCP TAN RONG XIAN (counts as absence)
  {
    name: 'TAN RONG XIAN',
    scope: 'Report Sick',
    reason: 'Flu',
    start: '2026-01-15',
    end: '2026-01-15',
    counts_as_absence: true,
  },
  // MA — CPL LIM ZHEN HAO (counts as absence)
  {
    name: 'LIM ZHEN HAO',
    scope: 'MA',
    reason: 'Skin Appt',
    start: '2026-01-15',
    end: '2026-01-15',
    counts_as_absence: true,
  },
  // Att C — SSG CHONG KAH WAI (counts as absence)
  {
    name: 'CHONG KAH WAI',
    scope: 'Att C',
    reason: 'Fever',
    start: '2026-01-13',
    end: '2026-01-17',
    counts_as_absence: true,
  },
  // Status — PTE GOH RONG HAO (does NOT count as absence — still present)
  {
    name: 'GOH RONG HAO',
    scope: 'Status',
    reason: 'Excuse RMJ',
    start: '2026-01-10',
    end: '2026-01-20',
    counts_as_absence: false,
  },
  // Guard Duty — 1SG WONG KAH MENG (does NOT count as absence by default — still present)
  {
    name: 'WONG KAH MENG',
    scope: 'Guard Duty',
    reason: 'Regimental Guard',
    start: '2026-01-15',
    end: '2026-01-15',
    counts_as_absence: false,
  },
  // Others — PTE LIM WEI JIAN (does NOT count as absence by default — still present)
  {
    name: 'LIM WEI JIAN',
    scope: 'Others',
    reason: 'Attending Course',
    start: '2026-01-14',
    end: '2026-01-16',
    counts_as_absence: false,
  },
]
// Absent (counts_as_absence: true): TAN WEI LIANG, TAN RONG XIAN, LIM ZHEN HAO, CHONG KAH WAI = 4
// Present: 13 total − 4 absent = 9 (WONG KAH MENG and LIM WEI JIAN have exceptions but still count as present)
// By rank type: Officer 2/3 | WOSPEC 3/4 | Enlistee 4/6
