import type { Soldier } from './supabase'

export function displayName(name: string, soldiers: Soldier[]): string {
  const rank = soldiers.find(s => s.name === name)?.rank
  return rank ? `${rank} ${name}` : name
}
