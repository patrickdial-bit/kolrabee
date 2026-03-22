'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface TourStep {
  target: string          // CSS selector for the element to highlight
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

interface GuidedTourProps {
  steps: TourStep[]
  tourKey: string         // unique key per page, e.g. "admin-dashboard"
  onComplete?: () => void
}

export default function GuidedTour({ steps, tourKey, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [active, setActive] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const storageKey = `tour_completed_${tourKey}`

  useEffect(() => {
    const completed = localStorage.getItem(storageKey)
    if (!completed) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setActive(true), 600)
      return () => clearTimeout(timer)
    }
  }, [storageKey])

  const updateRect = useCallback(() => {
    if (!active || !steps[currentStep]) return
    const el = document.querySelector(steps[currentStep].target)
    if (el) {
      const r = el.getBoundingClientRect()
      setRect(r)
      // Scroll into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      setRect(null)
    }
  }, [active, currentStep, steps])

  useEffect(() => {
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [updateRect])

  const dismiss = useCallback(() => {
    setActive(false)
    localStorage.setItem(storageKey, 'true')
    onComplete?.()
  }, [storageKey, onComplete])

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      dismiss()
    }
  }, [currentStep, steps.length, dismiss])

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }, [currentStep])

  if (!active || !steps[currentStep]) return null

  const step = steps[currentStep]
  const placement = step.placement ?? 'bottom'
  const pad = 8

  // Calculate popover position — clamped to viewport
  const popW = 320 // w-80 = 20rem = 320px
  const margin = 16
  let popStyle: React.CSSProperties = {}

  if (rect) {
    let top = 0, left = 0

    switch (placement) {
      case 'bottom':
        top = rect.bottom + pad + 8
        left = rect.left + rect.width / 2 - popW / 2
        break
      case 'top':
        top = rect.top - pad - 8
        left = rect.left + rect.width / 2 - popW / 2
        break
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - pad - 8 - popW
        break
      case 'right':
        top = rect.top + rect.height / 2
        left = rect.right + pad + 8
        break
    }

    // Clamp left to stay within viewport
    left = Math.max(margin, Math.min(left, window.innerWidth - popW - margin))
    // Clamp top
    top = Math.max(margin, Math.min(top, window.innerHeight - 200))

    popStyle = { top, left }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998]" onClick={dismiss}>
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - pad}
                  y={rect.top - pad}
                  width={rect.width + pad * 2}
                  height={rect.height + pad * 2}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(0,0,0,0.5)"
            mask="url(#tour-mask)"
          />
        </svg>

        {/* Highlight border */}
        {rect && (
          <div
            className="absolute rounded-lg ring-2 ring-indigo-500 ring-offset-2 pointer-events-none"
            style={{
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
            }}
          />
        )}
      </div>

      {/* Popover card */}
      <div
        ref={popoverRef}
        className="fixed z-[9999] w-80 rounded-xl bg-white shadow-2xl border border-gray-200 p-5"
        style={popStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step counter */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-indigo-600">
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close tour"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">{step.title}</h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">{step.content}</p>

        {/* Progress dots */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-4 bg-indigo-600' : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={prev}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              {currentStep < steps.length - 1 ? 'Next' : 'Got it!'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// Utility to reset a tour (used by the "?" help button)
export function resetTour(tourKey: string) {
  localStorage.removeItem(`tour_completed_${tourKey}`)
}

// Utility to check if a tour has been completed
export function isTourCompleted(tourKey: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(`tour_completed_${tourKey}`) === 'true'
}
