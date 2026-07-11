// 极简主题上下文 — 管理深色/浅色模式
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'app_theme'
const DEFAULT_THEME: Theme = 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeCtx = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  toggle: () => {},
  setTheme: () => {},
})

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  // 默认浅色模式，不跟随系统偏好
  return DEFAULT_THEME
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(loadTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // 默认浅色模式，不跟随系统主题变化

  const toggle = () => setThemeState(prev => prev === 'light' ? 'dark' : 'light')
  const setTheme = (t: Theme) => setThemeState(t)

  return (
    <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
export type { Theme }
