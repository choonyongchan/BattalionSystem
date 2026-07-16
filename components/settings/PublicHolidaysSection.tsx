'use client'

import { useState } from 'react'
import Holidays from 'date-holidays'
import { format, compareAsc } from 'date-fns'
import { toast } from 'sonner'
import type { PublicHoliday } from '@/lib/settings'
import { useAddHolidayMutation, useRemoveHolidayMutation } from '@/lib/settings'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function PublicHolidaysSection({ publicHolidays }: { publicHolidays: PublicHoliday[] }) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [pickerDate, setPickerDate] = useState<Date | undefined>(undefined)
  const [manualName, setManualName] = useState('')
  const addMutation = useAddHolidayMutation()
  const removeMutation = useRemoveHolidayMutation()

  const sorted = [...publicHolidays].sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)))
  const existingDates = new Set(publicHolidays.map((h) => h.date))

  function syncSingaporeHolidays() {
    const hd = new Holidays('SG')
    const results = hd.getHolidays(year) ?? []
    const toAdd = results
      .map((h) => ({ date: format(new Date(h.date), 'yyyy-MM-dd'), name: h.name }))
      .filter((h) => !existingDates.has(h.date))
    if (toAdd.length === 0) {
      toast.success(`No new SG holidays to add for ${year}`)
      return
    }
    Promise.all(toAdd.map((h) => addMutation.mutateAsync(h)))
      .then(() => toast.success(`Added ${toAdd.length} SG holiday(s) for ${year}`))
      .catch(() => toast.error('Failed to sync some SG holidays'))
  }

  function addManual() {
    if (!pickerDate) return
    const date = format(pickerDate, 'yyyy-MM-dd')
    addMutation.mutate({ date, name: manualName }, {
      onSuccess: () => { toast.success('Holiday added'); setPickerDate(undefined); setManualName('') },
      onError: () => toast.error('Failed to add holiday'),
    })
  }

  function remove(date: string) {
    removeMutation.mutate(date, {
      onSuccess: () => toast.success('Holiday removed'),
      onError: () => toast.error('Failed to remove holiday'),
    })
  }

  return (
    <div className="space-y-4 pb-4">
      <p className="text-xs text-gray-500">
        Shared across all companies. Sync pulls the official offline SG public holiday dataset
        (no network call); it merges in new dates without overwriting manual entries.
      </p>

      <div className="flex items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={syncSingaporeHolidays}
          className="bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
        >
          Sync Singapore Holidays
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger className="bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full px-3 py-1.5 text-sm font-medium transition-colors">
            {pickerDate ? format(pickerDate, 'dd MMM yyyy') : 'Pick a date'}
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto">
            <Calendar mode="single" selected={pickerDate} onSelect={setPickerDate} />
          </PopoverContent>
        </Popover>
        <Input placeholder="Name (optional)" value={manualName} onChange={(e) => setManualName(e.target.value)} className="flex-1" />
        <button
          type="button"
          onClick={addManual}
          disabled={!pickerDate}
          className="bg-gray-900 text-white hover:bg-black rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No public holidays yet.</p>
        ) : sorted.map((h) => (
          <div key={h.date} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{format(new Date(h.date), 'dd MMM yyyy')} {h.name && `— ${h.name}`}</span>
            <button type="button" onClick={() => remove(h.date)} className="text-gray-400 hover:text-red-500">×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
