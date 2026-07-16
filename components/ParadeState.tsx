'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { supabase, tbl } from '@/lib/supabase'
import { displayName } from '@/lib/supabase'
import type { Soldier, Exception, DutyEntry } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES, PARADE_CONFIG, getRankType, RANK_TYPES, ALL_DUTY_TYPES } from '@/lib/companies'
import { eligibleSoldiers } from '@/lib/duty-rules'
import { useConfirmDelete } from '@/lib/hooks'
import SearchDropdown from '@/components/SearchDropdown'
import { track } from '@vercel/analytics'
import { generateParadeReport } from '@/lib/parade-report'
import { useSettingsQuery } from '@/lib/settings'
import Link from 'next/link'
import {
  EXCEPTION_SCOPES, SINGLE_DATE_SCOPES,
  isValidTime, buildReason, exceptionSortValue,
  strWarn as checkStrWarn, anyMismatch as checkAnyMismatch,
  isExceptionValid as checkExceptionValid, validateAddEx as computeAddExErrors,
  isEditExceptionValid as checkEditExceptionValid, validateEditEx as computeEditExErrors,
} from '@/lib/exception-validation'
import type { ExceptionScope, ExForm } from '@/lib/exception-validation'

function fieldInputClass(hasError: boolean, focusRing: string) {
  const base = 'border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 w-full'
  return hasError ? `${base} border-red-500 ring-2 ring-red-500` : `${base} border-gray-300 ${focusRing}`
}

const REASON_HINTS: Record<ExceptionScope, string> = {
  'Att C': 'e.g. Flu, Fever',
  'Status': 'e.g. Excuse RMJ, Excuse Uniform',
  'Off/Leave': 'e.g. Annual Leave, Off',
  'Guard Duty': 'e.g. Regimental Guard, Guard Commander',
  'Report Sick': 'e.g. Flu, Fever',
  'MA': 'e.g. Skin Appt, IMH Appt',
  'Others': 'e.g. ...',
}

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

function startOfWeek(iso: string) {
  const d = new Date(iso)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + mondayOffset)
  return d.toISOString().split('T')[0]
}

function weekDates(iso: string) {
  const monday = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => offsetDate(monday, i))
}

