const STORAGE_KEY = 'loft-theme'

/** @returns {'light' | 'dark' | 'system'} */
export function getStoredThemePreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

export function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Resolved mode applied to `html` */
export function getResolvedMode() {
  const pref = getStoredThemePreference()
  if (pref === 'system') {
    return getSystemDark() ? 'dark' : 'light'
  }
  return pref
}

/** @param {'light' | 'dark' | 'system'} pref */
export function setThemePreference(pref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    /* ignore */
  }
  applyResolvedTheme()
}

export function applyResolvedTheme() {
  const pref = getStoredThemePreference()
  const dark =
    pref === 'dark' || (pref === 'system' && getSystemDark())
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function initTheme() {
  applyResolvedTheme()
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getStoredThemePreference() === 'system') {
        applyResolvedTheme()
      }
    })
}
