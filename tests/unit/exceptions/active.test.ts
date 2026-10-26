import { describe, it, expect } from 'vitest'
import {
  SCOPE_TYPES, exceptionType, isRevoked, isActiveOn,
  soldierKeyOf, soldierIndex, exceptionSoldierKey, buildActiveMap, mergeRuns, isOnStrength, exceptionLinkFields } from '@/backend/domain/exceptions/active'
import type { Exception, Soldier } from '@/shared/types'

let nextId = 1
function ex(p: Partial<Exception>): Exception {
  return {
    id: nextId++, name: 'TAN AH KOW', scope: 'Status', reason: null, start: null, end: null,
    counts_as_absence: false, soldier_id: null, type: null, revoked_at: null, ...p,
  }
}

const TAN: Soldier = { id: 'u-tan', rank: 'PTE', name: 'TAN AH KOW', platoon: '1' }
const LIM: Soldier = { id: 'u-lim', rank: 'CPL', name: 'LIM BAH', platoon: '2' }

describe('types and scopes', () => {
  it('every scope offers at least one type', () => {
    for (const types of Object.values(SCOPE_TYPES)) {
      expect(types.length).toBeGreaterThan(0)
    }
  })

  it('stored type wins', () => {
    expect(exceptionType(ex({ scope: 'Status', type: 'RMJ', reason: 'FEVER, LD' }))).toBe('RMJ')
  })

  it('infers the type like the DB backfill when none is stored', () => {
    expect(exceptionType(ex({ scope: 'Att C' }))).toBe('MC')
    expect(exceptionType(ex({ scope: 'Status', reason: 'FEVER, LD' }))).toBe('LD')
    expect(exceptionType(ex({ scope: 'Status', reason: 'Light Duty' }))).toBe('LD')
    expect(exceptionType(ex({ scope: 'Status', reason: 'KNEE PAIN, RMJ' }))).toBe('RMJ')
    expect(exceptionType(ex({ scope: 'Status', reason: 'Excuse FLEGS' }))).toBe('Excuse')
    expect(exceptionType(ex({ scope: 'Status', reason: 'OLD WOUND' }))).toBe('Excuse')
    expect(exceptionType(ex({ scope: 'Off/Leave', reason: 'Annual Leave' }))).toBe('Leave')
    expect(exceptionType(ex({ scope: 'Off/Leave', reason: 'Weekend off' }))).toBe('Off')
  })

  it('"HOLD" or "Old" do not read as LD', () => {
    expect(exceptionType(ex({ scope: 'Status', reason: 'HOLD PAIN' }))).toBe('Excuse')
  })
})

describe('isActiveOn', () => {
  it('is inclusive of both ends', () => {
    const e = ex({ start: '2026-01-10', end: '2026-01-12' })
    expect(isActiveOn(e, '2026-01-09')).toBe(false)
    expect(isActiveOn(e, '2026-01-10')).toBe(true)
    expect(isActiveOn(e, '2026-01-12')).toBe(true)
    expect(isActiveOn(e, '2026-01-13')).toBe(false)
  })

  it('treats a missing start or end as open', () => {
    expect(isActiveOn(ex({ start: '2026-01-10', end: null }), '2027-01-01')).toBe(true)
    expect(isActiveOn(ex({ start: null, end: '2026-01-10' }), '2025-01-01')).toBe(true)
  })

  it('a revoked exception is never active', () => {
    const e = ex({ start: '2026-01-10', end: '2026-01-12', revoked_at: '2026-01-11T00:00:00Z' })
    expect(isRevoked(e)).toBe(true)
    expect(isActiveOn(e, '2026-01-11')).toBe(false)
  })
})

describe('soldier keys', () => {
  it('prefers soldier_id, falls back to a name match, then to the bare name', () => {
    const idx = soldierIndex([TAN, LIM])
    expect(exceptionSoldierKey(ex({ soldier_id: 'u-lim', name: 'WRONG NAME' }), idx)).toBe('u-lim')
    expect(exceptionSoldierKey(ex({ name: 'TAN AH KOW' }), idx)).toBe('u-tan')
    expect(exceptionSoldierKey(ex({ name: 'NOBODY' }), idx)).toBe('name:NOBODY')
  })

  it('soldiers without an id key by name, matching id-less exceptions', () => {
    const noId: Soldier = { rank: 'PTE', name: 'OLD FIXTURE', platoon: '1' }
    expect(soldierKeyOf(noId)).toBe('name:OLD FIXTURE')
    expect(exceptionSoldierKey(ex({ name: 'OLD FIXTURE' }), soldierIndex([noId]))).toBe('name:OLD FIXTURE')
  })

  it('isOnStrength: only an explicit false posts a soldier out', () => {
    expect(isOnStrength(TAN)).toBe(true)
    expect(isOnStrength({ ...TAN, on_strength: true })).toBe(true)
    expect(isOnStrength({ ...TAN, on_strength: false })).toBe(false)
  })
})

