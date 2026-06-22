'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { getSupabaseClient, tbl } from '@/lib/supabase'
import { displayName } from '@/lib/display'
import type { Soldier, Exception, DutyEntry, Configuration } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES, PARADE_CONFIG } from '@/lib/companies'
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
  'Att C': 'e.g. Flu, Fever',
  'Status': 'e.g. Excuse RMJ, Excuse Uniform',
  'Off/Leave': 'e.g. Annual Leave, Off',
  'Guard Duty': 'e.g. Regimental Guard, Guard Commander',
  'Report Sick': 'e.g. Flu, Fever',
  'MA': 'e.g. Skin Appt, IMH Appt',
  'Others': 'e.g. ...',
}

const SINGLE_DATE_SCOPES: ExceptionScope[] = ['Report Sick', 'MA', 'Guard Duty']

const ABSENCE_SCOPES: ExceptionScope[] = ['Att C', 'Off/Leave', 'MA', 'Others']

type ExForm = { name: string; scope: ExceptionScope; reason: string; start: string; end: string; counts_as_absence: boolean }

const DUTY_TYPES = ['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4'] as const

const PARADE_TYPES = ['First Parade', 'Last Parade'] as const

const RANK_TYPES = ['Officer', 'WOSPEC', 'Enlistee'] as const
const STR_PLATOONS = ['Total', 'HQ', '1', '2', '3', '4'] as const
// ponytail: duplicated from NominalRoll.tsx; share only if a third consumer appears
const _OFFICER_PREFIXES = ['2LT', 'LTA', 'CPT', 'MAJ', 'LTC', 'SLTC', 'COL', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8']
const _WOSPEC_RANKS = ['3SG', '2SG', '1SG', 'SSG', 'MSG', 'ME1', 'ME2', 'ME3', '3WO', '2WO', '1WO', 'MWO', 'SWO', 'CWO']
function getRankType(rank: string): 'Officer' | 'WOSPEC' | 'Enlistee' {
  if (_OFFICER_PREFIXES.some((p) => rank.startsWith(p))) return 'Officer'
  if (_WOSPEC_RANKS.includes(rank)) return 'WOSPEC'
  return 'Enlistee'
}

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
  const [lastParadeType, setLastParadeType] = useState<'First Parade' | 'Last Parade' | null>(null)

  // Strength overrides
  const [strOverrides, setStrOverrides] = useState<Record<string, Record<string, string>>>({})
  const [showStrOverride, setShowStrOverride] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [exForm, setExForm] = useState<ExForm>({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true })
  const [medCenter, setMedCenter] = useState('')
  const [editMedCenter, setEditMedCenter] = useState('')
  const [statusRows, setStatusRows] = useState<{ start: string; end: string; reason: string }[]>([{ start: date, end: date, reason: '' }])
  const [dutyForm, setDutyForm] = useState({ duty_type: '', name: '' })
  const [paradeTimes, setParadeTimes] = useState<Record<string, string>>({ 'First Parade': '09:30', 'Last Parade': '17:30' })
  const [savingParade, setSavingParade] = useState<string | null>(null)

  // Duties inline edit
  const [editDuty, setEditDuty] = useState<{ duty_type: string; name: string } | null>(null)
  const [savingDuty, setSavingDuty] = useState(false)
  const [confirmDeleteDuty, setConfirmDeleteDuty] = useState<string | null>(null)

  // Exceptions inline edit
  const [editEx, setEditEx] = useState<Exception | null>(null)
  const [editExErrors, setEditExErrors] = useState<Record<string, boolean>>({})
  const [savingEx, setSavingEx] = useState(false)
  const [confirmDeleteEx, setConfirmDeleteEx] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [company, date])

  async function load() {
    const supabase = getSupabaseClient(company)
    setLoading(true)
    setError(null)
    const [soldiersRes, exceptionsRes, dutiesRes, configsRes, strRes] = await Promise.all([
      supabase.from(tbl(company, 'NominalRoll')).select('*'),
      supabase.from(tbl(company, 'Exceptions')).select('*'),
      supabase.from(tbl(company, 'Duty')).select('*').eq('date', date),
      supabase.from(tbl(company, 'Configuration')).select('*'),
      supabase.from(tbl(company, 'StrengthOverride')).select('*'),
    ])
    if (soldiersRes.error) setError(soldiersRes.error.message)
    setSoldiers((soldiersRes.data ?? []) as unknown as Soldier[])
    setExceptions((exceptionsRes.data ?? []) as unknown as Exception[])
    setDuties((dutiesRes.data ?? []) as unknown as DutyEntry[])
    const loadedConfigs = (configsRes.data ?? []) as unknown as Configuration[]
    setConfigs(loadedConfigs)
    if (loadedConfigs.length > 0) {
      setParadeTimes((prev) => {
        const next = { ...prev }
        loadedConfigs.forEach((c) => { next[c.parade_type] = c.time.substring(0, 5) })
        return next
      })
    }
    const loadedStr: Record<string, Record<string, string>> = {}
      ; (strRes.data as unknown as { platoon: string; rank_type: string; value: number }[] ?? []).forEach((row) => {
        if (!loadedStr[row.platoon]) loadedStr[row.platoon] = {}
        loadedStr[row.platoon][row.rank_type] = String(row.value)
      })
    setStrOverrides(loadedStr)
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

  const computedStrength = useMemo(() => {
    const result: Record<string, Record<string, number>> = {}
    for (const platoon of STR_PLATOONS) {
      result[platoon] = {}
      const pool = platoon === 'Total' ? soldiers : soldiers.filter((s) => s.platoon === platoon)
      for (const rt of RANK_TYPES) {
        result[platoon][rt] = pool.filter((s) => getRankType(s.rank) === rt).length
      }
    }
    return result
  }, [soldiers])

  function strWarn(platoon: string, rt: string): string | null {
    const raw = strOverrides[platoon]?.[rt]
    if (!raw && raw !== '0') return null
    const override = Number(raw)
    if (isNaN(override)) return null
    const computed = computedStrength[platoon]?.[rt] ?? 0
    if (override !== computed) return `Nominal roll has ${computed} — override is ${override}`
    return null
  }

  function anyMismatch(): boolean {
    return STR_PLATOONS.some((p) => RANK_TYPES.some((rt) => strWarn(p, rt) !== null))
  }

  async function saveStrengthCell(platoon: string, rt: string, val: string) {
    const supabase = getSupabaseClient(company)
    if (val === '') {
      await supabase.from(tbl(company, 'StrengthOverride')).delete()
        .eq('platoon', platoon).eq('rank_type', rt)
    } else {
      const value = Number(val)
      if (!isNaN(value)) {
        await supabase.from(tbl(company, 'StrengthOverride')).upsert({ platoon, rank_type: rt, value })
      }
    }
  }

  function isExceptionValid() {
    if (!exForm.name) return false
    if (exForm.scope === 'Status') {
      if (!statusRows.every((r) => r.reason.trim() && r.start && r.end)) return false
      const reasons = statusRows.map((r) => r.reason.trim().toLowerCase())
      return new Set(reasons).size === reasons.length
    }
    const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
    return !!(exForm.reason.trim() && exForm.end && (singleDate || exForm.start) && (exForm.scope !== 'MA' || medCenter.trim()))
  }

  async function addException() {
    if (!isExceptionValid()) return
    const supabase = getSupabaseClient(company)
    let error: { message: string } | null = null
    if (exForm.scope === 'Status') {
      const rows = statusRows.map((r) => ({ name: exForm.name, scope: exForm.scope, reason: r.reason.trim(), start: r.start, end: r.end, counts_as_absence: exForm.counts_as_absence }))
        ; ({ error } = await supabase.from(tbl(company, 'Exceptions')).insert(rows))
    } else {
      const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
      const savedReason = exForm.scope === 'MA' ? `${medCenter.trim()}: ${exForm.reason.trim()}` : exForm.reason.trim()
        ; ({ error } = await supabase.from(tbl(company, 'Exceptions')).insert({
          name: exForm.name,
          scope: exForm.scope,
          reason: savedReason,
          start: singleDate ? exForm.end : exForm.start,
          end: exForm.end,
          counts_as_absence: exForm.counts_as_absence,
        }))
    }
    if (error) { setError(error.message); return }
    setShowForm(false)
    setExForm({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true })
    setStatusRows([{ start: date, end: date, reason: '' }])
    setMedCenter('')
    await load()
  }

  async function deleteException(id: number) {
    const supabase = getSupabaseClient(company)
    await supabase.from(tbl(company, 'Exceptions')).delete().eq('id', id)
    await load()
  }

  async function addDuty() {
    if (!dutyForm.duty_type) return
    const supabase = getSupabaseClient(company)
    const { error } = await supabase.from(tbl(company, 'Duty')).upsert({
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
    await supabase.from(tbl(company, 'Duty')).delete().eq('duty_type', duty_type).eq('date', date)
    await load()
  }

  async function updateDuty() {
    if (!editDuty) return
    const supabase = getSupabaseClient(company)
    setSavingDuty(true)
    const { error } = await supabase
      .from(tbl(company, 'Duty'))
      .upsert({ duty_type: editDuty.duty_type, date, name: editDuty.name.toUpperCase() })
    if (error) { setError(error.message) }
    else { setEditDuty(null); await load() }
    setSavingDuty(false)
  }

  function validateEditEx() {
    if (!editEx) return false
    const singleDate = SINGLE_DATE_SCOPES.includes(editEx.scope as ExceptionScope)
    const errors: Record<string, boolean> = {}
    if (!editEx.name) errors.name = true
    if (!editEx.reason.trim()) errors.reason = true
    if (!editEx.end) errors.end = true
    if (!singleDate && !editEx.start) errors.start = true
    setEditExErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function updateException() {
    if (!editEx || !validateEditEx()) return
    const supabase = getSupabaseClient(company)
    setSavingEx(true)
    const singleDate = SINGLE_DATE_SCOPES.includes(editEx.scope as ExceptionScope)
    const savedReason = editEx.scope === 'MA' && editMedCenter.trim()
      ? `${editMedCenter.trim()}: ${editEx.reason.trim()}`
      : editEx.reason.trim()
    const { error } = await supabase
      .from(tbl(company, 'Exceptions'))
      .update({
        name: editEx.name,
        scope: editEx.scope,
        reason: savedReason,
        start: singleDate ? editEx.end : editEx.start,
        end: editEx.end,
        counts_as_absence: editEx.counts_as_absence,
      })
      .eq('id', editEx.id)
    if (error) { setError(error.message) }
    else { setEditEx(null); setEditExErrors({}); await load() }
    setSavingEx(false)
  }

  async function toggleAbsence(id: number, value: boolean) {
    const supabase = getSupabaseClient(company)
    await supabase.from(tbl(company, 'Exceptions')).update({ counts_as_absence: value }).eq('id', id)
    setExceptions((prev) => prev.map((e) => e.id === id ? { ...e, counts_as_absence: value } : e))
  }

  async function saveParadeTime(parade_type: string) {
    const supabase = getSupabaseClient(company)
    setSavingParade(parade_type)
    const { error } = await supabase.from(tbl(company, 'Configuration')).upsert({ parade_type, time: paradeTimes[parade_type] })
    if (error) setError(error.message)
    setSavingParade(null)
  }

  function generate(paradeType: 'First Parade' | 'Last Parade') {
    const strOverridesAsNumbers: Record<string, Record<string, number>> = {}
    for (const [platoon, rtMap] of Object.entries(strOverrides)) {
      strOverridesAsNumbers[platoon] = {}
      for (const [rt, val] of Object.entries(rtMap)) {
        if (val !== '') strOverridesAsNumbers[platoon][rt] = Number(val)
      }
    }
    const filteredConfigs = configs.filter((c) => c.parade_type === paradeType)
    const report = generateParadeReport({
      date,
      companyLabel,
      soldiers,
      activeExceptions,
      configs: filteredConfigs,
      duties,
      strengthOverrides: strOverridesAsNumbers,
      allExceptions: exceptions,
      paradeType,
    }, PARADE_CONFIG[company])
    setOutput(report)
    setLastParadeType(paradeType)
    trackEvent('parade_state_generated', { company, soldierCount: soldiers.length, date, paradeType })
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

  function exEditInputClass(field: string) {
    const base = 'border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 w-full'
    return editExErrors[field]
      ? `${base} border-red-500 ring-2 ring-red-500`
      : `${base} border-gray-300 ${theme.focusRing}`
  }

  const dutyEditInputClass = `w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-5">
      {/* Header + date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Parade State</h2>
          <p className="text-xs text-gray-500">
            {soldiers.length - new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name)).size} / {soldiers.length} present
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

      {/* Section tabs */}
      <div className="flex border-b border-gray-200">
        {sectionTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveSection(t.id); setShowForm(false) }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeSection === t.id
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
                type="text"
                inputMode="numeric"
                pattern="[0-2][0-9]:[0-5][0-9]"
                placeholder="HH:MM"
                value={paradeTimes[pt] ?? ''}
                onChange={(e) => setParadeTimes((prev) => ({ ...prev, [pt]: e.target.value }))}
                className={`border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 ${theme.focusRing} w-24`}
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

          {/* Strength Override accordion */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowStrOverride((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                Overwrite Strength
                {anyMismatch() && (
                  <span className="text-yellow-500 text-base leading-none" title="Some overrides differ from nominal roll">⚠</span>
                )}
              </span>
              <span className="text-gray-400 text-xs">{showStrOverride ? '▲' : '▼'}</span>
            </button>

            {showStrOverride && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 pb-1">
                  <span />
                  {RANK_TYPES.map((rt) => <span key={rt} className="text-center">{rt}</span>)}
                </div>
                {STR_PLATOONS.map((platoon) => (
                  <div key={platoon} className="grid grid-cols-4 gap-2 items-center">
                    <span className="text-xs font-medium text-gray-600">
                      {platoon === 'Total' ? 'Total Coy' : platoon === 'HQ' ? 'HQ' : `PLT ${platoon}`}
                    </span>
                    {RANK_TYPES.map((rt) => {
                      const warn = strWarn(platoon, rt)
                      const computed = computedStrength[platoon]?.[rt] ?? 0
                      return (
                        <input
                          key={rt}
                          type="number"
                          min="0"
                          placeholder={String(computed)}
                          value={strOverrides[platoon]?.[rt] ?? ''}
                          title={warn ?? undefined}
                          onChange={(e) => {
                            const val = e.target.value
                            setStrOverrides((prev) => ({
                              ...prev,
                              [platoon]: { ...prev[platoon], [rt]: val },
                            }))
                          }}
                          onBlur={(e) => saveStrengthCell(platoon, rt, e.target.value)}
                          className={`w-full border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 ${theme.focusRing} ${warn ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-300'}`}
                        />
                      )
                    })}
                  </div>
                ))}
                <p className="text-xs text-gray-400 pt-1">Placeholders show nominal roll counts. Edits auto-save on blur.</p>
              </div>
            )}
          </div>
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
                      className={`flex-none px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${dutyForm.duty_type === d
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
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {duties.map((d, i) => {
                      const isEditing = editDuty?.duty_type === d.duty_type
                      return (
                        <tr
                          key={d.duty_type}
                          className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium">{d.duty_type}</td>
                          {isEditing ? (
                            <>
                              <td className="px-2 py-2">
                                <SoldierSearch
                                  soldiers={soldiers}
                                  value={editDuty.name}
                                  onChange={(name) => setEditDuty({ ...editDuty, name })}
                                  inputClass={dutyEditInputClass}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex gap-1 justify-end">
                                  <button
                                    onClick={updateDuty}
                                    disabled={savingDuty}
                                    className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50`}
                                  >
                                    {savingDuty ? '…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditDuty(null)}
                                    className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-gray-600">{d.name ? displayName(d.name, soldiers) : 'TBC'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-end items-center">
                                  <button
                                    onClick={() => confirmDeleteDuty === d.duty_type
                                      ? (setConfirmDeleteDuty(null), deleteDuty(d.duty_type))
                                      : setEditDuty({ duty_type: d.duty_type, name: d.name ?? '' })}
                                    className={confirmDeleteDuty === d.duty_type
                                      ? 'px-3 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm'
                                      : 'text-gray-400 hover:text-gray-600 transition-colors text-xl p-3'}
                                    title={confirmDeleteDuty === d.duty_type ? 'Confirm delete' : 'Edit'}
                                  >
                                    {confirmDeleteDuty === d.duty_type ? 'Yes' : '✎'}
                                  </button>
                                  <button
                                    onClick={() => confirmDeleteDuty === d.duty_type ? setConfirmDeleteDuty(null) : setConfirmDeleteDuty(d.duty_type)}
                                    className={confirmDeleteDuty === d.duty_type
                                      ? 'px-3 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 text-sm font-semibold rounded-xl transition-colors'
                                      : 'text-gray-400 hover:text-red-500 transition-colors text-xl p-3'}
                                    title={confirmDeleteDuty === d.duty_type ? 'Cancel' : 'Remove'}
                                  >
                                    {confirmDeleteDuty === d.duty_type ? 'No' : '✕'}
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
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
              onClick={() => {
                if (showForm) {
                  setExForm({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true })
                  setStatusRows([{ start: date, end: date, reason: '' }])
                  setMedCenter('')
                }
                setShowForm(!showForm)
              }}
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
                        onClick={() => setExForm({ ...exForm, scope: s, counts_as_absence: ABSENCE_SCOPES.includes(s) })}
                        className={`flex-none px-3 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${exForm.scope === s
                            ? `${theme.buttonBg} ${theme.buttonHoverBg} text-white border-transparent`
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exForm.counts_as_absence}
                    onChange={(e) => setExForm({ ...exForm, counts_as_absence: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  Counts as absence
                </label>

                {exForm.scope === 'Status' ? (
                  <>
                    {statusRows.map((row, i) => {
                      const allReasons = statusRows.map((r) => r.reason.trim().toLowerCase())
                      const isDupe = row.reason.trim() !== '' && allReasons.filter((r) => r === row.reason.trim().toLowerCase()).length > 1
                      return (
                        <div key={i} className={`space-y-3 ${i > 0 ? 'pt-3 border-t border-gray-200' : ''}`}>
                          {statusRows.length > 1 && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setStatusRows((r) => r.filter((_, j) => j !== i))}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              >
                                × Remove
                              </button>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">From</label>
                              <input
                                type="date"
                                value={row.start}
                                onChange={(e) => setStatusRows((r) => r.map((x, j) => j === i ? { ...x, start: e.target.value } : x))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">To</label>
                              <input
                                type="date"
                                value={row.end}
                                onChange={(e) => setStatusRows((r) => r.map((x, j) => j === i ? { ...x, end: e.target.value } : x))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs mb-1">
                              {isDupe
                                ? <span className="text-yellow-500 font-medium">Reason must be unique across entries</span>
                                : <span className="text-gray-500">Reason</span>
                              }
                            </label>
                            <input
                              type="text"
                              placeholder={REASON_HINTS['Status']}
                              value={row.reason}
                              onChange={(e) => setStatusRows((r) => r.map((x, j) => j === i ? { ...x, reason: e.target.value } : x))}
                              className={isDupe
                                ? `${inputClass} !border-yellow-300 !ring-2 !ring-yellow-200`
                                : inputClass}
                            />
                          </div>
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setStatusRows((r) => [...r, { start: date, end: date, reason: '' }])}
                      className="w-full py-2 text-sm text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 rounded-xl transition-colors"
                    >
                      + Add Status
                    </button>
                  </>
                ) : singleDate ? (
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

                {exForm.scope === 'MA' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Medical Center</label>
                    <input
                      type="text"
                      placeholder="e.g. Kranji Camp Medical Centre"
                      value={medCenter}
                      onChange={(e) => setMedCenter(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                {exForm.scope !== 'Status' && (
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
                )}

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
                      <th className="px-4 py-3 font-medium text-gray-500 text-center">Absent</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Period</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Reason</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {activeExceptions.map((e, i) => {
                      const isEditing = editEx?.id === e.id
                      const editSingleDate = isEditing && SINGLE_DATE_SCOPES.includes(editEx!.scope as ExceptionScope)
                      const today = todayISO()
                      const startAfter = !!e.start && e.start > today
                      const endBefore = !!e.end && e.end < today
                      const isWarned = !isEditing && (startAfter || endBefore)
                      return (
                        <React.Fragment key={e.id}>
                          <tr className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30 border-b-0' : ''} ${isWarned ? 'opacity-70 bg-yellow-50/40' : ''}`}>
                            {isEditing ? (
                              <>
                                <td className="px-2 py-2">
                                  <SoldierSearch
                                    soldiers={soldiers}
                                    value={editEx!.name}
                                    onChange={(name) => setEditEx({ ...editEx!, name })}
                                    inputClass={exEditInputClass('name')}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {EXCEPTION_SCOPES.map((s) => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => setEditEx({ ...editEx!, scope: s })}
                                        className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${editEx!.scope === s
                                            ? `${theme.buttonBg} text-white border-transparent`
                                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                          }`}
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={editEx!.counts_as_absence}
                                    onChange={(e2) => setEditEx({ ...editEx!, counts_as_absence: e2.target.checked })}
                                    className="w-4 h-4 rounded"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  {editSingleDate ? (
                                    <input
                                      type="date"
                                      value={editEx!.end}
                                      onChange={(e2) => setEditEx({ ...editEx!, end: e2.target.value, start: e2.target.value })}
                                      className={exEditInputClass('end')}
                                    />
                                  ) : (
                                    <div className="flex gap-1 items-center">
                                      <input
                                        type="date"
                                        value={editEx!.start}
                                        onChange={(e2) => setEditEx({ ...editEx!, start: e2.target.value })}
                                        className={exEditInputClass('start')}
                                      />
                                      <span className="text-gray-400 text-xs shrink-0">–</span>
                                      <input
                                        type="date"
                                        value={editEx!.end}
                                        onChange={(e2) => setEditEx({ ...editEx!, end: e2.target.value })}
                                        className={exEditInputClass('end')}
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {editEx!.scope === 'MA' && (
                                    <input
                                      type="text"
                                      value={editMedCenter}
                                      onChange={(e2) => setEditMedCenter(e2.target.value)}
                                      placeholder="Medical Center"
                                      className={`${exEditInputClass('reason')} mb-1`}
                                    />
                                  )}
                                  <input
                                    type="text"
                                    value={editEx!.reason}
                                    onChange={(e2) => setEditEx({ ...editEx!, reason: e2.target.value })}
                                    onKeyDown={(e2) => {
                                      if (e2.key === 'Enter') updateException()
                                      if (e2.key === 'Escape') { setEditEx(null); setEditExErrors({}) }
                                    }}
                                    placeholder={REASON_HINTS[editEx!.scope as ExceptionScope]}
                                    className={exEditInputClass('reason')}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex gap-1 justify-end">
                                    <button
                                      onClick={updateException}
                                      disabled={savingEx}
                                      className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50`}
                                    >
                                      {savingEx ? '…' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => { setEditEx(null); setEditExErrors({}) }}
                                      className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className={`px-4 py-3 font-medium whitespace-nowrap${isWarned ? ' border-l-2 border-yellow-300' : ''}`}>{displayName(e.name, soldiers)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block ${theme.badgeBg} ${theme.badgeText} text-xs font-medium px-2 py-0.5 rounded-lg whitespace-nowrap`}>
                                    {e.scope ?? '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={e.counts_as_absence}
                                    onChange={(ev) => toggleAbsence(e.id, ev.target.checked)}
                                    className="w-4 h-4 rounded cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                  {e.start && e.end ? (
                                    <>
                                      <span className={startAfter ? 'bg-yellow-100 rounded px-0.5' : ''}>{toSGDate(e.start)}</span>
                                      {' – '}
                                      <span className={endBefore ? 'bg-yellow-100 rounded px-0.5' : ''}>{toSGDate(e.end)}</span>
                                    </>
                                  ) : '—'}
                                </td>
                                <td className="px-4 py-3 text-gray-500">{e.reason ?? '—'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1 justify-end items-center">
                                    <button
                                      onClick={() => confirmDeleteEx === e.id
                                        ? (setConfirmDeleteEx(null), deleteException(e.id))
                                        : (() => {
                                          if (e.scope === 'MA') {
                                            const idx = e.reason.indexOf(': ')
                                            if (idx !== -1) {
                                              setEditMedCenter(e.reason.slice(0, idx))
                                              setEditEx({ ...e, reason: e.reason.slice(idx + 2) })
                                            } else {
                                              setEditMedCenter('')
                                              setEditEx({ ...e })
                                            }
                                          } else {
                                            setEditMedCenter('')
                                            setEditEx({ ...e })
                                          }
                                          setEditExErrors({})
                                        })()}
                                      className={confirmDeleteEx === e.id
                                        ? 'px-3 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600 transition-colors text-xl p-3'}
                                      title={confirmDeleteEx === e.id ? 'Confirm delete' : 'Edit'}
                                    >
                                      {confirmDeleteEx === e.id ? 'Yes' : '✎'}
                                    </button>
                                    <button
                                      onClick={() => confirmDeleteEx === e.id ? setConfirmDeleteEx(null) : setConfirmDeleteEx(e.id)}
                                      className={confirmDeleteEx === e.id
                                        ? 'px-3 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 text-sm font-semibold rounded-xl transition-colors'
                                        : 'text-gray-400 hover:text-red-500 transition-colors text-xl p-3'}
                                      title={confirmDeleteEx === e.id ? 'Cancel' : 'Remove'}
                                    >
                                      {confirmDeleteEx === e.id ? 'No' : '✕'}
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generate buttons */}
      <div className="pt-2 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-3">
          {(['First Parade', 'Last Parade'] as const).map((pt) => (
            <button
              key={pt}
              onClick={() => generate(pt)}
              className={`py-4 ${theme.buttonBg} ${theme.buttonHoverBg} text-white font-semibold rounded-2xl transition-colors text-sm tracking-wide`}
            >
              {pt}
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      {output && (
        <div ref={scrollRef} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Report{lastParadeType ? ` — ${lastParadeType}` : ''}
            </h3>
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
