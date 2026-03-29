/** Normalize one shelf row for stable imdbID keys and PUT shape. */
function normalizeShelfRow(x) {
  return {
    imdbID: String(x?.imdbID || ''),
    title: String(x?.title || ''),
    type: String(x?.type || ''),
    poster: String(x?.poster || ''),
    completed: Boolean(x?.completed),
  }
}

const PROFILE_SHELF_CAP = 500

/**
 * Union profile shelf with current room: same imdbID is overwritten by the room row
 * (fresh title/poster/completed from this loft).
 */
export function mergeProfileShelfItems(existing, fromRoom) {
  const map = new Map()
  for (const x of existing || []) {
    const n = normalizeShelfRow(x)
    if (n.imdbID) map.set(n.imdbID, n)
  }
  for (const x of fromRoom || []) {
    const n = normalizeShelfRow(x)
    if (n.imdbID) map.set(n.imdbID, n)
  }
  return [...map.values()].slice(0, PROFILE_SHELF_CAP)
}
