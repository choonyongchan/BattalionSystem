export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules'] as const
export type Company = (typeof COMPANIES)[number]

export const COMPANY_LABELS: Record<Company, string> = {
  archer: 'Archer',
  braves: 'Braves',
  cougar: 'Cougar',
  stallion: 'Stallion',
  hercules: 'Hercules',
}

export const COMPANY_THEMES: Record<Company, {
  cardBorder: string
  cardHoverBg: string
  cardText: string
  cardHoverSubText: string
  navBg: string
  navLinkText: string
  navDivider: string
  tabActiveBorder: string
  tabActiveText: string
}> = {
  archer: {
    cardBorder: 'border-yellow-500',
    cardHoverBg: 'hover:bg-yellow-500',
    cardText: 'text-yellow-800',
    cardHoverSubText: 'group-hover:text-yellow-100',
    navBg: 'bg-yellow-600',
    navLinkText: 'text-yellow-100 hover:text-white',
    navDivider: 'text-yellow-400',
    tabActiveBorder: 'border-yellow-600',
    tabActiveText: 'text-yellow-700',
  },
  braves: {
    cardBorder: 'border-red-700',
    cardHoverBg: 'hover:bg-red-700',
    cardText: 'text-red-800',
    cardHoverSubText: 'group-hover:text-red-200',
    navBg: 'bg-red-700',
    navLinkText: 'text-red-200 hover:text-white',
    navDivider: 'text-red-400',
    tabActiveBorder: 'border-red-700',
    tabActiveText: 'text-red-700',
  },
  cougar: {
    cardBorder: 'border-green-700',
    cardHoverBg: 'hover:bg-green-700',
    cardText: 'text-green-800',
    cardHoverSubText: 'group-hover:text-green-200',
    navBg: 'bg-green-800',
    navLinkText: 'text-green-300 hover:text-white',
    navDivider: 'text-green-500',
    tabActiveBorder: 'border-green-700',
    tabActiveText: 'text-green-700',
  },
  stallion: {
    cardBorder: 'border-blue-700',
    cardHoverBg: 'hover:bg-blue-700',
    cardText: 'text-blue-800',
    cardHoverSubText: 'group-hover:text-blue-200',
    navBg: 'bg-blue-800',
    navLinkText: 'text-blue-300 hover:text-white',
    navDivider: 'text-blue-500',
    tabActiveBorder: 'border-blue-700',
    tabActiveText: 'text-blue-700',
  },
  hercules: {
    cardBorder: 'border-gray-900',
    cardHoverBg: 'hover:bg-gray-900',
    cardText: 'text-gray-900',
    cardHoverSubText: 'group-hover:text-gray-400',
    navBg: 'bg-gray-900',
    navLinkText: 'text-gray-400 hover:text-white',
    navDivider: 'text-gray-600',
    tabActiveBorder: 'border-gray-900',
    tabActiveText: 'text-gray-900',
  },
}

export function isValidCompany(slug: string): slug is Company {
  return (COMPANIES as readonly string[]).includes(slug)
}
