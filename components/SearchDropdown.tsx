'use client'

import React, { useState, useEffect, useRef } from 'react'

export default function SearchDropdown<T>({
  items,
  value,
  getKey,
  getLabel,
  matches,
  renderOption,
  onChange,
  inputClass,
  placeholder,
}: {
  items: T[]
  value: string
  getKey: (item: T) => string
  getLabel: (item: T) => string
  matches: (item: T, query: string) => boolean
  renderOption: (item: T) => React.ReactNode
  onChange: (key: string) => void
  inputClass: string
  placeholder?: string
}) {
  const selected = items.find(i => getKey(i) === value)
  const [query, setQuery] = useState(() => selected ? getLabel(selected) : value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.trim() ? items.filter(i => matches(i, query)) : items

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {filtered.map(item => (
            <li key={getKey(item)}>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  onChange(getKey(item))
                  setQuery(getLabel(item))
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
              >
                {renderOption(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
