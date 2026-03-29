const KEY = 'loft_saved_rooms'
const MAX = 50

function isValidRoomId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(id)
}

function normalizeEntry(x) {
  if (!x || typeof x !== 'object') return null
  const id = String(x.id || '')
  if (!isValidRoomId(id)) return null
  const name = String(x.name || 'Loft').trim().slice(0, 80) || 'Loft'
  const lastVisited = Number(x.lastVisited) || 0
  return { id, name, lastVisited }
}

export function readLocalSavedRooms() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const out = []
    const seen = new Set()
    for (const item of arr) {
      const e = normalizeEntry(item)
      if (!e || seen.has(e.id)) continue
      seen.add(e.id)
      out.push(e)
    }
    return out.sort((a, b) => b.lastVisited - a.lastVisited).slice(0, MAX)
  } catch {
    return []
  }
}

function writeList(list) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(list.slice(0, MAX), null, 0)
    )
  } catch {
    /* ignore */
  }
}

export function touchLocalSavedRoom(roomId, roomName) {
  if (!isValidRoomId(roomId)) return
  const name =
    typeof roomName === 'string' && roomName.trim()
      ? roomName.trim().slice(0, 80)
      : 'Loft'
  const now = Date.now()
  let list = readLocalSavedRooms()
  const idx = list.findIndex((r) => r.id === roomId)
  const entry = { id: roomId, name, lastVisited: now }
  if (idx >= 0) {
    list[idx] = entry
  } else {
    list.push(entry)
  }
  list = list.sort((a, b) => b.lastVisited - a.lastVisited).slice(0, MAX)
  writeList(list)
}

export function removeLocalSavedRoom(roomId) {
  if (!isValidRoomId(roomId)) return
  const list = readLocalSavedRooms().filter((r) => r.id !== roomId)
  writeList(list)
}
