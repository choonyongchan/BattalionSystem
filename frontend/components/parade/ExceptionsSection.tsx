'use client'

import { useState } from 'react'
import type { Exception } from '@/shared/types'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { matchesExceptionQuery, sortExceptions } from '@/backend/domain/parade/exception-table'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import AddExceptionForm from './AddExceptionForm'
import ExceptionsTable from './ExceptionsTable'
import { Button } from '@/frontend/components/ui/button'
import { SearchInput } from '@/frontend/components/ui/fields'
import { Empty } from '@/frontend/components/ui/layout'

/** Searchable list of exceptions with an add form. */
export default function ExceptionsSection({ date, settings, data }: {
  date: string
  settings: AppSettings | undefined
  data: ParadeData
}) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Exception | undefined>()
  const open = showForm || !!editing
  const rows = sortExceptions(data.exceptions)
    .filter((e) => matchesExceptionQuery(e, search, data.soldiers))

  /** Loads a row into the form and scrolls up to it. */
  function startEdit(e: Exception) {
    setShowForm(false)
    setEditing(e)
    requestAnimationFrame(() => document.getElementById('ex-form')?.scrollIntoView({ behavior: 'smooth' }))
  }

  /** Closes the form; after an edit, scrolls back to the row. */
  function endForm() {
    const id = editing?.id
    setShowForm(false)
    setEditing(undefined)
    if (id) requestAnimationFrame(() => document.getElementById(`ex-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SearchInput
          placeholder="Search by name, scope, reason, 4D..."
          aria-label="Search exceptions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant={open ? 'secondary' : 'primary'} className="shrink-0" onClick={() => { setEditing(undefined); setShowForm(!open) }}>
          {open ? 'Cancel' : '+ Exception'}
        </Button>
      </div>

      {/* Remounts on open and per edit, so the form resets to the currently viewed date or the edited row */}
      {open && (
        <div id="ex-form" className="scroll-mt-40">
          <AddExceptionForm key={editing?.id ?? 'new'} date={date} settings={settings} data={data} editing={editing} onDone={endForm} />
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>{search.trim() ? 'No exceptions match that query.' : 'No exceptions for this date.'}</Empty>
      ) : (
        <ExceptionsTable data={data} rows={rows} onEdit={startEdit} />
      )}
    </div>
  )
}