function dayHeaderLabel(iso: string) {
  const d = new Date(iso)
  return {
    weekday: d.toLocaleDateString('en-SG', { weekday: 'short' }),
    day: d.toLocaleDateString('en-SG', { day: '2-digit', month: 'short' }),
  }
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
  const [loading, setLoading] = useState(true)
  const { data: settings } = useSettingsQuery(company)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('config')
  const [output, setOutput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [lastParadeType, setLastParadeType] = useState<'First Parade' | 'Last Parade' | null>(null)
  const [exceptionsSortKey, setExceptionsSortKey] = useState<'four_d' | 'name' | 'scope' | 'reason' | 'start' | 'end' | null>(null)
  const [exceptionsSortDir, setExceptionsSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')


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

  // Duties inline edit
  const [editDuty, setEditDuty] = useState<{ duty_type: string; name: string } | null>(null)
  const [savingDuty, setSavingDuty] = useState(false)
  const dutyConfirm = useConfirmDelete<string>()

  // Guard Duty (unlimited headcount, lives in the Duties tab but stored as an Exception)
  const [showGuardDutyForm, setShowGuardDutyForm] = useState(false)
  const [gdForm, setGdForm] = useState<{ name: string; reason: string; date: string }>({ name: '', reason: '', date })
  const [editGuardDuty, setEditGuardDuty] = useState<Exception | null>(null)
  const gdConfirm = useConfirmDelete<number>()

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
    const [soldiersRes, exceptionsRes, dutiesRes, strRes] = await Promise.all([
      supabase.from(tbl(company, 'NominalRoll')).select('*'),
      supabase.from(tbl(company, 'Exceptions')).select('*'),
      supabase.from(tbl(company, 'Duty')).select('*').gte('date', weekDates(date)[0]).lte('date', weekDates(date)[6]),
      supabase.from(tbl(company, 'StrengthOverride')).select('*'),
    ])
    if (soldiersRes.error) setError(soldiersRes.error.message)
    setSoldiers((soldiersRes.data ?? []) as unknown as Soldier[])
    setExceptions((exceptionsRes.data ?? []) as unknown as Exception[])
    setDuties((dutiesRes.data ?? []) as unknown as DutyEntry[])
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

  const sortedExceptions = [...exceptions].sort((a, b) => {
    if (!exceptionsSortKey) {
      const dateA = new Date(a.start ?? 0).getTime()
      const dateB = new Date(b.start ?? 0).getTime()
      return dateA - dateB || a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    }
    const va = exceptionSortValue(a, exceptionsSortKey, soldiers)
    const vb = exceptionSortValue(b, exceptionsSortKey, soldiers)
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

  // If there's a query, use the queried exceptions; otherwise, show all
  let activeExceptions = (
    query
      ? queriedExceptions
      : sortedExceptions
  )

  const exceptionsTabRows = activeExceptions.filter((e) => e.scope !== 'Guard Duty')

  const eligibilityOverrides = settings?.eligibility_name_overrides ?? {}
  const rankRuleOverrides = settings?.eligibility_rank_overrides ?? {}
  const paradeTimes = settings?.parade_times ?? {}

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
    return checkStrWarn(platoon, rt, strOverrides, computedStrength)
  }

  function anyMismatch(): boolean {
    return checkAnyMismatch(STR_PLATOONS, RANK_TYPES, strOverrides, computedStrength)
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

  function isExceptionValid() {
    return checkExceptionValid(exForm, statusRows)
  }

  function validateAddEx() {
    const errors = computeAddExErrors(exForm)
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

  async function addGuardDuty() {
    if (!gdForm.name) return
    const { error } = await supabase.from(tbl(company, 'Exceptions')).insert({
      name: gdForm.name,
      scope: 'Guard Duty',
      reason: gdForm.reason.trim() || null,
      start: gdForm.date || null,
      end: gdForm.date || null,
      counts_as_absence: false,
    })
    if (error) { setError(error.message); return }
    setShowGuardDutyForm(false)
    setGdForm({ name: '', reason: '', date })
    await load()
  }

  async function updateGuardDuty() {
    if (!editGuardDuty) return
    const { error } = await supabase.from(tbl(company, 'Exceptions')).update({
      name: editGuardDuty.name,
      reason: editGuardDuty.reason ?? null,
      start: editGuardDuty.end || null,
      end: editGuardDuty.end || null,
    }).eq('id', editGuardDuty.id)
    if (error) { setError(error.message); return }
    setEditGuardDuty(null)
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
    return checkEditExceptionValid(editEx)
  }

  function validateEditEx() {
    const errors = computeEditExErrors(editEx)
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

  function generate(paradeType: 'First Parade' | 'Last Parade') {
    const strOverridesAsNumbers: Record<string, Record<string, number>> = {}
    for (const [platoon, rtMap] of Object.entries(strOverrides)) {
      strOverridesAsNumbers[platoon] = {}
      for (const [rt, val] of Object.entries(rtMap)) {
        if (val !== '') strOverridesAsNumbers[platoon][rt] = Number(val)
      }
    }
    const report = generateParadeReport({
      date,
      companyLabel,
      soldiers,
      activeExceptions: defaultExceptions,
      paradeTimeStr: paradeTimes[paradeType] ?? '',
      duties: duties.filter((d) => d.date === date),
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

  const dutyTypesToShow = company === 'hercules' ? [...ALL_DUTY_TYPES, 'Duty Clerk'] : ALL_DUTY_TYPES

  const guardDutyScopes: ExceptionScope[] = EXCEPTION_SCOPES.filter((s) => s !== 'Guard Duty')

  const guardDutyEntries = defaultExceptions.filter((e) => e.scope === 'Guard Duty')

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-800">Parade State</h2>
        <p className="text-xs text-gray-500">
          {soldiers.length - new Set(defaultExceptions.filter((e) => e.counts_as_absence).map((e) => e.name)).size} / {soldiers.length} present
          {defaultExceptions.length > 0 && ` · ${defaultExceptions.length} exception${defaultExceptions.length !== 1 ? 's' : ''}`}
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
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-sm text-gray-600">
              {PARADE_TYPES.map((pt) => `${pt} ${paradeTimes[pt] ?? '–'}`).join(' · ')}
              {' — edit in '}
              <Link href={`/${company}/settings`} className={`${theme.activeText} underline`}>Settings</Link>
            </p>
          </div>

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
            <button
              onClick={() => setDate(todayISO())}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-xl transition-colors"
            >
              Today
            </button>

            <button onClick={() => setDate(offsetDate(date, -7))} className="px-3 py-2 text-gray-500 hover:text-gray-800 text-lg transition-colors">←</button>

            <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1">
              {weekDates(date).map((iso) => {
                const label = dayHeaderLabel(iso)
                const isToday = iso === todayISO()
                const isSelected = iso === date
                const dayDuties = dutyTypesToShow
                  .map((dt) => ({ dt, entry: duties.find((x) => x.duty_type === dt && x.date === iso) }))
                  .filter((x) => x.entry)
                return (
                  <button
                    key={iso}
                    onClick={() => setDate(iso)}
                    className={`text-left rounded-xl border p-1.5 sm:p-2 transition-colors ${isSelected ? `${theme.buttonBg} border-transparent text-white` : isToday ? `bg-gray-50 border-gray-300` : `bg-white border-gray-200 hover:bg-gray-50`}`}
                  >
                    <div className={`text-[10px] sm:text-xs font-medium ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>{label.weekday}</div>
                    <div className={`text-xs sm:text-sm font-semibold mb-1 ${isSelected ? 'text-white' : 'text-gray-700'}`}>{label.day}</div>
                    <div className="space-y-0.5">
                      {dayDuties.map(({ dt, entry }) => (
                        <div key={dt} className={`text-[9px] sm:text-[11px] leading-tight truncate ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                          <span className="font-medium">{dt}</span> {displayName(entry!.name, soldiers)}
                        </div>
                      ))}
                      {dayDuties.length === 0 && (
                        <div className={`text-[9px] sm:text-[11px] ${isSelected ? 'text-white/50' : 'text-gray-300'}`}>–</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <button onClick={() => setDate(offsetDate(date, 7))} className="px-3 py-2 text-gray-500 hover:text-gray-800 text-lg transition-colors">→</button>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`}
            />
          </div>

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
                  {dutyTypesToShow.map((dt, i) => {
                    const d = duties.find(x => x.duty_type === dt && x.date === date)
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
                                items={eligibleSoldiers(editDuty.duty_type, soldiers, eligibilityOverrides, rankRuleOverrides)}
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

          {/* Guard Duty — unlike the duties above, an arbitrary number of people can be assigned */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-medium text-gray-500">Guard Duty</span>
              <button
                onClick={() => {
                  if (!showGuardDutyForm) setGdForm({ name: '', reason: '', date })
                  setShowGuardDutyForm((v) => !v)
                }}
                className={`px-3 py-1.5 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs font-medium rounded-lg transition-colors`}
              >
                {showGuardDutyForm ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {showGuardDutyForm && (
              <div className="p-4 space-y-3 border-b border-gray-100 bg-gray-50/50">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Soldier <span className="text-red-500">*</span></label>
                  <SearchDropdown
                    {...soldierDropdownProps}
                    items={soldiers}
                    value={gdForm.name}
                    onChange={(name) => setGdForm({ ...gdForm, name })}
                    inputClass={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={gdForm.date}
                    onChange={(e) => setGdForm({ ...gdForm, date: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reason</label>
                  <input
                    type="text"
                    placeholder={REASON_HINTS['Guard Duty']}
                    value={gdForm.reason}
                    onChange={(e) => setGdForm({ ...gdForm, reason: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <button
                  onClick={addGuardDuty}
                  disabled={!gdForm.name}
                  className={`w-full py-2.5 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Add Guard Duty
                </button>
              </div>
            )}

            {guardDutyEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No Guard Duty entries for this date.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Reason</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {guardDutyEntries.map((e, i) => {
                      const isEditing = editGuardDuty?.id === e.id
                      return (
                        <tr
                          key={e.id}
                          className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30' : ''}`}
                        >
                          {isEditing ? (
                            <>
                              <td className="px-2 py-2">
                                <SearchDropdown
                                  {...soldierDropdownProps}
                                  items={soldiers}
                                  value={editGuardDuty!.name}
                                  onChange={(name) => setEditGuardDuty({ ...editGuardDuty!, name })}
                                  inputClass={dutyEditInputClass}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={editGuardDuty!.reason ?? ''}
                                  onChange={(e2) => setEditGuardDuty({ ...editGuardDuty!, reason: e2.target.value })}
                                  className={dutyEditInputClass}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex gap-1 justify-end">
                                  <button
                                    onClick={updateGuardDuty}
                                    className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditGuardDuty(null)}
                                    className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-medium">{displayName(e.name, soldiers)}</td>
                              <td className="px-4 py-3 text-gray-500">{e.reason ?? '–'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-end items-center">
                                  <button
                                    onClick={() => setEditGuardDuty({ ...e })}
                                    className="text-gray-400 hover:text-gray-600 transition-colors text-xl p-3"
                                    title="Edit"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    onClick={() => gdConfirm.isConfirming(e.id) ? gdConfirm.resolve(e.id, () => deleteException(e.id)) : gdConfirm.request(e.id)}
                                    className={gdConfirm.isConfirming(e.id)
                                      ? 'px-3 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm'
                                      : 'text-gray-400 hover:text-red-500 transition-colors text-xl p-3'}
                                    title={gdConfirm.isConfirming(e.id) ? 'Confirm clear' : 'Clear'}
                                  >
                                    {gdConfirm.isConfirming(e.id) ? 'Yes' : '✕'}
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
            )}
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
                  if (!showForm) {
                    // Reset using the currently-viewed parade date, not a stale snapshot from last close
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
                    {guardDutyScopes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setExForm({ ...exForm, scope: s, counts_as_absence: exAbsenceTouched ? exForm.counts_as_absence : (settings?.absence_scope_defaults[s] ?? false) })}
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

          {exceptionsTabRows.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <div>
                {query
                  ? 'No exceptions match that query.'
                  : 'No exceptions for this date.'}
              </div>
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
                    {exceptionsTabRows.map((e, i) => {
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
                                    {guardDutyScopes.map((s) => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => setEditEx({ ...editEx!, scope: s, counts_as_absence: editAbsenceTouched ? editEx!.counts_as_absence : (settings?.absence_scope_defaults[s] ?? false) })}
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
