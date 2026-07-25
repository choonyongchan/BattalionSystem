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
  disabled,
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
  disabled?: boolean
}) {
  const selected = items.find(i => getKey(i) === value)
  const [query, setQuery] = useState(() => selected ? getLabel(selected) : value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [openUpward, setOpenUpward] = useState(false)

  const filtered = query.trim() ? items.filter(i => matches(i, query)) : items

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(() => {
    if (!open || !ref.current) return
    const DROPDOWN_MAX_HEIGHT = 208 // matches max-h-52
    const { bottom } = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - bottom
    setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT)
  }, [open])

  useEffect(() => {
    if (!value) return
    inputRef.current?.focus()
    inputRef.current?.select()
    setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`${inputClass} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
        autoComplete="off"
        disabled={disabled}
      />
      {!disabled && open && filtered.length > 0 && (
        <ul className={`absolute z-30 left-0 right-0 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
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