describe('buildActiveMap', () => {
  it('groups active, non-revoked exceptions by soldier', () => {
    const rows = [
      ex({ soldier_id: 'u-tan', start: '2026-01-10', end: '2026-01-20' }),
      ex({ name: 'LIM BAH', start: '2026-01-15', end: '2026-01-15' }),
      ex({ soldier_id: 'u-tan', start: '2026-02-01', end: '2026-02-02' }),
      ex({ soldier_id: 'u-lim', start: '2026-01-15', end: '2026-01-15', revoked_at: '2026-01-15T01:00:00Z' }),
    ]
    const map = buildActiveMap(rows, [TAN, LIM], '2026-01-15')
    expect(map.get('u-tan')).toHaveLength(1)
    expect(map.get('u-lim')).toHaveLength(1)
  })
})

describe('mergeRuns', () => {
  it('folds back-to-back rows of the same type and reason, restating the day count', () => {
    const rows = [
      ex({ soldier_id: 'u-tan', scope: 'Att C', type: 'MC', reason: '3D MC', start: '2026-01-06', end: '2026-01-08' }),
      ex({ soldier_id: 'u-tan', scope: 'Att C', type: 'MC', reason: '2D MC', start: '2026-01-09', end: '2026-01-10' }),
    ]
    const out = mergeRuns(rows)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ start: '2026-01-06', end: '2026-01-10', reason: '5D MC' })
  })

  it('keeps rows apart when there is a day off status between them', () => {
    const rows = [
      ex({ soldier_id: 'u-tan', scope: 'Att C', type: 'MC', reason: 'Fever', start: '2026-01-06', end: '2026-01-07' }),
      ex({ soldier_id: 'u-tan', scope: 'Att C', type: 'MC', reason: 'Fever', start: '2026-01-09', end: '2026-01-10' }),
    ]
    expect(mergeRuns(rows)).toHaveLength(2)
  })

  it('does not merge different reasons, different soldiers, or presence that disagrees', () => {
    const base = { scope: 'Status', type: 'Excuse', start: '2026-01-06', end: '2026-01-07' }
    expect(mergeRuns([
      ex({ ...base, soldier_id: 'u-tan', reason: 'Excuse FLEGS' }),
      ex({ ...base, soldier_id: 'u-tan', reason: 'Excuse Stay-In', start: '2026-01-08', end: '2026-01-09' }),
    ])).toHaveLength(2)
    expect(mergeRuns([
      ex({ ...base, soldier_id: 'u-tan', reason: 'Excuse FLEGS' }),
      ex({ ...base, soldier_id: 'u-lim', reason: 'Excuse FLEGS', start: '2026-01-08', end: '2026-01-09' }),
    ])).toHaveLength(2)
    expect(mergeRuns([
      ex({ ...base, soldier_id: 'u-tan', reason: 'Excuse FLEGS', counts_as_absence: true }),
      ex({ ...base, soldier_id: 'u-tan', reason: 'Excuse FLEGS', start: '2026-01-08', end: '2026-01-09' }),
    ])).toHaveLength(2)
  })

  it('never merges Report Sick, which is an event', () => {
    const gd = { soldier_id: 'u-tan', scope: 'Report Sick', type: 'Report Sick', reason: 'Flu' }
    expect(mergeRuns([
      ex({ ...gd, start: '2026-01-06', end: '2026-01-06' }),
      ex({ ...gd, start: '2026-01-07', end: '2026-01-07' }),
    ])).toHaveLength(2)
  })

  it('drops revoked rows so they cannot bridge two stretches', () => {
    const mc = { soldier_id: 'u-tan', scope: 'Att C', type: 'MC', reason: 'Fever' }
    const out = mergeRuns([
      ex({ ...mc, start: '2026-01-01', end: '2026-01-02' }),
      ex({ ...mc, start: '2026-01-03', end: '2026-01-04', revoked_at: '2026-01-03T00:00:00Z' }),
      ex({ ...mc, start: '2026-01-05', end: '2026-01-06' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('leaves a single row untouched', () => {
    const e = ex({ soldier_id: 'u-tan', scope: 'Att C', type: 'MC', reason: '3D MC', start: '2026-01-06', end: '2026-01-08' })
    expect(mergeRuns([e])).toEqual([e])
  })
})

describe('exceptionLinkFields', () => {
  const soldiers = [{ id: 'u1', rank: 'PTE', name: 'GOH RONG HAO', platoon: '1' }]

  it('links the soldier by id and infers the type from scope and reason', () => {
    expect(exceptionLinkFields(soldiers, 'GOH RONG HAO', 'Status', 'Light Duty')).toEqual({ soldier_id: 'u1', type: 'LD' })
  })

  it('keeps a still-valid current type, re-infers one that no longer fits the scope', () => {
    expect(exceptionLinkFields(soldiers, 'GOH RONG HAO', 'Report Sick', 'Flu', 'URTI').type).toBe('URTI')
    expect(exceptionLinkFields(soldiers, 'GOH RONG HAO', 'Att C', 'Flu', 'URTI').type).toBe('MC')
  })

  it('leaves the link empty for a name not on the roll', () => {
    expect(exceptionLinkFields(soldiers, 'NOBODY', 'Others', null).soldier_id).toBeNull()
  })
})
