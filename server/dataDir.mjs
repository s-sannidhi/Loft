import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Writable directory for loft-db.json, rooms.json, avatars.
 * Set LOFT_DATA_DIR on hosts with a mounted persistent disk (e.g. Render/Railway disk).
 */
export function loftDataDir() {
  const fromEnv = String(process.env.LOFT_DATA_DIR || '').trim()
  if (fromEnv) return fromEnv
  return join(__dirname, 'data')
}
