import React, { createContext, useContext, useState } from 'react'

interface HourContextValue {
  hour: number
  setHour: (h: number) => void
}

const HourContext = createContext<HourContextValue | undefined>(undefined)

export function HourProvider({ children }: { children: React.ReactNode }) {
  const [hour, setHour] = useState<number>(8)
  return <HourContext.Provider value={{ hour, setHour }}>{children}</HourContext.Provider>
}

export function useHour() {
  const ctx = useContext(HourContext)
  if (!ctx) throw new Error('useHour must be used within HourProvider')
  return ctx
}

export function formatHour(h: number): string {
  return `${String(h - 1).padStart(2, '0')}:00`
}
