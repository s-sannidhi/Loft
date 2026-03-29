import { useState } from 'react'
import {
  applyResolvedTheme,
  getStoredThemePreference,
  setThemePreference,
} from '../lib/theme'

function ThemeToggle() {
  const [pref, setPref] = useState(getStoredThemePreference)

  function cycle() {
    const order = ['system', 'light', 'dark']
    const next = order[(order.indexOf(pref) + 1) % order.length]
    setPref(next)
    setThemePreference(next)
    applyResolvedTheme()
  }

  const label =
    pref === 'system'
      ? 'Theme: system'
      : pref === 'dark'
        ? 'Theme: dark'
        : 'Theme: light'

  return (
    <button
      type="button"
      onClick={cycle}
      className="meta-font shrink-0 rounded-lg border border-mutedline bg-cream px-2.5 py-1.5 text-[11px] font-medium text-ink transition hover:bg-card md:text-xs"
      title={label}
      aria-label={label}
    >
      {pref === 'system' && '◐ Auto'}
      {pref === 'light' && '☀ Light'}
      {pref === 'dark' && '☾ Dark'}
    </button>
  )
}

export default ThemeToggle
