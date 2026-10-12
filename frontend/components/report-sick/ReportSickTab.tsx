'use client'

import { useMemo, useState } from 'react'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { MedicalReviewRepository } from '@/backend/data/repositories/MedicalReviewRepository'
import type { Exception, Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { isActiveOn, isOnStrength, soldierIndex, soldierOf } from '@/backend/domain/exceptions/active'
import {
  generateMedicalReviewReport, generateRsiReport,
  isMedicalReview, isRsi, isRso, isUrti, isUrtiException,
} from '@/backend/domain/report-sick/report-sick'
import { combine, useExceptions, useMedicalReviews, useSettingsQuery, useSoldiers, useWrite } from '@/frontend/hooks/queries'
import { todaySGDate } from '@/shared/dates'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import MessageBox from '@/frontend/components/shared/MessageBox'

/** Current Singapore time as "HH:MM". */
const nowSGTime = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })

type Kind = 'rsi' | 'rso' | 'review'
const KINDS: { id: Kind; label: string }[] = [
  { id: 'rsi', label: 'RSI' },
  { id: 'rso', label: 'RSO' },
  { id: 'review', label: 'Medical Review' },
]
const IS_KIND: Record<Kind, (e: Exception) => boolean> = { rsi: isRsi, rso: isRso, review: isMedicalReview }

/** location null = untouched: shows and saves the kind's default (Settings > Report Sick for RSI). */
type SickForm = { name: string; reason: string; urti: boolean; urtiTouched: boolean; location: string | null }
type ReviewForm = { name: string; coy: string; nric: string; diagnosis: string; lastMa: string; nextMa: string; memo: boolean; remarks: string }

const SICK_FORM: SickForm = { name: '', reason: '', urti: false, urtiTouched: false, location: null }
const reviewForm = (coy: string): ReviewForm => ({ name: '', coy, nric: '', diagnosis: '', lastMa: '', nextMa: '', memo: false, remarks: '' })

const input = 'w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus'

/**
 * Report Sick tab: RSI (inside, default location from Settings), RSO (outside) and medical reviews. Each is a
 * 'Report Sick' exception, so the parade state and conducts pick it up as is. RSI and
 * medical reviews each get a message to copy; RSO has none.
 */
