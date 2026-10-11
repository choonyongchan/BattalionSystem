import type { OffLeave } from '@/shared/types'

export const FIXTURE_OFF_LEAVE: OffLeave[] = [
  { name: 'GOH RONG HAO',  off: 0,   leave: 1 }, // PTE
  { name: 'NG BOON SENG',  off: 1.5, leave: 0 }, // 3SG
  { name: 'TAN WEI LIANG', off: 2,   leave: 5 }, // CPT
]
// Rank order (senior first): TAN WEI LIANG, NG BOON SENG, GOH RONG HAO
