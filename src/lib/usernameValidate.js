/** Client-side mirror of server handle rules (signup, profile). */

export const HANDLE_RULES_TEXT =
  '3–32 characters, start with a letter, then lowercase letters, numbers, or underscores only.'

const RESERVED = new Set([
  'admin',
  'api',
  'loft',
  'system',
  'signup',
  'login',
  'watch',
  'rooms',
  'friends',
  'u',
  'me',
  'settings',
])

const HANDLE_RE = /^[a-z][a-z0-9_]{2,31}$/

/**
 * @returns {{ ok: true, username: string } | { ok: false, error: string }}
 */
export function validateStrictUsername(raw) {
  const trimmed = String(raw ?? '').trim()
  const s = trimmed.toLowerCase()
  const withoutAt = s.startsWith('@') ? s.slice(1) : s
  if (!withoutAt) {
    return { ok: false, error: 'Username is required' }
  }
  if (!HANDLE_RE.test(withoutAt)) {
    return {
      ok: false,
      error: `Handle must be ${HANDLE_RULES_TEXT}`,
    }
  }
  if (RESERVED.has(withoutAt)) {
    return { ok: false, error: 'This handle is reserved' }
  }
  return { ok: true, username: withoutAt }
}
