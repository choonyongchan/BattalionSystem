'use client'

import { useMemo, useState } from 'react'
import type { Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { isOnStrength, soldierKeyOf } from '@/backend/domain/exceptions/active'
import { isCommander } from '@/shared/ranks'
import { buildBunks, generateBunkMessage, strength, NO_REASON } from '@/backend/domain/overview/bunks'
import { combine, useDuties, useExceptions, useSettingsQuery, useSoldiers } from '@/frontend/hooks/queries'
import { todaySGDate } from '@/shared/dates'
import MessageBox from '@/frontend/components/shared/MessageBox'
import { Checkbox, Field, Input, Select } from '@/frontend/components/ui/fields'
import { Banner, Card, Empty, Loading, PageHeader, SectionTitle } from '@/frontend/components/ui/layout'

/**
 * Overview: bunk-by-bunk strength for a parade. Reasons come from exceptions and duties;
 * untick anyone else who is out to mark them ❌️. The message lists only who is out.
 */
export default function OverviewTab({ company }: { company: Company }) {
  const [date, setDateState] = useState(todaySGDate())
  const soldiersQ = useSoldiers(company)
  const exceptionsQ = useExceptions(company)
  const dutiesQ = useDuties(company, date, date)
  const settingsQ = useSettingsQuery(company)
  const { loading, error } = combine(soldiersQ, exceptionsQ, dutiesQ, settingsQ)
  const settings = settingsQ.data
  const soldiers = useMemo(() => soldiersQ.data ?? [], [soldiersQ.data])
  const exceptions = useMemo(() => exceptionsQ.data ?? [], [exceptionsQ.data])
  const duties = useMemo(() => dutiesQ.data ?? [], [dutiesQ.data])
  const [markedOut, setMarkedOut] = useState<Set<string>>(new Set())
  const paradeTimes = settings?.parade_times ?? {}
  const [chosenParade, setParade] = useState<string | null>(null)
  const parade = chosenParade ?? settings?.overview.default_parade ?? ''
  const [time, setTime] = useState<string | null>(null)

  /** Changes the date; hand-marked absences belong to one day, so they reset. */
  function setDate(d: string) {
    setDateState(d)
    setMarkedOut(new Set())
  }
  const groups = useMemo(
    () => buildBunks(soldiers, exceptions, duties, date, markedOut, settings?.overview.out_scopes ?? []),
    [soldiers, exceptions, duties, date, markedOut, settings],
  )
  const paradeTime = time ?? paradeTimes[parade] ?? ''
  const counted = groups.reduce((n, g) => n + g.bunks.reduce((m, b) => m + b.members.length, 0), 0)
  const uncounted = soldiers.filter((s) => isOnStrength(s) && !isCommander(s)).length - counted

  /** Ticks or unticks a soldier with no keyed reason. */
  function toggle(s: Soldier) {
    const key = soldierKeyOf(s)
    const next = new Set(markedOut)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setMarkedOut(next)
  }

  if (loading || !settings) return <Loading />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        subtitle={<>
          Trooper strength by bunk. Untick anyone out of the bunk without a reason keyed.
          {uncounted > 0 && ` ${uncounted} soldier${uncounted === 1 ? '' : 's'} with no bunk or 4D not counted.`}
        </>}
      />

      {error && <Banner>{error}</Banner>}

      <div className="grid grid-cols-3 gap-2">
        <Field label="Parade">
          <Select value={parade} onChange={(e) => { setParade(e.target.value); setTime(null) }}>
            {Object.keys(paradeTimes).map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><Input type="time" value={paradeTime} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>

      {groups.length === 0 && <Empty>No soldier has a bunk yet. Add 4Ds or bunks in the Nominal Roll.</Empty>}

      {groups.map((g) => (
        <section key={g.platoon ?? 'other'} className="space-y-2">
          {g.platoon && (
            <SectionTitle className="mb-0">
              {g.platoon} <span className="font-normal text-ink-60">{strength(g.bunks.flatMap((b) => b.members))}</span>
            </SectionTitle>
          )}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {g.bunks.map((b) => (
              <Card key={b.label} className="p-3">
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
                          <Checkbox checked={reasons.length === 0} disabled={keyed} onChange={() => toggle(s)} />
                          <span className={`truncate ${reasons.length ? 'text-ink-60' : 'text-ink'}`}>{[s.four_d, s.rank, s.name].filter(Boolean).join(' ')}</span>
                          {reasons.length > 0 && <span className="ml-auto shrink-0 text-xs text-ink-60">{reasons.join(', ')}</span>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {groups.length > 0 && <MessageBox title="Strength message" text={generateBunkMessage(settings.overview.message_title, parade, date, paradeTime, groups)} />}
    </div>
  )
}
