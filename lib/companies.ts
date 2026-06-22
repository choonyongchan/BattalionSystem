export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules', 'test'] as const
export type Company = (typeof COMPANIES)[number]

export const DISABLED_COMPANIES = new Set<Company>(['archer', 'braves', 'cougar'])
export const HIDDEN_COMPANIES = new Set<Company>(['test'])

export function companyLabel(company: Company) {
  return company[0].toUpperCase() + company.slice(1)
}

export interface ScopeConfig {
  key: string
  label: string
}

export interface ParadeStateConfig {
  header: string[]
  visibleDutyTypes: string[]
  scopeConfigs: ScopeConfig[]
  format?: 'hercules' | 'stallion' | 'archer' | 'braves' | 'cougar'
}

const ALL_DUTY_TYPES = ['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4']

const STD_SCOPES: ScopeConfig[] = [
  { key: 'Att C',       label: 'ATT C' },
  { key: 'Status',      label: 'STATUS' },
  { key: 'Off/Leave',   label: 'OFF/LEAVE' },
  { key: 'Guard Duty',  label: 'GUARD DUTY' },
  { key: 'Report Sick', label: 'REPORT SICK' },
  { key: 'MA',          label: 'MA' },
  { key: 'Others',      label: 'OTHERS' },
]

export const PARADE_CONFIG: Record<Company, ParadeStateConfig> = {
  archer: {
    header: ['40 SAR ARCHER COMPANY FIRST PARADE STATE'],
    visibleDutyTypes: ALL_DUTY_TYPES,
    scopeConfigs: [
      { key: 'Att C',       label: 'ATTC' },
      { key: 'Status',      label: 'STATUS' },
      { key: 'Report Sick', label: 'REPORT SICK/MEDICAL REVIEW' },
      { key: 'Off/Leave',   label: 'LEAVE/MA/OFF/COURSE' },
      { key: 'Guard Duty',  label: 'DUTY' },
      { key: 'Others',      label: 'OTHERS' },
    ],
    format: 'archer',
  },
  braves: {
    header: ['40 SAR BRAVES COMPANY PARADE STATE'],
    visibleDutyTypes: [],
    scopeConfigs: [
      { key: 'Off/Leave',   label: 'AL/OIL' },
      { key: 'MA',          label: 'MR' },
      { key: 'Report Sick', label: 'REPORTING SICK' },
      { key: 'Att C',       label: 'ATT C' },
      { key: 'Status',      label: 'STATUS' },
      { key: 'Others',      label: 'OTHERS' },
    ],
    format: 'braves',
  },
  cougar: {
    header: ['COUGAR COMPANY', 'FIRST PARADE STATE'],
    visibleDutyTypes: [],
    scopeConfigs: [
      { key: 'Att C',       label: 'ATTC' },
      { key: 'Report Sick', label: 'REPORT SICK' },
      { key: 'Status',      label: 'MEDICAL STATUS' },
      { key: 'MA',          label: 'MEDICAL APPT' },
      { key: 'Others',      label: 'OTHERS' },
    ],
    format: 'cougar',
  },
  stallion: {
    header: ['STALLION COY FIRST PARADE'],
    visibleDutyTypes: ALL_DUTY_TYPES,
    scopeConfigs: [
      { key: 'Att C',      label: 'ATTC' },
      { key: 'Status',     label: 'STATUS' },
      { key: 'Off/Leave',  label: 'OFF/LEAVE' },
      { key: 'Guard Duty', label: 'GUARD DUTY' },
      { key: 'Others',     label: 'OTHERS' },
    ],
    format: 'stallion',
  },
  hercules: {
    header: ['FIRST PARADE STATE', 'HQ Company'],
    visibleDutyTypes: ['COS'],
    scopeConfigs: [
      { key: 'Off/Leave',   label: 'Off/Leave' },
      { key: 'MA',          label: 'MA' },
      { key: 'Report Sick', label: 'Reporting sick' },
      { key: 'Att C',       label: 'Att C' },
      { key: 'Status',      label: 'Status' },
      { key: 'Others',      label: 'Others' },
      { key: 'Guard Duty',  label: 'Guard Duty' },
    ],
    format: 'hercules',
  },
  test: {
    header: ['TEST COY PARADE STATE'],
    visibleDutyTypes: ALL_DUTY_TYPES,
    scopeConfigs: STD_SCOPES,
  },
}

export const COMPANY_THEMES: Record<Company, {
  cardBorder: string
  cardHoverBg: string
  cardText: string
  activeBorder: string
  activeText: string
  buttonBg: string
  buttonHoverBg: string
  focusRing: string
  badgeBg: string
  badgeText: string
}> = {
  archer: {
    cardBorder: 'border-yellow-400',
    cardHoverBg: 'hover:bg-yellow-400',
    cardText: 'text-yellow-900',
    activeBorder: 'border-yellow-500',
    activeText: 'text-yellow-700',
    buttonBg: 'bg-yellow-500',
    buttonHoverBg: 'hover:bg-yellow-600',
    focusRing: 'focus:ring-yellow-400',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-800',
  },
  braves: {
    cardBorder: 'border-red-400',
    cardHoverBg: 'hover:bg-red-400',
    cardText: 'text-red-900',
    activeBorder: 'border-red-500',
    activeText: 'text-red-700',
    buttonBg: 'bg-red-500',
    buttonHoverBg: 'hover:bg-red-600',
    focusRing: 'focus:ring-red-400',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-800',
  },
  cougar: {
    cardBorder: 'border-green-400',
    cardHoverBg: 'hover:bg-green-400',
    cardText: 'text-green-900',
    activeBorder: 'border-green-600',
    activeText: 'text-green-700',
    buttonBg: 'bg-green-600',
    buttonHoverBg: 'hover:bg-green-700',
    focusRing: 'focus:ring-green-500',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-800',
  },
  stallion: {
    cardBorder: 'border-blue-400',
    cardHoverBg: 'hover:bg-blue-400',
    cardText: 'text-blue-900',
    activeBorder: 'border-blue-600',
    activeText: 'text-blue-700',
    buttonBg: 'bg-blue-600',
    buttonHoverBg: 'hover:bg-blue-700',
    focusRing: 'focus:ring-blue-500',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
  },
  hercules: {
    cardBorder: 'border-gray-800',
    cardHoverBg: 'hover:bg-gray-900',
    cardText: 'text-gray-900',
    activeBorder: 'border-gray-800',
    activeText: 'text-gray-900',
    buttonBg: 'bg-gray-900',
    buttonHoverBg: 'hover:bg-black',
    focusRing: 'focus:ring-gray-800',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-900',
  },
  test: {
    cardBorder: 'border-gray-400',
    cardHoverBg: 'hover:bg-gray-400',
    cardText: 'text-gray-700',
    activeBorder: 'border-gray-500',
    activeText: 'text-gray-600',
    buttonBg: 'bg-gray-500',
    buttonHoverBg: 'hover:bg-gray-600',
    focusRing: 'focus:ring-gray-400',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-700',
  },
}
