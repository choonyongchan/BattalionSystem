import type { Soldier } from '@/lib/supabase'

export const FIXTURE_SOLDIERS: Soldier[] = [
  { rank: 'CPL', name: 'TEST_SOLDIER_ONE', platoon: '1' },
  { rank: 'PTE', name: 'TEST_SOLDIER_TWO', platoon: '2' },
  { rank: 'LTA', name: 'TEST_OFFICER_ONE', platoon: 'HQ' },
]
