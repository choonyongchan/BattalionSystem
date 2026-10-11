export interface Soldier {
  /** Stable id — exceptions and conduct decisions point here, so a rename keeps them. Absent in older fixtures. */
  id?: string
  rank: string
  name: string
  platoon: string
  four_d?: string | null
  /** false = posted out: hidden from strength and the roll, history kept. Absent = on strength. */
  on_strength?: boolean
}

export interface Exception {
  id: number
  name: string
  scope: string
  reason: string | null
  start: string | null
  end: string | null
  counts_as_absence: boolean
  time?: string | null
  location?: string | null
  in_out?: 'IN' | 'OUT' | null
  /** The soldier it belongs to. Null for rows written before the id existed or by the old app — see soldierKey(). */
  soldier_id?: string | null
  /** Fine-grained kind (MC, LD, RMJ, Excuse, ...); scope is the parade section it prints under. Null = infer (exceptionType). */
  type?: string | null
  /** Set = taken back: counts nowhere, but stays on the soldier's history. */
  revoked_at?: string | null
}

export interface Conduct {
  id: string
  name: string
  /** Start date. */
  date: string
  /** Null = within the start day. */
  end_date: string | null
  /** "HH:MM:SS", or null when no timing has been issued. */
  start_time: string | null
  end_time: string | null
}

/** A manual participation call — auto fall-outs are derived from Exceptions and never stored. */
export interface ConductDecision {
  id: string
  conduct_id: string
  soldier_id: string
  participating: boolean
  reason: string | null
}

export interface OffLeave {
  name: string
  off: number
  leave: number
}

export interface DutyEntry {
  duty_type: string
  date: string
  name: string
}

// @deprecated — superseded by the new Settings table and lib/settings.ts. Kept only because
// the live Configuration table still exists; application code should not write new data
// through this type.
export interface Configuration {
  parade_type: string
  time: string
}
