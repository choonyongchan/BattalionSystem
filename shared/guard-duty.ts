import type { RankRule } from './ranks'

/** The points group every guard role counts under (dashboard column, weight, overview reason). */
export const GUARD_DUTY = 'Guard Duty'

/** The guard duty roles: each is one optional person per day, stored as its own duty in the Duty table. */
export const GUARD_DUTY_ROLES = ['CDOS', 'GC', 'G2', 'RG1', 'RG2', 'RG3', 'RG4', 'RG5', 'RG6'] as const

/** True for a duty_type that is a guard duty role. */
export const isGuardDutyRole = (dutyType: string): boolean => (GUARD_DUTY_ROLES as readonly string[]).includes(dutyType)

/** The duty a duty_type earns points under: guard roles fold into GUARD_DUTY, the rest stand alone. */
export const pointsGroupOf = (dutyType: string): string => (isGuardDutyRole(dutyType) ? GUARD_DUTY : dutyType)

/** Default rank range per guard duty role; overridden in Settings > Guard Duty Roles. */
export const DEFAULT_GUARD_DUTY_RANK_RULES: Record<string, RankRule> = {
  CDOS: { from: '3SG', to: '2SG' },
  GC: { from: '3SG', to: '2SG' },
  G2: { from: '3SG', to: '2SG' },
  ...Object.fromEntries(['RG1', 'RG2', 'RG3', 'RG4', 'RG5', 'RG6'].map((r) => [r, { from: 'PTE', to: '2SG' }])),
}

/** The rank range in force for a guard role: its override, else its default. */
export const guardRankRule = (role: string, overrides: Record<string, RankRule>): RankRule | undefined =>
  overrides[role] ?? DEFAULT_GUARD_DUTY_RANK_RULES[role]
