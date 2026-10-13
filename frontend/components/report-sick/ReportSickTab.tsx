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
import { soldierDropdownProps } from '@/frontend/components/parade/parade-ui'
import { Button } from '@/frontend/components/ui/button'
import { CheckField, Checkbox, Field, Input, inputClass } from '@/frontend/components/ui/fields'
import { Banner, Empty, Loading, PageHeader, Panel } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'
import { RowActions } from '@/frontend/components/ui/table'

/** Current Singapore time as "HH:MM". */
const nowSGTime = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })

type Kind = 'rsi' | 'rso' | 'review'
const KINDS: { value: Kind; label: string }[] = [
  { value: 'rsi', label: 'RSI' },
  { value: 'rso', label: 'RSO' },
  { value: 'review', label: 'Medical Review' },
]
const IS_KIND: Record<Kind, (e: Exception) => boolean> = { rsi: isRsi, rso: isRso, review: isMedicalReview }

/** location null = untouched: shows and saves the kind's default (Settings > Report Sick for RSI). */
type SickForm = { name: string; reason: string; urti: boolean; urtiTouched: boolean; location: string | null }
type ReviewForm = { name: string; coy: string; nric: string; diagnosis: string; lastMa: string; nextMa: string; memo: boolean; remarks: string }

const SICK_FORM: SickForm = { name: '', reason: '', urti: false, urtiTouched: false, location: null }
const reviewForm = (coy: string): ReviewForm => ({ name: '', coy, nric: '', diagnosis: '', lastMa: '', nextMa: '', memo: false, remarks: '' })

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

  if (loading || !settings) return <Loading />

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
    <Field label="Soldier" required>
      <SearchDropdown
        {...soldierDropdownProps}
        matches={(s, q) => `${s.four_d ?? ''} ${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase())}
        items={soldiers}
        value={value}
        onChange={onChange}
        inputClass={inputClass()}
      />
    </Field>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Report Sick"
        subtitle="Entries go into the parade state under REPORT SICK. RSI and RSO also fall the soldier out of conducts."
      />

      {error && <Banner>{error}</Banner>}

      <Segmented aria-label="Kind" value={kind} onChange={switchKind} options={KINDS} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>

      {kind === 'review' ? (
        <Panel className="space-y-3">
          {soldierPicker(review.name, (name) => setReview({ ...review, name }))}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Coy"><Input value={review.coy} onChange={(e) => setReview({ ...review, coy: e.target.value })} /></Field>
            <Field label="NRIC"><Input value={review.nric} autoComplete="off" onChange={(e) => setReview({ ...review, nric: e.target.value })} /></Field>
          </div>
          <Field label="Diagnosis/Issue"><Input value={review.diagnosis} onChange={(e) => setReview({ ...review, diagnosis: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Most recent MA"><Input type="date" value={review.lastMa} onChange={(e) => setReview({ ...review, lastMa: e.target.value })} /></Field>
            <Field label="Next MA"><Input type="date" value={review.nextMa} onChange={(e) => setReview({ ...review, nextMa: e.target.value })} /></Field>
          </div>
          <Segmented
            label="Memo"
            value={review.memo}
            onChange={(memo) => setReview({ ...review, memo })}
            options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]}
          />
          <Field label="Remarks/Requests"><Input value={review.remarks} onChange={(e) => setReview({ ...review, remarks: e.target.value })} /></Field>
          <Button block onClick={addReview} disabled={busy || !review.name || !review.nric.trim() || !review.diagnosis.trim()}>
            Add medical review
          </Button>
        </Panel>
      ) : (
        <Panel className="space-y-3">
          {soldierPicker(sick.name, (name) => setSick({ ...sick, name }))}
          <Field label="Reason" required>
            <Input
              placeholder="Reason (e.g. Flu and phlegm)"
              value={sick.reason}
              onChange={(e) => {
                const reason = e.target.value
                setSick({ ...sick, reason, urti: sick.urtiTouched ? sick.urti : isUrti(reason, settings.report_sick.urti_keywords) })
              }}
            />
          </Field>
          <Field label="Location">
            <Input placeholder="Location" value={location} onChange={(e) => setSick({ ...sick, location: e.target.value })} />
          </Field>
          <CheckField label="URTI">
            <Checkbox checked={sick.urti} onChange={(e) => setSick({ ...sick, urti: e.target.checked, urtiTouched: true })} />
          </CheckField>
          <Button block onClick={addSick} disabled={busy || !sick.name || !sick.reason.trim()}>
            Add {kind === 'rso' ? 'RSO' : 'RSI'}
          </Button>
        </Panel>
      )}

      {entries.length === 0 ? (
        <Empty className="py-6">Nothing on this day.</Empty>
      ) : (
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{who(e)}</div>
                <div className="truncate text-xs text-ink-60">{detail(e)}</div>
              </div>
              {kind !== 'review' && (
                <CheckField label="URTI" className="text-xs">
                  <Checkbox checked={isUrtiException(e)} disabled={busy} onChange={(ev) => setUrti(e, ev.target.checked)} />
                </CheckField>
              )}
              <RowActions
                confirming={delConfirm.isConfirming(e.id)}
                disabled={busy}
                onRequest={() => delConfirm.request(e.id)}
                onConfirm={() => delConfirm.resolve(() => remove(e))}
                onCancel={delConfirm.cancel}
              />
            </li>
          ))}
        </ul>
      )}

      {message && <MessageBox title={message.title} text={message.text} />}
    </div>
  )
}