export default function ReportSickTab({ company, companyLabel }: { company: Company; companyLabel: string }) {
  const [kind, setKind] = useState<Kind>('rsi')
  const [date, setDate] = useState(todaySGDate())
  const [time, setTime] = useState(nowSGTime())
  const soldiersQ = useSoldiers(company)
  const exceptionsQ = useExceptions(company, 'Report Sick')
  const reviewsQ = useMedicalReviews(company)
  const settingsQ = useSettingsQuery(company)
  const { run, busy, error: writeError } = useWrite(company)
  const { loading, error: loadError } = combine(soldiersQ, exceptionsQ, reviewsQ, settingsQ)
  const error = writeError ?? loadError
  const settings = settingsQ.data
  const allSoldiers = useMemo(() => soldiersQ.data ?? [], [soldiersQ.data])
  const exceptions = useMemo(() => exceptionsQ.data ?? [], [exceptionsQ.data])
  const reviews = useMemo(() => reviewsQ.data ?? [], [reviewsQ.data])
  const [sick, setSick] = useState<SickForm>(SICK_FORM)
  const [review, setReview] = useState<ReviewForm>(reviewForm(companyLabel.toUpperCase()))
  const delConfirm = useConfirmDelete<number>()
  const exceptionRepo = new ExceptionRepository(company)
  const reviewRepo = new MedicalReviewRepository(company)
  const location = sick.location ?? (kind === 'rsi' ? settings?.report_sick.default_location ?? '' : '')
  const soldiers = useMemo(() => allSoldiers.filter(isOnStrength), [allSoldiers])
  const idx = useMemo(() => soldierIndex(allSoldiers), [allSoldiers])
  const onDate = useMemo(
    () => exceptions.filter((e) => isActiveOn(e, date)).sort((a, b) => a.id - b.id),
    [exceptions, date],
  )
  const entries = onDate.filter(IS_KIND[kind])
  const reviewById = useMemo(() => new Map(reviews.map((r) => [r.exception_id, r])), [reviews])

  const message =
    kind === 'rsi' ? { title: 'RSI message', text: generateRsiReport(date, time, settings?.report_sick.header_label ?? '', onDate, idx) }
    : kind === 'review' ? {
      title: 'Medical review message',
      text: generateMedicalReviewReport(
        entries.flatMap((e) => { const r = reviewById.get(e.id); return r ? [{ exception: e, review: r }] : [] }), idx,
      ),
    }
    : null

  /** Switches between RSI, RSO and medical review, resetting the sick form's default location. */
  function switchKind(k: Kind) {
    setKind(k)
    setSick(SICK_FORM)
  }

  /** Fields shared by every report-sick exception written from this tab. */
  function base(soldier: Soldier) {
    return {
      name: soldier.name,
      soldier_id: soldier.id ?? null,
      scope: 'Report Sick',
      start: date,
      end: date,
      time,
      counts_as_absence: settings?.absence_scope_defaults['Report Sick'] ?? false,
    }
  }

  /** Adds an RSI or RSO for the picked soldier on the selected date. */
  async function addSick() {
    const soldier = soldiers.find((s) => s.name === sick.name)
    const reason = sick.reason.trim()
    if (!soldier || !reason) return
    const ok = await run(() => exceptionRepo.insert({
      ...base(soldier),
      type: sick.urti ? 'URTI' : 'Report Sick',
      reason,
      in_out: kind === 'rso' ? 'OUT' : 'IN',
      location: location.trim() || null,
    }))
    if (ok) setSick(SICK_FORM)
  }

  /** Adds a medical review for the picked soldier on the selected date. */
  async function addReview() {
    const soldier = soldiers.find((s) => s.name === review.name)
    if (!soldier || !review.nric.trim() || !review.diagnosis.trim()) return
    const ok = await run(() => reviewRepo.add(
      { ...base(soldier), type: 'Medical Review', reason: review.diagnosis.trim() },
      {
        nric: review.nric.trim().toUpperCase(),
        coy: review.coy.trim(),
        last_ma: review.lastMa || null,
        next_ma: review.nextMa || null,
        memo: review.memo,
        remarks: review.remarks.trim() || null,
      },
    ))
    if (ok) setReview(reviewForm(companyLabel.toUpperCase()))
  }

  /** Marks a report sick as URTI or non-URTI. */
  const setUrti = (e: Exception, urti: boolean) =>
    run(() => exceptionRepo.update(e.id, { type: urti ? 'URTI' : 'Report Sick' }))
  /** Deletes an entry; a review's details go with it. */
  const remove = (e: Exception) => run(() => exceptionRepo.remove(e.id))

  if (loading || !settings) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

  /** "<4D> <rank> <name>", or the stored name. */
  const who = (e: Exception) => {
    const s = soldierOf(e, idx)
    return s ? [s.four_d, s.rank, s.name].filter(Boolean).join(' ') : e.name
  }
  /** Second line of a list entry: reason, plus where and when. */
  const detail = (e: Exception) => {
    if (kind === 'review') return [e.reason, reviewById.get(e.id)?.nric].filter(Boolean).join(' · ')
    return [e.reason, e.location && `@ ${e.location}`, e.time].filter(Boolean).join(' ')
  }

  const soldierPicker = (value: string, onChange: (name: string) => void) => (
    <SearchDropdown
      items={soldiers}
      value={value}
      getKey={(s) => s.name}
      getLabel={(s) => `${s.rank} ${s.name}`.trim()}
      matches={(s, q) => `${s.four_d ?? ''} ${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase())}
      renderOption={(s) => (
        <div className="flex gap-2">
          <span className="font-mono text-xs text-ink-60 w-12 shrink-0 pt-0.5">{s.rank}</span>
          <span className="font-medium text-ink">{s.name}</span>
        </div>
      )}
      onChange={onChange}
      inputClass={input}
      placeholder="Search soldier..."
    />
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Report Sick</h2>
        <p className="text-xs text-ink-60">Entries go into the parade state under REPORT SICK. RSI and RSO also fall the soldier out of conducts.</p>
      </div>

      {error && <div role="alert" className="bg-danger/5 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-1 rounded-pill bg-hairline/60 p-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => switchKind(k.id)}
            aria-pressed={kind === k.id}
            className={`h-9 rounded-pill text-sm ${kind === k.id ? 'bg-white font-semibold text-ink' : 'text-ink-80 hover:text-ink'}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-60">Date<input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-xs text-ink-60">Time<input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>

      {kind === 'review' ? (
        <div className="bg-parchment border border-hairline rounded-card p-4 space-y-3">
          {soldierPicker(review.name, (name) => setReview({ ...review, name }))}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-60">Coy<input className={input} value={review.coy} onChange={(e) => setReview({ ...review, coy: e.target.value })} /></label>
            <label className="text-xs text-ink-60">NRIC<input className={input} value={review.nric} autoComplete="off" onChange={(e) => setReview({ ...review, nric: e.target.value })} /></label>
          </div>
          <label className="block text-xs text-ink-60">Diagnosis/Issue<input className={input} value={review.diagnosis} onChange={(e) => setReview({ ...review, diagnosis: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-60">Most recent MA<input type="date" className={input} value={review.lastMa} onChange={(e) => setReview({ ...review, lastMa: e.target.value })} /></label>
            <label className="text-xs text-ink-60">Next MA<input type="date" className={input} value={review.nextMa} onChange={(e) => setReview({ ...review, nextMa: e.target.value })} /></label>
          </div>
          <fieldset className="flex items-center gap-4 text-sm text-ink-80">
            <legend className="text-xs text-ink-60 mb-1">Memo</legend>
            {[true, false].map((v) => (
              <label key={String(v)} className="flex items-center gap-1.5">
                <input type="radio" name="memo" className="h-4 w-4" checked={review.memo === v} onChange={() => setReview({ ...review, memo: v })} />
                {v ? 'Yes' : 'No'}
              </label>
            ))}
          </fieldset>
          <label className="block text-xs text-ink-60">Remarks/Requests<input className={input} value={review.remarks} onChange={(e) => setReview({ ...review, remarks: e.target.value })} /></label>
          <button onClick={addReview} disabled={busy || !review.name || !review.nric.trim() || !review.diagnosis.trim()} className="w-full py-2.5 bg-ink text-white text-sm font-medium rounded-lg disabled:opacity-50">
            Add medical review
          </button>
        </div>
      ) : (
        <div className="bg-parchment border border-hairline rounded-card p-4 space-y-3">
          {soldierPicker(sick.name, (name) => setSick({ ...sick, name }))}
          <input
            className={input}
            placeholder="Reason (e.g. Flu and phlegm)"
            value={sick.reason}
            onChange={(e) => {
              const reason = e.target.value
              setSick({ ...sick, reason, urti: sick.urtiTouched ? sick.urti : isUrti(reason, settings.report_sick.urti_keywords) })
            }}
          />
          <input className={input} placeholder="Location" aria-label="Location" value={location} onChange={(e) => setSick({ ...sick, location: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-ink-80">
            <input type="checkbox" className="h-4 w-4" checked={sick.urti} onChange={(e) => setSick({ ...sick, urti: e.target.checked, urtiTouched: true })} />
            URTI
          </label>
          <button onClick={addSick} disabled={busy || !sick.name || !sick.reason.trim()} className="w-full py-2.5 bg-ink text-white text-sm font-medium rounded-lg disabled:opacity-50">
            Add {kind === 'rso' ? 'RSO' : 'RSI'}
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-center py-6 text-sm text-ink-60">Nothing on this day.</p>
      ) : (
        <ul className="divide-y divide-hairline border border-hairline rounded-lg">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink truncate">{who(e)}</div>
                <div className="text-xs text-ink-60 truncate">{detail(e)}</div>
              </div>
              {kind !== 'review' && (
                <label className="flex items-center gap-1 text-xs text-ink-80">
                  <input type="checkbox" className="h-4 w-4" checked={isUrtiException(e)} disabled={busy} onChange={(ev) => setUrti(e, ev.target.checked)} />
                  URTI
                </label>
              )}
              {delConfirm.isConfirming(e.id) ? (
                <>
                  <button className="px-2.5 py-1.5 text-xs bg-danger text-white rounded-lg" disabled={busy} onClick={() => delConfirm.resolve(() => remove(e))}>Delete</button>
                  <button className="px-2.5 py-1.5 text-xs border border-hairline text-ink-80 rounded-lg" onClick={delConfirm.cancel}>Keep</button>
                </>
              ) : (
                <button className="px-2.5 py-1.5 text-xs border border-danger/30 text-danger rounded-lg" onClick={() => delConfirm.request(e.id)}>Delete</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && <MessageBox title={message.title} text={message.text} />}
    </div>
  )
}

