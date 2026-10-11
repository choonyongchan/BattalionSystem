import type { PublicHoliday } from '@/backend/domain/settings/settings'
import { supabase } from '@/backend/data/client'

/** Reads and writes the battalion-wide PublicHolidays table. */
export class PublicHolidayRepository {
  /** Lists holidays by date; empty on error. */
  async list(): Promise<PublicHoliday[]> {
    const { data, error } = await supabase.from('PublicHolidays').select('*').order('date', { ascending: true })
    if (error || !data) return []
    return data
  }

  /** Adds or renames the holiday on `date`; throws on DB error. */
  async add(date: string, name: string): Promise<void> {
    const { error } = await supabase.from('PublicHolidays').upsert({ date, name })
    if (error) throw error
  }

  /** Deletes the holiday on `date`; throws on DB error. */
  async remove(date: string): Promise<void> {
    const { error } = await supabase.from('PublicHolidays').delete().eq('date', date)
    if (error) throw error
  }
}
