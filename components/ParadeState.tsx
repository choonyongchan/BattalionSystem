'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import type { Soldier, Exception, DutyEntry, Configuration } from '@/lib/supabase'
import type { Company } from '@/lib/companies'

const EXCEPTION_SCOPES = ['Att C', 'Status', 'Off/Leave', 'Guard Duty', 'Report Sick', 'MA', 'Others'] as const
type ExceptionScope = (typeof EXCEPTION_SCOPES)[number]

const REASON_HINTS: Record<ExceptionScope, string> = {
  'Att C':       'e.g. Flu, Fever',
  'Status':      'e.g. Excuse RMJ, Excuse Uniform',
  'Off/Leave':   'e.g. Annual Leave, Off',
  'Guard Duty':  'e.g. Regimental Guard, Guard Commander',
  'Report Sick': 'e.g. Flu, Fever',
  'MA':          'e.g. Skin Appt, IMH Appt',
  'Others':      'e.g. ...',
}

const SINGLE_DATE_SCOPES: ExceptionScope[] = ['Report Sick', 'MA', 'Guard Duty']

const DUTY_TYPES = ['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4'] as const

const PARADE_TYPES = ['First Parade', 'Last Parade'] as const

type Section = 'exceptions' | 'duties' | 'config'

function toSGDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function ParadeState({
  company,
  companyLabel,
}: {
  company: Company
  companyLabel: string
}) {
  const supabase = getSupabaseClient(company)

  const [date, setDate] = useState(todayISO())
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [duties, setDuties] = useState<DutyEntry[]>([])
  const [configs, setConfigs] = useState<Configuration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('exceptions')
  const [output, setOutput] = useState('')
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [exForm, setExForm] = useState<{
    name: string
    scope: ExceptionScope
    reason: string
    start: string
    end: string
  }>({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date })
  const [dutyForm, setDutyForm] = useState({ duty_type: '', name: '' })
  const [paradeTimes, setParadeTimes] = useState<Record<string, string>>({ 'First Parade': '09:30', 'Last Parade': '17:30' })
  const [savingParade, setSavingParade] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [company, date])

  async function load() {
    setLoading(true)
    setError(null)
    const [soldiersRes, exceptionsRes, dutiesRes, configsRes] = await Promise.all([
      supabase.from('NominalRoll').select('*'),
      supabase.from('Exceptions').select('*'),
      supabase.from('Duty').select('*').eq('date', date),
      supabase.from('Configuration').select('*'),
    ])
    if (soldiersRes.error) setError(soldiersRes.error.message)
    setSoldiers(soldiersRes.data ?? [])
    setExceptions(exceptionsRes.data ?? [])
    setDuties(dutiesRes.data ?? [])
    const loadedConfigs = configsRes.data ?? []
    setConfigs(loadedConfigs)
    if (loadedConfigs.length > 0) {
      setParadeTimes((prev) => {
        const next = { ...prev }
        loadedConfigs.forEach((c) => { next[c.parade_type] = c.time.substring(0, 5) })
        return next
      })
    }
    setLoading(false)
  }

  // Exceptions active on the selected date
  const activeExceptions = exceptions.filter((e) => {
    const d = new Date(date)
    const start = e.start ? new Date(e.start) : null
    const end = e.end ? new Date(e.end) : null
    if (start && d < start) return false
    if (end && d > end) return false
    return true
  })

  function isExceptionValid() {
    const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
    return !!(exForm.name && exForm.reason.trim() && exForm.end && (singleDate || exForm.start))
  }

  async function addException() {
    if (!isExceptionValid()) return
    const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
    const { error } = await supabase.from('Exceptions').insert({
      name: exForm.name,
      scope: exForm.scope,
      reason: exForm.reason.trim(),
      start: singleDate ? null : exForm.start,
      end: exForm.end,
    })
    if (error) { setError(error.message); return }
    setShowForm(false)
    setExForm({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date })
    await load()
  }

  async function deleteException(id: number) {
    await supabase.from('Exceptions').delete().eq('id', id)
    await load()
  }

  async function addDuty() {
    if (!dutyForm.duty_type) return
    const { error } = await supabase.from('Duty').upsert({
      duty_type: dutyForm.duty_type,
      date,
      name: dutyForm.name.toUpperCase() || null,
    })
    if (error) { setError(error.message); return }
    setShowForm(false)
    setDutyForm({ duty_type: '', name: '' })
    await load()
  }

  async function deleteDuty(duty_type: string) {
    await supabase.from('Duty').delete().eq('duty_type', duty_type).eq('date', date)
    await load()
  }

  async function saveParadeTime(parade_type: string) {
    setSavingParade(parade_type)
    const { error } = await supabase.from('Configuration').upsert({ parade_type, time: paradeTimes[parade_type] })
    if (error) setError(error.message)
    setSavingParade(null)
  }

  function generate() {
    const d = new Date(date)
    const dateStr = d
      .toLocaleDateString('en-SG', { weekday: 'long', day: '2-digit', month: 'short', year: '2-digit' })
      .toUpperCase()

    const absentNames = new Set(activeExceptions.map((e) => e.name))
    const total = soldiers.length
    const absent = absentNames.size
    const present = total - absent

    const lines: string[] = [
      `${companyLabel.toUpperCase()} COY PARADE STATE`,
      `DATE: ${dateStr}`,
      '',
    ]

    if (configs.length > 0) {
      configs.forEach((c) => {
        const t = c.time.substring(0, 5).replace(':', '')
        lines.push(`${c.parade_type.toUpperCase()} PARADE — ${t}H`)
      })
      lines.push('')
    }

    lines.push(`TOTAL STRENGTH : ${total}`)
    lines.push(`PRESENT        : ${present}`)
    lines.push(`ABSENT         : ${absent}`)

    if (activeExceptions.length > 0) {
      lines.push('')
      lines.push('EXCEPTIONS:')

      EXCEPTION_SCOPES.forEach((scope) => {
        const group = activeExceptions.filter((e) => e.scope === scope)
        if (group.length === 0) return
        lines.push(`  ${scope.toUpperCase()}:`)
        group.forEach((e) => {
          let line = `    - ${e.name}`
          if (e.start && e.end) line += ` (${toSGDate(e.start)} - ${toSGDate(e.end)})`
          if (e.reason) line += ` — ${e.reason}`
          lines.push(line)
        })
      })

      // Any exceptions with unknown scope
      const other = activeExceptions.filter(
        (e) => !e.scope || !(EXCEPTION_SCOPES as readonly string[]).includes(e.scope),
      )
      if (other.length > 0) {
        lines.push('  OTHERS:')
        other.forEach((e) => {
          let line = `    - ${e.name}`
          if (e.reason) line += ` — ${e.reason}`
          lines.push(line)
        })
      }
    }

    if (duties.length > 0) {
      lines.push('')
      lines.push('DUTIES:')
      duties.forEach((du) => {
        lines.push(`  ${du.duty_type}: ${du.name ?? 'TBC'}`)
      })
    }

    lines.push('')
    lines.push(
      `Generated: ${new Date().toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}`,
    )

    setOutput(lines.join('\n'))
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function copyOutput() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sectionTabs: { id: Section; label: string }[] = [
    { id: 'exceptions', label: 'Exceptions' },
    { id: 'duties', label: 'Duties' },
    { id: 'config', label: 'Configuration' },
  ]

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Header + date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Parade State</h2>
          <p className="text-sm text-gray-500">
            {activeExceptions.length} exception{activeExceptions.length !== 1 ? 's' : ''} active ·{' '}
            {soldiers.length - new Set(activeExceptions.map((e) => e.name)).size} / {soldiers.length} present
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex border-b border-gray-200 gap-0">
        {sectionTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveSection(t.id); setShowForm(false) }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSection === t.id
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Exceptions section */}
      {activeSection === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
            >
              {showForm ? 'Cancel' : '+ Add Exception'}
            </button>
          </div>

          {showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-medium text-gray-700 text-sm">New Exception</h3>
              {(() => {
                const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Soldier Name</label>
                      <select
                        value={exForm.name}
                        onChange={(e) => setExForm({ ...exForm, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select soldier...</option>
                        {soldiers.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.rank} {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Scope</label>
                      <select
                        value={exForm.scope}
                        onChange={(e) => setExForm({ ...exForm, scope: e.target.value as ExceptionScope })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {EXCEPTION_SCOPES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    {singleDate ? (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Date</label>
                        <input
                          type="date"
                          value={exForm.end}
                          onChange={(e) => setExForm({ ...exForm, end: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={exForm.start}
                            onChange={(e) => setExForm({ ...exForm, start: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">End Date</label>
                          <input
                            type="date"
                            value={exForm.end}
                            onChange={(e) => setExForm({ ...exForm, end: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </>
                    )}
                    <div className={singleDate ? '' : 'sm:col-span-2'}>
                      <label className="block text-xs text-gray-500 mb-1">Reason</label>
                      <input
                        type="text"
                        placeholder={REASON_HINTS[exForm.scope]}
                        value={exForm.reason}
                        onChange={(e) => setExForm({ ...exForm, reason: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                )
              })()}
              <button
                onClick={addException}
                disabled={!isExceptionValid()}
                className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                Add Exception
              </button>
            </div>
          )}

          {activeExceptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No exceptions for this date.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Soldier</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Scope</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Period</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Reason</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {activeExceptions.map((e, i) => (
                    <tr key={e.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 font-medium">{e.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded">
                          {e.scope ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {e.start && e.end ? `${toSGDate(e.start)} – ${toSGDate(e.end)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{e.reason ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteException(e.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Duties section */}
      {activeSection === 'duties' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
            >
              {showForm ? 'Cancel' : '+ Add Duty'}
            </button>
          </div>

          {showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-medium text-gray-700 text-sm">New Duty for {toSGDate(date)}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duty Type</label>
                  <select
                    value={dutyForm.duty_type}
                    onChange={(e) => setDutyForm({ ...dutyForm, duty_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select duty...</option>
                    {DUTY_TYPES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
                  <select
                    value={dutyForm.name}
                    onChange={(e) => setDutyForm({ ...dutyForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select soldier...</option>
                    {soldiers.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.rank} {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={addDuty}
                disabled={!dutyForm.duty_type}
                className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                Add Duty
              </button>
            </div>
          )}

          {duties.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No duties assigned for this date.</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Duty Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Assigned To</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {duties.map((d, i) => (
                    <tr key={d.duty_type} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 font-medium">{d.duty_type}</td>
                      <td className="px-4 py-3 text-gray-600">{d.name ?? 'TBC'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteDuty(d.duty_type)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Configuration section */}
      {activeSection === 'config' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Parade Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {PARADE_TYPES.map((pt, i) => (
                  <tr key={pt} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-3 font-medium">{pt}</td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={paradeTimes[pt] ?? ''}
                        onChange={(e) => setParadeTimes((prev) => ({ ...prev, [pt]: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => saveParadeTime(pt)}
                        disabled={savingParade === pt}
                        className="px-3 py-1 bg-green-700 text-white text-xs font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
                      >
                        {savingParade === pt ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={generate}
          className="w-full py-3 bg-green-800 text-white font-semibold rounded-xl hover:bg-green-900 transition-colors text-sm tracking-wide"
        >
          Generate Parade State
        </button>
      </div>

      {/* Output */}
      {output && (
        <div ref={scrollRef} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Generated Report</h3>
            <button
              onClick={copyOutput}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            ref={outputRef}
            readOnly
            value={output}
            rows={Math.min(30, output.split('\n').length + 2)}
            className="w-full font-mono text-xs bg-gray-900 text-green-400 p-4 rounded-xl resize-none focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
