'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import type { Soldier, Exception, DutyEntry, Configuration } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES } from '@/lib/companies'
import { trackEvent } from '@/lib/analytics'
import { generateParadeReport } from '@/lib/parade-report'

function SoldierSearch({
  soldiers,
  value,
  onChange,
  inputClass,
}: {
  soldiers: Soldier[]
  value: string
  onChange: (name: string) => void
  inputClass: string
}) {
  const [query, setQuery] = useState(() => {
    const found = soldiers.find((s) => s.name === value)
    return found ? `${found.rank} ${found.name}` : value
  })
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? soldiers.filter((s) =>
        `${s.rank} ${s.name}`.toLowerCase().includes(query.toLowerCase()),
      )
    : soldiers

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(s: Soldier) {
    onChange(s.name)
    setQuery(`${s.rank} ${s.name}`)
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange('')
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder="Search soldier..."
        className={inputClass}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {filtered.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(s) }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex gap-2"
              >
                <span className="font-mono text-xs text-gray-400 w-12 shrink-0 pt-0.5">{s.rank}</span>
                <span className="font-medium text-gray-800">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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

type Section = 'config' | 'duties' | 'exceptions'

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
  const theme = COMPANY_THEMES[company]

  const [date, setDate] = useState(todayISO())
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [duties, setDuties] = useState<DutyEntry[]>([])
  const [configs, setConfigs] = useState<Configuration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('config')
  const [output, setOutput] = useState('')
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
    const supabase = getSupabaseClient(company)
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
    const supabase = getSupabaseClient(company)
    const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
    const { error } = await supabase.from('Exceptions').insert({
      name: exForm.name,
      scope: exForm.scope,
      reason: exForm.reason.trim(),
      start: singleDate ? exForm.end : exForm.start,
      end: exForm.end,
    })
    if (error) { setError(error.message); return }
    setShowForm(false)
    setExForm({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date })
    await load()
  }

  async function deleteException(id: number) {
    const supabase = getSupabaseClient(company)
    await supabase.from('Exceptions').delete().eq('id', id)
    await load()
  }

  async function addDuty() {
    if (!dutyForm.duty_type) return
    const supabase = getSupabaseClient(company)
    const { error } = await supabase.from('Duty').upsert({
      duty_type: dutyForm.duty_type,
      date,
      name: dutyForm.name.toUpperCase(),
    })
    if (error) { setError(error.message); return }
    setShowForm(false)
    setDutyForm({ duty_type: '', name: '' })
    await load()
  }

  async function deleteDuty(duty_type: string) {
    const supabase = getSupabaseClient(company)
    await supabase.from('Duty').delete().eq('duty_type', duty_type).eq('date', date)
    await load()
  }

  async function saveParadeTime(parade_type: string) {
    const supabase = getSupabaseClient(company)
    setSavingParade(parade_type)
    const { error } = await supabase.from('Configuration').upsert({ parade_type, time: paradeTimes[parade_type] })
    if (error) setError(error.message)
    setSavingParade(null)
  }

  function generate() {
    const report = generateParadeReport({
      date,
      companyLabel,
      soldiers,
      activeExceptions,
      configs,
      duties,
    })
    setOutput(report)
    trackEvent('parade_state_generated', { company, soldierCount: soldiers.length, date })
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function copyOutput() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sectionTabs: { id: Section; label: string }[] = [
    { id: 'config', label: 'Config' },
    { id: 'duties', label: 'Duties' },
    { id: 'exceptions', label: 'Exceptions' },
  ]

  const inputClass = `w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-5">
      {/* Header + date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Parade State</h2>
          <p className="text-xs text-gray-500">
            {soldiers.length - new Set(activeExceptions.map((e) => e.name)).size} / {soldiers.length} present
            {activeExceptions.length > 0 && ` · ${activeExceptions.length} exception${activeExceptions.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Section tabs — order: Config, Duties, Exceptions */}
      <div className="flex border-b border-gray-200">
        {sectionTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveSection(t.id); setShowForm(false) }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSection === t.id
                ? `${theme.activeBorder} ${theme.activeText}`
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Configuration section */}
      {activeSection === 'config' && (
        <div className="space-y-3">
          {PARADE_TYPES.map((pt) => (
            <div key={pt} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 flex-1">{pt}</span>
              <input
                type="time"
                value={paradeTimes[pt] ?? ''}
                onChange={(e) => setParadeTimes((prev) => ({ ...prev, [pt]: e.target.value }))}
                className={`border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`}
              />
              <button
                onClick={() => saveParadeTime(pt)}
                disabled={savingParade === pt}
                className={`px-4 py-2 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors`}
              >
                {savingParade === pt ? '...' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Duties section */}
      {activeSection === 'duties' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className={`px-4 py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors`}
            >
              {showForm ? 'Cancel' : '+ Duty'}
            </button>
          </div>

          {showForm && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-2">Duty Type</label>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {DUTY_TYPES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDutyForm({ ...dutyForm, duty_type: d })}
                      className={`flex-none px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        dutyForm.duty_type === d
                          ? `${theme.buttonBg} ${theme.buttonHoverBg} text-white border-transparent`
                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
                <SoldierSearch
                  soldiers={soldiers}
                  value={dutyForm.name}
                  onChange={(name) => setDutyForm({ ...dutyForm, name })}
                  inputClass={inputClass}
                />
              </div>
              <button
                onClick={addDuty}
                disabled={!dutyForm.duty_type}
                className={`w-full py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors`}
              >
                Add Duty
              </button>
            </div>
          )}

          {duties.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No duties for this date.</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Duty</th>
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
                            className="text-gray-300 hover:text-red-500 transition-colors text-xs p-1"
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
            </div>
          )}
        </div>
      )}

      {/* Exceptions section */}
      {activeSection === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className={`px-4 py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors`}
            >
              {showForm ? 'Cancel' : '+ Exception'}
            </button>
          </div>

          {showForm && (() => {
            const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
            return (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Soldier</label>
                  <SoldierSearch
                    soldiers={soldiers}
                    value={exForm.name}
                    onChange={(name) => setExForm({ ...exForm, name })}
                    inputClass={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-2">Scope</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {EXCEPTION_SCOPES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setExForm({ ...exForm, scope: s })}
                        className={`flex-none px-3 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${
                          exForm.scope === s
                            ? `${theme.buttonBg} ${theme.buttonHoverBg} text-white border-transparent`
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {singleDate ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={exForm.end}
                      onChange={(e) => setExForm({ ...exForm, end: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <input
                        type="date"
                        value={exForm.start}
                        onChange={(e) => setExForm({ ...exForm, start: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To</label>
                      <input
                        type="date"
                        value={exForm.end}
                        onChange={(e) => setExForm({ ...exForm, end: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reason</label>
                  <input
                    type="text"
                    placeholder={REASON_HINTS[exForm.scope]}
                    value={exForm.reason}
                    onChange={(e) => setExForm({ ...exForm, reason: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <button
                  onClick={addException}
                  disabled={!isExceptionValid()}
                  className={`w-full py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors`}
                >
                  Add Exception
                </button>
              </div>
            )
          })()}

          {activeExceptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No exceptions for this date.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
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
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{e.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block ${theme.badgeBg} ${theme.badgeText} text-xs font-medium px-2 py-0.5 rounded-lg whitespace-nowrap`}>
                            {e.scope ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {e.start && e.end ? `${toSGDate(e.start)} – ${toSGDate(e.end)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{e.reason ?? '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteException(e.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors text-xs p-1"
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
            </div>
          )}
        </div>
      )}

      {/* Generate button */}
      <div className="pt-2 border-t border-gray-200">
        <button
          onClick={generate}
          className={`w-full py-4 ${theme.buttonBg} ${theme.buttonHoverBg} text-white font-semibold rounded-2xl transition-colors text-sm tracking-wide`}
        >
          Generate Parade State
        </button>
      </div>

      {/* Output */}
      {output && (
        <div ref={scrollRef} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Report</h3>
            <button
              onClick={copyOutput}
              className="text-xs px-3 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            readOnly
            value={output}
            rows={Math.min(30, output.split('\n').length + 2)}
            className="w-full font-mono text-xs bg-gray-900 text-green-400 p-4 rounded-2xl resize-none focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
