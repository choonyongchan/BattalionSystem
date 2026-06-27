import type { DutyEntry } from '@/lib/supabase'
import { FIXTURE_DATE } from './exceptions'

export const FIXTURE_DUTIES: DutyEntry[] = [
  { duty_type: 'CDO',  date: FIXTURE_DATE, name: 'LEE JUN WEI' },    // LTA — in CDO range 2LT..LTA ✓
  { duty_type: 'CDS',  date: FIXTURE_DATE, name: 'WONG KAH MENG' },  // 1SG — in CDS range 2SG..1SG ✓
  { duty_type: 'COS',  date: FIXTURE_DATE, name: 'YEO JIA HENG' },   // CPL — in COS range PTE..3SG ✓
  { duty_type: 'PDS1', date: FIXTURE_DATE, name: 'HO KAI XIANG' },   // 3SG — in PDS range 3SG..1SG ✓
]
