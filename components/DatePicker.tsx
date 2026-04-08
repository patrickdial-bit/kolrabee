'use client'

import { useEffect, useRef, useState } from 'react'

interface DatePickerProps {
  id?: string
  name: string
  defaultValue?: string | null
  required?: boolean
}

// ---------- Parsing helpers ----------

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function makeISO(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return toISODate(date)
}

function todayStart(): Date {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

/**
 * Parse a flexible user-entered date into YYYY-MM-DD.
 * Accepts: today/tomorrow/yesterday, "in 3 days", "+1w", "next week",
 * M/D/YYYY, M-D-YY, YYYY-MM-DD, "Apr 10 2026", etc.
 * Returns null if unparseable.
 */
export function parseFlexibleDate(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null
  const lower = input.toLowerCase()

  // Keyword shortcuts
  if (lower === 'today') return toISODate(todayStart())
  if (lower === 'tomorrow') {
    const d = todayStart()
    d.setDate(d.getDate() + 1)
    return toISODate(d)
  }
  if (lower === 'yesterday') {
    const d = todayStart()
    d.setDate(d.getDate() - 1)
    return toISODate(d)
  }
  if (lower === 'next week') {
    const d = todayStart()
    d.setDate(d.getDate() + 7)
    return toISODate(d)
  }

  // "in N days", "+Nd", "N days"
  const relDays = lower.match(/^(?:in\s+)?\+?(\d+)\s*(?:d|days?)$/)
  if (relDays) {
    const n = parseInt(relDays[1], 10)
    const d = todayStart()
    d.setDate(d.getDate() + n)
    return toISODate(d)
  }

  // "in N weeks", "+Nw", "N weeks"
  const relWeeks = lower.match(/^(?:in\s+)?\+?(\d+)\s*(?:w|weeks?)$/)
  if (relWeeks) {
    const n = parseInt(relWeeks[1], 10)
    const d = todayStart()
    d.setDate(d.getDate() + n * 7)
    return toISODate(d)
  }

  // ISO format YYYY-MM-DD
  const iso = lower.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return makeISO(parseInt(iso[1], 10), parseInt(iso[2], 10), parseInt(iso[3], 10))
  }

  // US format M/D/YYYY, M-D-YYYY, M/D/YY, M/D (current year)
  const us = lower.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2}|\d{4}))?$/)
  if (us) {
    const m = parseInt(us[1], 10)
    const d = parseInt(us[2], 10)
    let y = us[3] ? parseInt(us[3], 10) : new Date().getFullYear()
    if (y < 100) y += y >= 70 ? 1900 : 2000
    return makeISO(y, m, d)
  }

  // Natural language fallback (e.g. "Apr 10 2026", "April 10, 2026")
  const nat = new Date(input)
  if (!isNaN(nat.getTime())) return toISODate(nat)

  return null
}

function formatForDisplay(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return ''
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatForInput(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return ''
  const [y, m, d] = parts
  return `${m}/${d}/${y}`
}

// ---------- Component ----------

export default function DatePicker({ id, name, defaultValue, required }: DatePickerProps) {
  const initialISO = defaultValue && parseFlexibleDate(defaultValue) ? parseFlexibleDate(defaultValue)! : ''
  const [iso, setIso] = useState<string>(initialISO)
  const [text, setText] = useState<string>(initialISO ? formatForInput(initialISO) : '')
  const [invalid, setInvalid] = useState(false)
  const nativeRef = useRef<HTMLInputElement>(null)

  // Keep text in sync if the form is reset externally
  useEffect(() => {
    if (defaultValue !== undefined) {
      const parsed = defaultValue ? parseFlexibleDate(defaultValue) : null
      setIso(parsed ?? '')
      setText(parsed ? formatForInput(parsed) : '')
      setInvalid(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue])

  const commitText = (raw: string) => {
    if (!raw.trim()) {
      setIso('')
      setText('')
      setInvalid(false)
      return
    }
    const parsed = parseFlexibleDate(raw)
    if (parsed) {
      setIso(parsed)
      setText(formatForInput(parsed))
      setInvalid(false)
    } else {
      setInvalid(true)
    }
  }

  const setFromOffset = (days: number) => {
    const d = todayStart()
    d.setDate(d.getDate() + days)
    const next = toISODate(d)
    setIso(next)
    setText(formatForInput(next))
    setInvalid(false)
  }

  const clear = () => {
    setIso('')
    setText('')
    setInvalid(false)
  }

  const openNativePicker = () => {
    const el = nativeRef.current
    if (!el) return
    // Try showPicker() (Chrome/Edge/Firefox), fall back to focus+click
    if (typeof (el as unknown as { showPicker?: () => void }).showPicker === 'function') {
      try {
        ;(el as unknown as { showPicker: () => void }).showPicker()
        return
      } catch {
        /* fall through */
      }
    }
    el.focus()
    el.click()
  }

  const preview = iso ? formatForDisplay(iso) : ''

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (invalid) setInvalid(false)
          }}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitText((e.target as HTMLInputElement).value)
            }
          }}
          placeholder="MM/DD/YYYY or 'today', 'in 3 days'"
          required={required}
          aria-invalid={invalid}
          className={`block w-full rounded-md border pl-3 pr-20 py-2 text-gray-900 placeholder-gray-400 focus:ring-1 sm:text-sm ${
            invalid
              ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500'
              : 'border-gray-300 focus:border-ember focus:ring-ember'
          }`}
        />
        {iso && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear date"
            className="absolute right-10 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={openNativePicker}
          aria-label="Open calendar"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-ember"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
        </button>
      </div>

      {/* Hidden native date input for the calendar popup + form submission */}
      <input
        ref={nativeRef}
        type="date"
        name={name}
        value={iso}
        onChange={(e) => {
          const v = e.target.value
          setIso(v)
          setText(v ? formatForInput(v) : '')
          setInvalid(false)
        }}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />

      {/* Quick-pick buttons */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <QuickPick label="Today" onClick={() => setFromOffset(0)} />
        <QuickPick label="Tomorrow" onClick={() => setFromOffset(1)} />
        <QuickPick label="+3 days" onClick={() => setFromOffset(3)} />
        <QuickPick label="+1 week" onClick={() => setFromOffset(7)} />
      </div>

      {/* Preview / error */}
      <div className="mt-1.5 min-h-[1.25rem] text-xs">
        {invalid ? (
          <span className="text-amber-600">
            Couldn&apos;t understand that date. Try MM/DD/YYYY or &ldquo;today&rdquo;.
          </span>
        ) : preview ? (
          <span className="text-gray-500">{preview}</span>
        ) : null}
      </div>
    </div>
  )
}

function QuickPick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-ember hover:text-ember transition-colors"
    >
      {label}
    </button>
  )
}
