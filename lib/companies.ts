export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules'] as const
export type Company = (typeof COMPANIES)[number]

export const DISABLED_COMPANIES = new Set<Company>(['archer', 'braves', 'cougar'])

export function companyLabel(company: Company) {
  return company[0].toUpperCase() + company.slice(1)
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
}
