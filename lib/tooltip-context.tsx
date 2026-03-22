'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const TooltipContext = createContext<{ enabled: boolean; toggle: () => void }>({
  enabled: true,
  toggle: () => {},
})

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('tooltips_enabled')
    if (stored === 'false') setEnabled(false)
  }, [])

  function toggle() {
    setEnabled((prev) => {
      const next = !prev
      localStorage.setItem('tooltips_enabled', String(next))
      return next
    })
  }

  return (
    <TooltipContext.Provider value={{ enabled, toggle }}>
      {children}
    </TooltipContext.Provider>
  )
}

export function useTooltips() {
  return useContext(TooltipContext)
}
