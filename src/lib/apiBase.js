/**
 * Resolves the Loft API origin for browser fetches.
 * In production, VITE_API_URL must be set or requests hit the static host (and break).
 */
export function resolveLoftApiOrigin() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim()
  const base = raw.replace(/\/$/, '')
  if (import.meta.env.PROD && !base) {
    throw new Error(
      'VITE_API_URL is not set. In Vercel (or your frontend host), add an environment variable VITE_API_URL with your API base URL (e.g. https://loft-api.onrender.com) with no trailing slash, then redeploy.'
    )
  }
  return base
}

/** Path must start with / */
export function loftApiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = resolveLoftApiOrigin()
  if (!base) return p
  return `${base}${p}`
}
