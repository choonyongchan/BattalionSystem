'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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
  const [menuRect, setMenuRect] = useState<{ left: number; width: number; top: number; bottom: number } | null>(null)

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

    function updateRect() {
      if (!ref.current) return
      const { left, width, top, bottom } = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - bottom
      setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT)
      setMenuRect({ left, width, top, bottom })
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
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
      {!disabled && open && filtered.length > 0 && menuRect && createPortal(
        <ul
          className="fixed z-30 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg"
          style={{
            left: menuRect.left,
            width: menuRect.width,
            ...(openUpward ? { bottom: window.innerHeight - menuRect.top + 4 } : { top: menuRect.bottom + 4 }),
          }}
        >
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
        </ul>,
        document.body
      )}
    </div>
  )
}
