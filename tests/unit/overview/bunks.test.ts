import { describe, it, expect } from 'vitest'
import { applyExcludeStayIn } from '@/backend/domain/parade/exception-table'
import { bunkOf, buildBunks, generateBunkMessage } from '@/backend/domain/overview/bunks'
import type { DutyEntry, Exception, Soldier } from '@/shared/types'

const DAY = '2026-10-11'
const S = (id: string, rank: string, name: string, four_d: string | null, bunk: string | null = null): Soldier =>
  ({ id, rank, name, platoon: '1', four_d, bunk })
let nextId = 1
const ex = (soldier_id: string, scope: string, reason: string, counts_as_absence: boolean): Exception => ({
  id: nextId++, name: '', scope, reason, start: DAY, end: DAY, counts_as_absence, soldier_id, type: null, revoked_at: null,
})

const SOLDIERS = [
  S('a', 'PTE', 'KAI YANG', '1101'),
  S('b', 'PTE', 'ASHRAF BIN AFFENDY', '1102'),
  S('c', 'PTE', 'EDMUND CHEW', '1103'),
  S('d', 'PTE', 'JAY LIEW', '1201'),
  S('e', 'PTE', 'KAUSHAL', '1203'),
  S('f', 'CPL', 'JOHN SANTO', null, 'asa + medic bunk'),
  S('g', 'LCP', 'ZENG YI CHUN', null, 'ASA + MEDIC BUNK'),
  S('h', 'CPT', 'OC ONE', null),
  S('j', '3SG', 'SGT IN BUNK', '1104'), // commanders are not counted, even with a bunk
  { ...S('i', 'PTE', 'POSTED OUT', '1104'), on_strength: false },
]
const EXCEPTIONS = [
  ex('a', 'Others', 'Stay Out', false),
  ex('b', 'Off/Leave', 'Annual Leave', true),
  ex('e', 'Others', 'Stay Out', false),
  ex('e', 'Att C', 'MC', true),
  ex('d', 'Status', 'Excuse Boots', false), // a status keeps him in the bunk
]
const OUT_SCOPES = ['Others', 'Guard Duty']
const DUTIES: DutyEntry[] = [{ duty_type: 'COS', date: DAY, name: 'JOHN SANTO / ZENG YI CHUN' }]

describe('bunkOf', () => {
  it('reads the 4D, and a Bunk on the roll wins', () => {
    expect(bunkOf(S('x', 'PTE', 'X', '1203'))).toBe('PLT 1 BUNK 2')
    expect(bunkOf(S('x', 'PTE', 'X', '1203', 'plt 2 bunk 4'))).toBe('PLT 2 BUNK 4')
    expect(bunkOf(S('x', 'PTE', 'X', null))).toBeNull()
    expect(bunkOf(S('x', 'PTE', 'X', '12'))).toBeNull()
  })
})

describe('buildBunks', () => {
  const groups = buildBunks(SOLDIERS, EXCEPTIONS, DUTIES, DAY, new Set(['c']), OUT_SCOPES)

  it('groups by platoon and bunk, standalone bunks last, no-bunk and posted-out left out', () => {
    expect(groups.map((g) => [g.platoon, g.bunks.map((b) => [b.label, b.members.length])])).toEqual([
      ['PLT 1', [['PLT 1 BUNK 1', 3], ['PLT 1 BUNK 2', 2]]],
      [null, [['ASA + MEDIC BUNK', 2]]],
    ])
  })

  it('takes reasons from exceptions and duties, and ❌️ for a hand-marked absence', () => {
    const reasons = Object.fromEntries(groups.flatMap((g) => g.bunks.flatMap((b) => b.members.map((m) => [m.soldier.name, m.reasons]))))
    expect(reasons).toEqual({
      'KAI YANG': ['Stay Out'],
      'ASHRAF BIN AFFENDY': ['Annual Leave'],
      'EDMUND CHEW': ['❌️'],
      'JAY LIEW': [],
      KAUSHAL: ['Stay Out', 'MC'],
      'JOHN SANTO': ['COS'],
      'ZENG YI CHUN': ['COS'],
    })
  })
})

describe('present despite a reason', () => {
  const groups = buildBunks(SOLDIERS, EXCEPTIONS, [], DAY, new Set(), OUT_SCOPES, new Set(['a']))

  it('counts the soldier in, flags the reason, and lists them in the message', () => {
    const kai = groups[0].bunks[0].members.find((m) => m.soldier.name === 'KAI YANG')!
    expect(kai).toMatchObject({ reasons: [], flagged: ['Stay Out'] })
    expect(generateBunkMessage('t', DAY, '21:30', groups)).toContain('*⚠️ PRESENT DESPITE REASON*\n> 1101 PTE KAI YANG - Stay Out')
  })
})

describe('generateBunkMessage', () => {
  it('prints each bunk\'s strength and only who is out', () => {
    const groups = buildBunks(SOLDIERS, EXCEPTIONS, [], DAY, new Set(), OUT_SCOPES)
    expect(generateBunkMessage('Strength CAA', DAY, '21:30', groups)).toBe([
      '*STRENGTH CAA 111026 2130HRS*',
      '',
      '*PLT 1: 2/5*',
      '',
      '*PLT 1 BUNK 1 (1/3)*',
      '> 1101 PTE KAI YANG - Stay Out',
      '> 1102 PTE ASHRAF BIN AFFENDY - Annual Leave',
      '',
      '*PLT 1 BUNK 2 (1/2)*',
      '> 1203 PTE KAUSHAL - Stay Out, MC',
      '',
      '*ASA + MEDIC BUNK (2/2)*',
    ].join('\n'))
  })
})

describe('excusing stay-in personnel', () => {
  const stayIn: Exception = { ...ex('d', 'Status', 'Excuse Stay-In', false) }
  const out = (exclude: boolean) => buildBunks(SOLDIERS, applyExcludeStayIn([stayIn], exclude), [], DAY, new Set(), OUT_SCOPES)
    .flatMap((g) => g.bunks.flatMap((b) => b.members)).find((m) => m.soldier.name === 'JAY LIEW')!

  it('keeps a stay-in soldier in the bunk unless excluded', () => {
    expect(out(false).reasons).toEqual([])
    expect(out(true).reasons).toEqual(['Excuse Stay-In'])
  })
})
