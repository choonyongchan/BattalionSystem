'use client'

import { useState } from 'react'
import Holidays from 'date-holidays'
import { format, compareAsc } from 'date-fns'
import type { PublicHoliday } from '@/backend/domain/settings/settings'
import { useAddHolidayMutation, useRemoveHolidayMutation } from '@/frontend/hooks/queries'
import { Button } from '@/frontend/components/ui/button'
import { Field, Input, Select } from '@/frontend/components/ui/fields'
import { Banner, Empty } from '@/frontend/components/ui/layout'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

type Message = { tone: 'success' | 'error'; text: string }

/** Settings: battalion-wide public holidays (sync SG list or add manually). */
export default function PublicHolidaysSection({ publicHolidays }: { publicHolidays: PublicHoliday[] }) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [pickerDate, setPickerDate] = useState('')
  const [manualName, setManualName] = useState('')
  const [message, setMessage] = useState<Message | null>(null)
  const addMutation = useAddHolidayMutation()
  const removeMutation = useRemoveHolidayMutation()

  const sorted = [...publicHolidays].sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)))
  const existingDates = new Set(publicHolidays.map((h) => h.date))

  /** Adds the selected year's Singapore holidays that are not yet stored. */
  function syncSingaporeHolidays() {
    const hd = new Holidays('SG')
    const results = hd.getHolidays(year) ?? []
    const toAdd = results
      .map((h) => ({ date: format(new Date(h.date), 'yyyy-MM-dd'), name: h.name }))
      .filter((h) => !existingDates.has(h.date))
    if (toAdd.length === 0) {
      setMessage({ tone: 'success', text: `No new SG holidays to add for ${year}` })
      return
    }
    Promise.all(toAdd.map((h) => addMutation.mutateAsync(h)))
      .then(() => setMessage({ tone: 'success', text: `Added ${toAdd.length} SG holiday(s) for ${year}` }))
      .catch(() => setMessage({ tone: 'error', text: 'Failed to sync some SG holidays' }))
  }

  /** Adds the picked date as a holiday. */
  function addManual() {
    if (!pickerDate) return
    addMutation.mutate({ date: pickerDate, name: manualName }, {
      onSuccess: () => { setMessage({ tone: 'success', text: 'Holiday added' }); setPickerDate(''); setManualName('') },
      onError: () => setMessage({ tone: 'error', text: 'Failed to add holiday' }),
    })
  }

  /** Removes the holiday on `date`. */
  function remove(date: string) {
    removeMutation.mutate(date, {
      onSuccess: () => setMessage({ tone: 'success', text: 'Holiday removed' }),
      onError: () => setMessage({ tone: 'error', text: 'Failed to remove holiday' }),
    })
  }

  return (
    <div className="space-y-4 pb-4">
      <p className="text-xs text-ink-60">
        Shared across all companies. Sync pulls the official offline SG public holiday dataset
        (no network call); it merges in new dates without overwriting manual entries.
      </p>

      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      <div className="flex items-center gap-2">
        <Select aria-label="Year" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Button type="button" variant="soft" onClick={syncSingaporeHolidays}>Sync Singapore Holidays</Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Date"><Input type="date" value={pickerDate} onChange={(e) => setPickerDate(e.target.value)} /></Field>
        <Field label="Name (optional)" className="min-w-40 flex-1">
          <Input placeholder="e.g. Hari Raya Haji" value={manualName} onChange={(e) => setManualName(e.target.value)} />
        </Field>
        <Button type="button" onClick={addManual} disabled={!pickerDate}>Add</Button>
      </div>

      <div className="divide-y divide-hairline rounded-card border border-hairline">
        {sorted.length === 0 ? (
          <Empty className="py-4">No public holidays yet.</Empty>
        ) : sorted.map((h) => (
          <div key={h.date} className="flex items-center justify-between px-3 py-1 text-sm">
            <span>{format(new Date(h.date), 'dd MMM yyyy')} {h.name && `— ${h.name}`}</span>
            <Button type="button" variant="icon-danger" aria-label={`Remove ${h.date}`} title="Remove" onClick={() => remove(h.date)}>✕</Button>
          </div>
        ))}
      </div>
    </div>
  )
}
