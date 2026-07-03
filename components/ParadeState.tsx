'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { supabase, tbl } from '@/lib/supabase'
import { displayName } from '@/lib/supabase'
import type { Soldier, Exception, DutyEntry, Configuration } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES, PARADE_CONFIG, getRankType, RANK_TYPES, RANK_ORDER, DEFAULT_RANK_RULES, ALL_DUTY_TYPES } from '@/lib/companies'
import { dutyRules } from '@/lib/duty-rules'
import { useConfirmDelete } from '@/lib/hooks'
import SearchDropdown from '@/components/SearchDropdown'
import { track } from '@vercel/analytics'
import { generateParadeReport } from '@/lib/parade-report'

function fieldInputClass(hasError: boolean, focusRing: string) {
  const base = 'border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 w-full'
  return hasError ? `${base} border-red-500 ring-2 ring-red-500` : `${base} border-gray-300 ${focusRing}`
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

const ABSENCE_SCOPES: ExceptionScope[] = ['Att C', 'Off/Leave', 'MA']

type ExForm = { name: string; scope: ExceptionScope; reason: string; start: string; end: string; counts_as_absence: boolean; time: string }

const PARADE_TYPES = ['First Parade', 'Last Parade'] as const

const STR_PLATOONS = ['Total', 'HQ', '1', '2', '3', '4'] as const

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

function offsetDate(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
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
  const [exceptionsSortKey, setExceptionsSortKey] = useState<'four_d' | 'name' | 'scope' | 'reason' | 'start' | 'end' | null>(null)
  const [exceptionsSortDir, setExceptionsSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [exceptionShowAll, setExceptionShowAll] = useState(false)


  // Strength overrides
  const [strOverrides, setStrOverrides] = useState<Record<string, Record<string, string>>>({})
  const [showStrOverride, setShowStrOverride] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [exForm, setExForm] = useState<ExForm>({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true, time: '' })
  const [exAbsenceTouched, setExAbsenceTouched] = useState(false)
  const [editAbsenceTouched, setEditAbsenceTouched] = useState(false)
  const [medCenter, setMedCenter] = useState('')
  const [editMedCenter, setEditMedCenter] = useState('')
  const [statusRows, setStatusRows] = useState<{ start: string; end: string; reason: string }[]>([{ start: date, end: date, reason: '' }])
  const [paradeTimes, setParadeTimes] = useState<Record<string, string>>({ 'First Parade': '09:30', 'Last Parade': '17:30' })
  const [savingParade, setSavingParade] = useState<string | null>(null)

  // Duties inline edit
  const [editDuty, setEditDuty] = useState<{ duty_type: string; name: string } | null>(null)
  const [savingDuty, setSavingDuty] = useState(false)
  const dutyConfirm = useConfirmDelete<string>()

  // Duty rank rule editor
  const [showRankRules, setShowRankRules] = useState(false)
  const [editRankRules, setEditRankRules] = useState<Record<string, { from: string; to: string }>>({})
  const [savingRankRules, setSavingRankRules] = useState(false)

  // Exceptions inline edit
  const [editEx, setEditEx] = useState<Exception | null>(null)
  const [exSearch, setExSearch] = useState('')
  const [editExErrors, setEditExErrors] = useState<Record<string, boolean>>({})
  const [addExErrors, setAddExErrors] = useState<Record<string, boolean>>({})
  const [savingEx, setSavingEx] = useState(false)
  const exConfirm = useConfirmDelete<number>()

  useEffect(() => {
    load()
  }, [company, date])

  async function load() {
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

  function toggleExceptionsSort(key: 'four_d' | 'name' | 'scope' | 'reason' | 'start' | 'end') {
    if (exceptionsSortKey !== key) { setExceptionsSortKey(key); setExceptionsSortDir('asc') }
    else if (exceptionsSortDir === 'asc') setExceptionsSortDir('desc')
    else { setExceptionsSortKey(null); setExceptionsSortDir('asc') }
  }

  function exceptionSortValue(e: Exception, key: 'four_d' | 'name' | 'scope' | 'reason' | 'start' | 'end'): string | number {
    switch (key) {
      case 'four_d': return (soldiers.find((s) => s.name === e.name)?.four_d ?? '').toLowerCase()
      case 'name': return e.name.toLowerCase()
      case 'scope': return (e.scope ?? '').toLowerCase()
      case 'reason': return (e.reason ?? '').toLowerCase()
      case 'start': return new Date(e.start ?? 0).getTime()
      case 'end': return new Date(e.end ?? 0).getTime()
    }
  }

  const sortedExceptions = [...exceptions].sort((a, b) => {
    if (!exceptionsSortKey) {
      const dateA = new Date(a.start ?? 0).getTime()
      const dateB = new Date(b.start ?? 0).getTime()
      return dateA - dateB || a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    }
    const va = exceptionSortValue(a, exceptionsSortKey)
    const vb = exceptionSortValue(b, exceptionsSortKey)
    const cmp = typeof va === 'number' ? va - (vb as number) : va.localeCompare(vb as string)
    return exceptionsSortDir === 'asc' ? cmp : -cmp
  })

  const query = search.trim().toLowerCase()
  const queriedExceptions = sortedExceptions.filter((e) => {
    if (query) return (
      (e.name ?? '').toLowerCase().includes(query) ||
      (e.reason ?? '').toLowerCase().includes(query) ||
      (String(e.scope ?? '')).toLowerCase().includes(query) ||
      (soldiers.find((s) => s.name === e.name)?.four_d ?? '').toLowerCase().includes(query)
    )
  }
  )

  const defaultExceptions = sortedExceptions
    .filter((e) => {
      const d = new Date(date)
      const start = e.start ? new Date(e.start) : null
      const end = e.end ? new Date(e.end) : null
      if (start && d < start) return false
      if (end && d > end) return false

      return true

    })



  // If there's a query, use the queried exceptions; otherwise, filter by date and sort
  let activeExceptions = (
    query
      ? queriedExceptions
      : (exceptionShowAll ? sortedExceptions : defaultExceptions)
  )

  const eligibilityOverrides = useMemo(() => {
    const ov: Record<string, string[]> = {}
    for (const c of configs) {
      if (!c.parade_type.startsWith('eligible_')) continue
      try { ov[c.parade_type.replace('eligible_', '')] = JSON.parse(c.time) } catch { }
    }
    return ov
  }, [configs])

  const rankRuleOverrides = useMemo(() => {
    const ov: Record<string, { from: string; to: string }> = {}
    for (const c of configs) {
      if (!c.parade_type.startsWith('rank_rule_')) continue
      try { ov[c.parade_type.replace('rank_rule_', '')] = JSON.parse(c.time) } catch { }
    }
    return ov
  }, [configs])

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
    if (override !== computed) return `Nominal roll has ${computed} – override is ${override}`
    return null
  }

  function anyMismatch(): boolean {
    return STR_PLATOONS.some((p) => RANK_TYPES.some((rt) => strWarn(p, rt) !== null))
  }

  async function saveStrengthCell(platoon: string, rt: string, val: string) {
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

  function isValidTime(t: string) {
    if (!t) return true
    const m = t.match(/^(\d{2}):(\d{2})$/)
    return !!m && +m[1] <= 23 && +m[2] <= 59
  }

  function buildReason(mainReason: string, medCenterVal: string, scope: ExceptionScope): string | null {
    const r = mainReason.trim()
    if (scope !== 'MA') return r || null
    const mc = medCenterVal.trim()
    if (mc && r) return `${mc}: ${r}`
    return mc || r || null
  }

  function isExceptionValid() {
    if (!exForm.name) return false
    if (exForm.scope === 'Status') {
      const reasons = statusRows.map((r) => r.reason.trim().toLowerCase()).filter((r) => r)
      return new Set(reasons).size === reasons.length
    }
    return isValidTime(exForm.time)
  }

  function validateAddEx() {
    const errors: Record<string, boolean> = {}
    if (!exForm.name) errors.name = true
    if (exForm.scope === 'MA' && !isValidTime(exForm.time)) errors.time = true
    setAddExErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function addException() {
    if (!validateAddEx() || !isExceptionValid()) return
    let error: { message: string } | null = null
    if (exForm.scope === 'Status') {
      const rows = statusRows.map((r) => ({ name: exForm.name, scope: exForm.scope, reason: r.reason.trim() || null, start: r.start || null, end: r.end || null, counts_as_absence: exForm.counts_as_absence }))
        ; ({ error } = await supabase.from(tbl(company, 'Exceptions')).insert(rows))
    } else {
      const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
        ; ({ error } = await supabase.from(tbl(company, 'Exceptions')).insert({
          name: exForm.name,
          scope: exForm.scope,
          reason: buildReason(exForm.reason, medCenter, exForm.scope),
          start: (singleDate ? exForm.end : exForm.start) || null,
          end: exForm.end || null,
          counts_as_absence: exForm.counts_as_absence,
          ...(exForm.scope === 'MA' && exForm.time ? { time: exForm.time } : {}),
        }))
    }
    if (error) { setError(error.message); return }
    setShowForm(false)
    setExForm({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true, time: '' })
    setExAbsenceTouched(false)
    setStatusRows([{ start: date, end: date, reason: '' }])
    setMedCenter('')
    setAddExErrors({})
    await load()
  }

  async function deleteException(id: number) {
    await supabase.from(tbl(company, 'Exceptions')).delete().eq('id', id)
    await load()
  }

  async function deleteDuty(duty_type: string) {
    await supabase.from(tbl(company, 'Duty')).delete().eq('duty_type', duty_type).eq('date', date)
    await load()
  }

  async function updateDuty() {
    if (!editDuty) return
    setSavingDuty(true)
    const { error } = await supabase
      .from(tbl(company, 'Duty'))
      .upsert({ duty_type: editDuty.duty_type, date, name: editDuty.name.toUpperCase() })
    if (error) { setError(error.message) }
    else { setEditDuty(null); await load() }
    setSavingDuty(false)
  }

  function isEditExceptionValid() {
    if (!editEx) return false
    if (!editEx.name) return false
    if (editEx.scope === 'MA' && !isValidTime(editEx.time ?? '')) return false
    return true
  }

  function validateEditEx() {
    if (!editEx) return false
    const errors: Record<string, boolean> = {}
    if (!editEx.name) errors.name = true
    if (editEx.scope === 'MA' && !isValidTime(editEx.time ?? '')) errors.time = true
    setEditExErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function updateException() {
    if (!editEx || !validateEditEx()) return
    setSavingEx(true)
    const singleDate = SINGLE_DATE_SCOPES.includes(editEx.scope as ExceptionScope)
    const { error } = await supabase
      .from(tbl(company, 'Exceptions'))
      .update({
        name: editEx.name,
        scope: editEx.scope,
        reason: buildReason(editEx.reason ?? '', editMedCenter, editEx.scope as ExceptionScope),
        start: (singleDate ? editEx.end : editEx.start) || null,
        end: editEx.end || null,
        counts_as_absence: editEx.counts_as_absence,
        time: editEx.scope === 'MA' ? (editEx.time || null) : null,
      })
      .eq('id', editEx.id)
    if (error) { setError(error.message) }
    else { setEditEx(null); setEditExErrors({}); setEditMedCenter(''); await load() }
    setSavingEx(false)
  }

  async function toggleAbsence(id: number, value: boolean) {
    await supabase.from(tbl(company, 'Exceptions')).update({ counts_as_absence: value }).eq('id', id)
    setExceptions((prev) => prev.map((e) => e.id === id ? { ...e, counts_as_absence: value } : e))
  }

  async function saveParadeTime(parade_type: string) {
    setSavingParade(parade_type)
    const { error } = await supabase.from(tbl(company, 'Configuration')).upsert({ parade_type, time: paradeTimes[parade_type] })
    if (error) setError(error.message)
    setSavingParade(null)
  }

  async function saveRankRules() {
    setSavingRankRules(true)
    const dutyTypes: string[] = ['CDO', 'CDS', 'PDS1', 'PDS2', 'PDS3', 'PDS4', 'COS']
    const rows = dutyTypes.map(dt => ({
      parade_type: `rank_rule_${dt}`,
      time: JSON.stringify(editRankRules[dt] ?? DEFAULT_RANK_RULES[dt] ?? { from: 'REC', to: 'ME8' }),
    }))
    const { error } = await supabase.from(tbl(company, 'Configuration')).upsert(rows, { onConflict: 'parade_type' } as any)
    if (error) setError(error.message)
    else { await load(); setShowRankRules(false) }
    setSavingRankRules(false)
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
    }, PARADE_CONFIG[company], company)
    setOutput(report)
    setLastParadeType(paradeType)
    track('parade_state_generated', { company, soldierCount: soldiers.length, date, paradeType })
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

  const exClass = (field: string) => fieldInputClass(!!editExErrors[field], theme.focusRing)
  const addExClass = (field: string) => addExErrors[field]
    ? 'w-full border border-red-500 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 ring-2 ring-red-500'
    : inputClass

  const soldierDropdownProps = {
    getKey: (s: Soldier) => s.name,
    getLabel: (s: Soldier) => `${s.rank} ${s.name}`,
    matches: (s: Soldier, q: string) => `${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase()),
    renderOption: (s: Soldier) => (
      <div className="flex gap-2">
        <span className="font-mono text-xs text-gray-400 w-12 shrink-0 pt-0.5">{s.rank}</span>
        <span className="font-medium text-gray-800">{s.name}</span>
      </div>
    ),
    placeholder: 'Search soldier...',
  }

  const dutyEditInputClass = `w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-800">Parade State</h2>
        <p className="text-xs text-gray-500">
          {soldiers.length - new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name)).size} / {soldiers.length} present
          {activeExceptions.length > 0 && ` · ${activeExceptions.length} exception${activeExceptions.length !== 1 ? 's' : ''}`}
        </p>
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
                placeholder="HH:MM"
                maxLength={5}
                value={paradeTimes[pt] ?? ''}
                onChange={(e) => setParadeTimes((prev) => ({ ...prev, [pt]: e.target.value }))}
                className={`border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 w-24 ${paradeTimes[pt] && !isValidTime(paradeTimes[pt])
                    ? 'border-yellow-300 ring-2 ring-yellow-200'
                    : `border-gray-300 ${theme.focusRing}`
                  }`}
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
                  <span className="text-yellow-500 text-base leading-none" title="Some overrides differ from nominal roll">✏️</span>
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
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setDate(offsetDate(date, -1))} className="px-3 py-2 text-gray-500 hover:text-gray-800 text-lg transition-colors">←</button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`}
            />
            <button onClick={() => setDate(offsetDate(date, 1))} className="px-3 py-2 text-gray-500 hover:text-gray-800 text-lg transition-colors">→</button>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => {
                if (!showRankRules) {
                  const dutyTypes: string[] = ['CDO', 'CDS', 'PDS1', 'PDS2', 'PDS3', 'PDS4', 'COS']
                  setEditRankRules(Object.fromEntries(dutyTypes.map(dt => [dt, rankRuleOverrides[dt] ?? DEFAULT_RANK_RULES[dt] ?? { from: 'REC', to: 'ME8' }])))
                }
                setShowRankRules(v => !v)
              }}
              title="Edit Duty Rank Rules"
              className={`shrink-0 p-2.5 rounded-xl transition-colors ${showRankRules ? `${theme.buttonBg} text-white` : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Rank rule editor – triggered by gear icon above */}
          {showRankRules && (() => {
            const dutyTypes: string[] = ['CDO', 'CDS', 'PDS1', 'PDS2', 'PDS3', 'PDS4', 'COS']
            return (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
                <p className="text-xs text-gray-500">Set the eligible rank range for each duty type.</p>
                {dutyTypes.map(dt => {
                  const rule = editRankRules[dt] ?? DEFAULT_RANK_RULES[dt] ?? { from: 'REC', to: 'ME8' }
                  return (
                    <div key={dt} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-600 uppercase w-10 shrink-0">{dt}</span>
                      <select
                        value={rule.from}
                        onChange={e => setEditRankRules(p => ({ ...p, [dt]: { ...rule, from: e.target.value } }))}
                        className={`text-xs border border-gray-300 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 ${theme.focusRing} bg-white text-gray-700 flex-1`}
                      >
                        {RANK_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="text-xs text-gray-400 shrink-0">–</span>
                      <select
                        value={rule.to}
                        onChange={e => setEditRankRules(p => ({ ...p, [dt]: { ...rule, to: e.target.value } }))}
                        className={`text-xs border border-gray-300 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 ${theme.focusRing} bg-white text-gray-700 flex-1`}
                      >
                        {RANK_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )
                })}
                <button
                  onClick={saveRankRules}
                  disabled={savingRankRules}
                  className={`px-4 py-2 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors`}
                >
                  {savingRankRules ? 'Saving…' : 'Save Rules'}
                </button>
              </div>
            )
          })()}

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
                  {ALL_DUTY_TYPES.map((dt, i) => {
                    const d = duties.find(x => x.duty_type === dt)
                    const isEditing = editDuty?.duty_type === dt
                    return (
                      <tr
                        key={dt}
                        className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium">{dt}</td>
                        {isEditing ? (
                          <>
                            <td className="px-2 py-2">
                              <SearchDropdown
                                {...soldierDropdownProps}
                                items={dutyRules.eligibleSoldiers(editDuty.duty_type, soldiers, eligibilityOverrides, rankRuleOverrides)}
                                value={editDuty.name}
                                onChange={name => setEditDuty({ ...editDuty, name })}
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
                            <td className="px-4 py-3 text-gray-600">{d?.name ? displayName(d.name, soldiers) : '–'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-end items-center">
                                <button
                                  onClick={() => setEditDuty({ duty_type: dt, name: d?.name ?? '' })}
                                  className="text-gray-400 hover:text-gray-600 transition-colors text-xl p-3"
                                  title="Edit"
                                >
                                  ✎
                                </button>
                                {d && (
                                  <button
                                    onClick={() => dutyConfirm.isConfirming(dt) ? dutyConfirm.resolve(dt, () => deleteDuty(dt)) : dutyConfirm.request(dt)}
                                    className={dutyConfirm.isConfirming(dt)
                                      ? 'px-3 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm'
                                      : 'text-gray-400 hover:text-red-500 transition-colors text-xl p-3'}
                                    title={dutyConfirm.isConfirming(dt) ? 'Confirm clear' : 'Clear'}
                                  >
                                    {dutyConfirm.isConfirming(dt) ? 'Yes' : '✕'}
                                  </button>
                                )}
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
        </div>
      )}

      {/* Exceptions section */}
      {activeSection === 'exceptions' && (

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input
              type="search"
              placeholder="Search by name, scope, reason, 4D..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            />
            <div className="flex-shrink-0">
              <button
                onClick={() => {
                  if (showForm) {
                    setExForm({ name: '', scope: 'Off/Leave', reason: '', start: date, end: date, counts_as_absence: true, time: '' })
                    setExAbsenceTouched(false)
                    setStatusRows([{ start: date, end: date, reason: '' }])
                    setMedCenter('')
                    setAddExErrors({})
                  }
                  setShowForm(!showForm)
                }}
                className={`px-4 py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors`}
              >
                {showForm ? 'Cancel' : '+ Exception'}
              </button>
            </div>
          </div>

          {showForm && (() => {
            const singleDate = SINGLE_DATE_SCOPES.includes(exForm.scope)
            return (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Soldier <span className="text-red-500">*</span></label>
                  <SearchDropdown
                    {...soldierDropdownProps}
                    items={soldiers}
                    value={exForm.name}
                    onChange={name => setExForm({ ...exForm, name })}
                    inputClass={addExClass('name')}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-2">Scope <span className="text-red-500">*</span></label>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {EXCEPTION_SCOPES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setExForm({ ...exForm, scope: s, counts_as_absence: exAbsenceTouched ? exForm.counts_as_absence : ABSENCE_SCOPES.includes(s) })}
                        className={`flex-none px-3 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${exForm.scope === s
                          ? `${theme.buttonBg} ${theme.buttonHoverBg} text-white border-transparent`
                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

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
                                className={inputClass} />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">To</label>
                              <input
                                type="date"
                                value={row.end}
                                onChange={(e) => setStatusRows((r) => r.map((x, j) => j === i ? { ...x, end: e.target.value } : x))}
                                className={inputClass} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs mb-1">
                              {isDupe
                                ? <span className="text-yellow-500 font-medium">Reason must be unique across entries</span>
                                : <span className="text-gray-500">Reason</span>}
                            </label>
                            <input
                              type="text"
                              placeholder={REASON_HINTS['Status']}
                              value={row.reason}
                              onChange={(e) => setStatusRows((r) => r.map((x, j) => j === i ? { ...x, reason: e.target.value } : x))}
                              className={isDupe
                                ? `${inputClass} !border-yellow-300 !ring-2 !ring-yellow-200`
                                : inputClass} />
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
                      className={addExClass('end')} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <input
                        type="date"
                        value={exForm.start}
                        onChange={(e) => setExForm({ ...exForm, start: e.target.value })}
                        className={addExClass('start')} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To</label>
                      <input
                        type="date"
                        value={exForm.end}
                        onChange={(e) => setExForm({ ...exForm, end: e.target.value })}
                        className={addExClass('end')} />
                    </div>
                  </div>
                )}

                {exForm.scope === 'MA' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Medical Center</label>
                      <input
                        type="text"
                        placeholder="e.g. CGH, NUH, Raffles"
                        value={medCenter}
                        onChange={(e) => setMedCenter(e.target.value)}
                        className={addExClass('medCenter')} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Appointment Time (optional)</label>
                      <input
                        type="time"
                        value={exForm.time}
                        onChange={(e) => setExForm({ ...exForm, time: e.target.value })}
                        className={addExClass('time')} />
                    </div>
                  </>
                )}

                {exForm.scope !== 'Status' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Reason</label>
                    <input
                      type="text"
                      placeholder={REASON_HINTS[exForm.scope]}
                      value={exForm.reason}
                      onChange={(e) => setExForm({ ...exForm, reason: e.target.value })}
                      className={addExClass('reason')} />
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-700 -mx-1 px-1 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={exForm.counts_as_absence}
                    onChange={(e) => { setExForm({ ...exForm, counts_as_absence: e.target.checked }); setExAbsenceTouched(true) }}
                  />
                  Absent?
                </label>

                <button
                  onClick={addException}
                  disabled={!isExceptionValid()}
                  className={`w-full py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Add Exception
                </button>
              </div>
            )
          })()}

          {activeExceptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <div>
                {query
                  ? 'No exceptions match that query.'
                  : 'No exceptions for this date.'}
              </div>
              <button
                type="button"
                onClick={() => setExceptionShowAll(true)}
                className="mt-3 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Show all
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">
                        <button onClick={() => toggleExceptionsSort('four_d')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                          4D
                          {exceptionsSortKey === 'four_d' && <span className="text-xs">{exceptionsSortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">
                        <button onClick={() => toggleExceptionsSort('name')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                          Name
                          {exceptionsSortKey === 'name' && <span className="text-xs">{exceptionsSortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">
                        <button onClick={() => toggleExceptionsSort('scope')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                          Scope
                          {exceptionsSortKey === 'scope' && <span className="text-xs">{exceptionsSortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">
                        <button onClick={() => toggleExceptionsSort('reason')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                          Reason
                          {exceptionsSortKey === 'reason' && <span className="text-xs">{exceptionsSortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">
                        <button onClick={() => toggleExceptionsSort('start')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                          Start
                          {exceptionsSortKey === 'start' && <span className="text-xs">{exceptionsSortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">
                        <button onClick={() => toggleExceptionsSort('end')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                          End
                          {exceptionsSortKey === 'end' && <span className="text-xs">{exceptionsSortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Absent?</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {activeExceptions.map((e, i) => {
                      const isEditing = editEx?.id === e.id
                      const editSingleDate = isEditing && SINGLE_DATE_SCOPES.includes(editEx!.scope as ExceptionScope)
                      return (
                        <React.Fragment key={e.id}>
                          <tr className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30 border-b-0' : ''}`}>
                            {isEditing ? (
                              <>
                                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                                  {soldiers.find((s) => s.name === editEx!.name)?.four_d ?? '–'}
                                </td>
                                <td className="px-2 py-2">
                                  <SearchDropdown
                                    {...soldierDropdownProps}
                                    items={soldiers}
                                    value={editEx!.name}
                                    onChange={name => setEditEx({ ...editEx!, name })}
                                    inputClass={exClass('name')}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {EXCEPTION_SCOPES.map((s) => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => setEditEx({ ...editEx!, scope: s, counts_as_absence: editAbsenceTouched ? editEx!.counts_as_absence : ABSENCE_SCOPES.includes(s) })}
                                        className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${editEx!.scope === s
                                          ? `${theme.buttonBg} text-white border-transparent`
                                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  {editEx!.scope === 'MA' ? (
                                    <div className="space-y-1">
                                      <input
                                        type="text"
                                        value={editMedCenter}
                                        onChange={(e2) => setEditMedCenter(e2.target.value)}
                                        placeholder="Medical Center"
                                        className={exClass('reason')} />
                                      <input
                                        type="text"
                                        value={editEx!.reason ?? ''}
                                        onChange={(e2) => setEditEx({ ...editEx!, reason: e2.target.value })}
                                        onKeyDown={(e2) => {
                                          if (e2.key === 'Enter') updateException()
                                          if (e2.key === 'Escape') { setEditEx(null); setEditExErrors({}) }
                                        }}
                                        placeholder={REASON_HINTS['MA']}
                                        className={exClass('reason')} />
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      value={editEx!.reason ?? ''}
                                      onChange={(e2) => setEditEx({ ...editEx!, reason: e2.target.value })}
                                      onKeyDown={(e2) => {
                                        if (e2.key === 'Enter') updateException()
                                        if (e2.key === 'Escape') { setEditEx(null); setEditExErrors({}) }
                                      }}
                                      placeholder={REASON_HINTS[editEx!.scope as ExceptionScope]}
                                      className={exClass('reason')} />
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {editSingleDate ? (
                                    <div className="space-y-1">
                                      <input
                                        type="date"
                                        value={editEx!.end ?? ''}
                                        onChange={(e2) => setEditEx({ ...editEx!, end: e2.target.value, start: e2.target.value })}
                                        className={exClass('start')} />
                                      {editEx!.scope === 'MA' && (
                                        <input
                                          type="time"
                                          value={editEx!.time ?? ''}
                                          onChange={(e2) => setEditEx({ ...editEx!, time: e2.target.value })}
                                          className={exClass('time')} />
                                      )}
                                    </div>
                                  ) : (
                                    <input
                                      type="date"
                                      value={editEx!.start ?? ''}
                                      onChange={(e2) => setEditEx({ ...editEx!, start: e2.target.value })}
                                      className={exClass('start')} />
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {editSingleDate ? (
                                    <span className="text-gray-400 text-xs">same as start</span>
                                  ) : (
                                    <input
                                      type="date"
                                      value={editEx!.end ?? ''}
                                      onChange={(e2) => setEditEx({ ...editEx!, end: e2.target.value })}
                                      className={exClass('end')} />
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <label className="flex items-center justify-center h-full py-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="h-5 w-5"
                                      checked={editEx!.counts_as_absence}
                                      onChange={(e2) => { setEditEx({ ...editEx!, counts_as_absence: e2.target.checked }); setEditAbsenceTouched(true) }}
                                    />
                                  </label>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex gap-1 justify-end">
                                    <button
                                      onClick={updateException}
                                      disabled={savingEx || !isEditExceptionValid()}
                                      className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
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
                                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                                  {soldiers.find((s) => s.name === e.name)?.four_d ?? '–'}
                                </td>
                                <td className="px-4 py-3 font-medium whitespace-nowrap">
                                  {soldiers.find((s) => s.name === e.name)?.rank ? `${soldiers.find((s) => s.name === e.name)?.rank} ${e.name}` : e.name}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block ${theme.badgeBg} ${theme.badgeText} text-xs font-medium px-2 py-0.5 rounded-lg whitespace-nowrap`}>
                                    {e.scope ?? '–'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500">{e.reason ?? '–'}</td>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{e.start ? toSGDate(e.start) : '–'}</td>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{e.end ? toSGDate(e.end) : '–'}</td>
                                <td className="px-4 py-3">
                                  <input type="checkbox" className="h-5 w-5" checked={e.counts_as_absence} disabled />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1 justify-end items-center">
                                    <button
                                      onClick={() => exConfirm.isConfirming(e.id)
                                        ? exConfirm.resolve(e.id, () => deleteException(e.id))
                                        : (() => {
                                          if (e.scope === 'MA') {
                                            const colonIdx = (e.reason ?? '').indexOf(': ')
                                            setEditMedCenter(colonIdx !== -1 ? e.reason!.slice(0, colonIdx) : '')
                                            setEditEx({ ...e, reason: colonIdx !== -1 ? e.reason!.slice(colonIdx + 2) : (e.reason ?? '') })
                                          } else {
                                            setEditMedCenter('')
                                            setEditEx({ ...e })
                                          }
                                          setEditAbsenceTouched(false)
                                          setEditExErrors({})
                                        })()}
                                      className={exConfirm.isConfirming(e.id)
                                        ? 'px-3 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600 transition-colors text-xl p-3'}
                                      title={exConfirm.isConfirming(e.id) ? 'Confirm delete' : 'Edit'}
                                    >
                                      {exConfirm.isConfirming(e.id) ? 'Yes' : '✎'}
                                    </button>
                                    <button
                                      onClick={() => exConfirm.isConfirming(e.id) ? exConfirm.cancel() : exConfirm.request(e.id)}
                                      className={exConfirm.isConfirming(e.id)
                                        ? 'px-3 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 text-sm font-semibold rounded-xl transition-colors'
                                        : 'text-gray-400 hover:text-red-500 transition-colors text-xl p-3'}
                                      title={exConfirm.isConfirming(e.id) ? 'Cancel' : 'Remove'}
                                    >
                                      {exConfirm.isConfirming(e.id) ? 'No' : '✕'}
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
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="bg-gray-50 px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => setExceptionShowAll((prev) => !prev)}
                          className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {exceptionShowAll ? 'Hide all' : 'Show all'}
                        </button>
                      </td>
                    </tr>
                  </tfoot>
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
              Report{lastParadeType ? ` – ${lastParadeType}` : ''}
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
