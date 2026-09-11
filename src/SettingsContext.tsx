import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppSettings } from './types'

const SETTINGS_KEY = 'mcq-settings.json'

const DEFAULTS: AppSettings = {
  theme: 'dark',
  randomizeOptions: true,
  randomizeQuestionOrder: true
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULTS
}

const SettingsContext = createContext<{ settings: AppSettings; update: (patch: Partial<AppSettings>) => void }>({
  settings: DEFAULTS,
  update: () => {}
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(settings.theme)
  }, [settings])

  const update = (patch: Partial<AppSettings>) =>
    setSettings(s => ({ ...s, ...patch }))

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
