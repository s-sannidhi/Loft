/**
 * Last-known room payload per tab (sessionStorage). Makes /watch usable while the
 * API cold-starts; refreshed after each successful load or save.
 */
const PREFIX = 'loft_room_v1:'
const MAX_CHARS = 500_000

export function readRoomSessionCache(roomId) {
  if (!roomId || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PREFIX + roomId)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

export function writeRoomSessionCache(roomId, record) {
  if (!roomId || !record || typeof sessionStorage === 'undefined') return
  try {
    const s = JSON.stringify(record)
    if (s.length > MAX_CHARS) return
    sessionStorage.setItem(PREFIX + roomId, s)
  } catch {
    /* quota or private mode */
  }
}
