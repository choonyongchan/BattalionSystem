'use client'

import { useEffect, useMemo, useState } from 'react'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { DutyRepository } from '@/backend/data/repositories/DutyRepository'
import type { DutyEntry, Exception, Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { soldierKeyOf } from '@/backend/domain/exceptions/active'
import { buildBunks, generateBunkMessage, strength, NO_REASON } from '@/backend/domain/overview/bunks'
import { useSettingsQuery } from '@/frontend/hooks/useSettings'
import { todaySGDate } from '@/shared/dates'
import MessageBox from '@/frontend/components/shared/MessageBox'

const input = 'w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus'

/**
 * Overview: bunk-by-bunk strength for a parade. Reasons come from exceptions and duties;
 * untick anyone else who is out to mark them ❌️. The message lists only who is out.
 */
export default function OverviewTab({ company }: { company: Company }) {
  const [date, setDate] = useState(todaySGDate())
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [duties, setDuties] = useState<DutyEntry[]>([])
  const [markedOut, setMarkedOut] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: settings } = useSettingsQuery(company)
  const paradeTimes = settings?.parade_times ?? {}
  const [parade, setParade] = useState('Last Parade')
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    /** Loads the roll, exceptions and the day's duties. */
    async function load() {
      const [rollRes, exRes, dutyRes] = await Promise.all([
        new SoldierRepository(company).list(),
        new ExceptionRepository(company).list(),
        new DutyRepository(company).listOn(date),
      ])
      const err = rollRes.error ?? exRes.error ?? dutyRes.error
      setError(err ? err.message : null)
      setSoldiers(rollRes.data)
      setExceptions(exRes.data)
      setDuties(dutyRes.data)
      setLoading(false)
    }
    load()
  }, [company, date])

  const groups = useMemo(
    () => buildBunks(soldiers, exceptions, duties, date, markedOut),
    [soldiers, exceptions, duties, date, markedOut],
  )
  const paradeTime = time ?? paradeTimes[parade] ?? ''
  const counted = groups.reduce((n, g) => n + g.bunks.reduce((m, b) => m + b.members.length, 0), 0)
  const uncounted = soldiers.filter((s) => s.on_strength !== false).length - counted

  /** Ticks or unticks a soldier with no keyed reason. */
  function toggle(s: Soldier) {
    const key = soldierKeyOf(s)
    const next = new Set(markedOut)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setMarkedOut(next)
  }

  if (loading) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Overview</h2>
        <p className="text-xs text-ink-60">
          Strength by bunk. Untick anyone out of the bunk without a reason keyed.
          {uncounted > 0 && ` ${uncounted} soldier${uncounted === 1 ? '' : 's'} with no bunk or 4D not counted.`}
        </p>
      </div>

      {error && <div role="alert" className="bg-danger/5 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-ink-60">Parade
          <select className={input} value={parade} onChange={(e) => { setParade(e.target.value); setTime(null) }}>
            {Object.keys(paradeTimes).map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-60">Date<input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-xs text-ink-60">Time<input type="time" className={input} value={paradeTime} onChange={(e) => setTime(e.target.value)} /></label>
      </div>

      {groups.length === 0 && <p className="text-center py-6 text-sm text-ink-60">No soldier has a bunk yet. Add 4Ds or bunks in the Nominal Roll.</p>}

      {groups.map((g) => (
        <section key={g.platoon ?? 'other'} className="space-y-2">
          {g.platoon && (
            <h3 className="text-sm font-semibold text-ink">
              {g.platoon} <span className="font-normal text-ink-60">{strength(g.bunks.flatMap((b) => b.members))}</span>
            </h3>
          )}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {g.bunks.map((b) => (
              <div key={b.label} className="bg-white border border-hairline rounded-card p-3">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-semibold text-ink">{b.label}</span>
                  <span className="text-sm text-ink-60">{strength(b.members)}</span>
                </div>
                <ul className="text-sm">
                  {b.members.map(({ soldier: s, reasons }) => {
                    const keyed = reasons.length > 0 && reasons[0] !== NO_REASON
                    return (
                      <li key={s.name}>
                        <label className="flex items-center gap-2 py-0.5">
                          <input type="checkbox" className="h-4 w-4" checked={reasons.length === 0} disabled={keyed} onChange={() => toggle(s)} />
                          <span className={`truncate ${reasons.length ? 'text-ink-60' : 'text-ink'}`}>{[s.four_d, s.rank, s.name].filter(Boolean).join(' ')}</span>
                          {reasons.length > 0 && <span className="ml-auto shrink-0 text-xs text-ink-60">{reasons.join(', ')}</span>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      {groups.length > 0 && <MessageBox title="Strength message" text={generateBunkMessage(parade, date, paradeTime, groups)} />}
    </div>
  )
}
