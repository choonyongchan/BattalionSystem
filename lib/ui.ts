export function editInputClass(hasError: boolean, focusRing: string): string {
  const base = 'border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 w-full'
  return hasError
    ? `${base} border-red-500 ring-2 ring-red-500`
    : `${base} border-gray-300 ${focusRing}`
}
