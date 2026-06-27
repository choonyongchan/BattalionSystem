import type { Soldier } from '@/lib/supabase'

export const FIXTURE_SOLDIERS: Soldier[] = [
  // HQ Platoon
  { rank: 'CPT', name: 'TAN WEI LIANG',  platoon: 'HQ' },
  { rank: '1SG', name: 'WONG KAH MENG',  platoon: 'HQ' },
  // Platoon 1
  { rank: 'LTA', name: 'LEE JUN WEI',    platoon: '1' },
  { rank: '3SG', name: 'NG BOON SENG',   platoon: '1' },
  { rank: 'CPL', name: 'LIM ZHEN HAO',   platoon: '1' },
  { rank: 'PTE', name: 'GOH RONG HAO',   platoon: '1' },
  // Platoon 2
  { rank: 'LTA', name: 'CHEN MING ZHI',  platoon: '2' },
  { rank: '3SG', name: 'HO KAI XIANG',   platoon: '2' },
  { rank: 'CPL', name: 'YEO JIA HENG',   platoon: '2' },
  { rank: 'PTE', name: 'LIM WEI JIAN',   platoon: '2' },
  // Platoon 3
  { rank: 'SSG', name: 'CHONG KAH WAI',  platoon: '3' },
  { rank: 'LCP', name: 'TAN RONG XIAN',  platoon: '3' },
  // Platoon 4
  { rank: 'REC', name: 'ONG JUN SHENG',  platoon: '4' },
]
// Composition: 3 Officers (CPT, LTA, LTA) | 4 WOSPECs (1SG, 3SG, 3SG, SSG) | 6 Enlistees (CPL, PTE, CPL, PTE, LCP, REC) = 13 total
