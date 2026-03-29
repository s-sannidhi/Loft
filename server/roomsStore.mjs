import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOMS_PATH = join(__dirname, 'data', 'rooms.json')

function defaultDb() {
  return { rooms: {} }
}

function normalizePayload(body) {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return {
      roomName: typeof body.roomName === 'string' ? body.roomName : 'Loft',
      movies: Array.isArray(body.movies) ? body.movies : [],
    }
  }
  return { roomName: 'Loft', movies: [] }
}

function normalizeSharedIds(arr) {
  if (!Array.isArray(arr)) return []
  const out = []
  const seen = new Set()
  for (const x of arr) {
    const id = String(x || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.slice(0, 200)
}

function normalizeReviews(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [imdb, byUser] of Object.entries(raw)) {
    const imdbKey = String(imdb || '').trim()
    if (!imdbKey || typeof byUser !== 'object' || byUser === null) continue
    const inner = {}
    for (const [uid, rev] of Object.entries(byUser)) {
      const userId = String(uid || '').trim()
      if (!userId || !rev || typeof rev !== 'object') continue
      let rating = rev.rating
      if (rating != null && rating !== '') {
        const n = Number(rating)
        rating = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null
      } else {
        rating = null
      }
      const text =
        typeof rev.text === 'string' ? rev.text.trim().slice(0, 2000) : ''
      const updatedAt = Number(rev.updatedAt) || 0
      inner[userId] = { rating, text, updatedAt }
    }
    if (Object.keys(inner).length) out[imdbKey] = inner
  }
  return out
}

/** Full room document for API + disk. */
export function normalizeRoomRecord(raw) {
  const base = normalizePayload(raw)
  const owner = raw?.ownerUserId
  return {
    roomName: base.roomName,
    movies: base.movies,
    ownerUserId:
      typeof owner === 'string' && owner.length > 0 ? owner : null,
    sharedUserIds: normalizeSharedIds(raw?.sharedUserIds),
    reviews: normalizeReviews(raw?.reviews),
  }
}

/** New room document (local disk or JSONBin). */
export function initialRoomRecordForCreate(body, ownerUserId = null) {
  return normalizeRoomRecord({
    ...normalizePayload(body),
    ownerUserId: ownerUserId || null,
    sharedUserIds: [],
  })
}

export function isValidRoomId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(id)
}

export function loadRoomsDb() {
  try {
    const dir = dirname(ROOMS_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    if (!existsSync(ROOMS_PATH)) {
      const initial = defaultDb()
      writeFileSync(ROOMS_PATH, JSON.stringify(initial, null, 2), 'utf8')
      return initial
    }
    const raw = readFileSync(ROOMS_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const rooms =
      parsed && typeof parsed.rooms === 'object' && parsed.rooms !== null
        ? parsed.rooms
        : {}
    return { rooms }
  } catch {
    return defaultDb()
  }
}

export function saveRoomsDb(db) {
  try {
    const dir = dirname(ROOMS_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(ROOMS_PATH, JSON.stringify({ rooms: db.rooms }, null, 2), 'utf8')
  } catch (e) {
    const code = e?.code
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
      throw new Error(
        'Cannot write room data to disk (read-only or permission denied). Set JSONBIN_KEY on the server to use JSONBin for rooms, or use a host with a writable filesystem.'
      )
    }
    throw e
  }
}

/**
 * @param {object} body
 * @param {string | null} ownerUserId
 */
export function createLocalRoom(body, ownerUserId = null) {
  const db = loadRoomsDb()
  const id = randomUUID()
  const rec = initialRoomRecordForCreate(body, ownerUserId)
  db.rooms[id] = rec
  saveRoomsDb(db)
  return id
}

export function getLocalRoom(id) {
  if (!isValidRoomId(id)) return null
  const db = loadRoomsDb()
  const record = db.rooms[id]
  return record ? normalizeRoomRecord(record) : null
}

/** Client PUT: only updates roomName + movies; preserves owner, shared, reviews. */
export function mergeClientPutIntoRecord(existingRaw, body) {
  if (!existingRaw) return null
  const parsed = normalizePayload(body)
  const ext = normalizeRoomRecord(existingRaw)
  return {
    roomName: parsed.roomName,
    movies: parsed.movies,
    ownerUserId: ext.ownerUserId,
    sharedUserIds: ext.sharedUserIds,
    reviews: ext.reviews,
  }
}

/** Client PUT: only updates roomName + movies; preserves owner + shared lists. */
export function putLocalRoom(id, body) {
  if (!isValidRoomId(id)) return null
  const db = loadRoomsDb()
  const existing = db.rooms[id]
  if (!existing) return null
  const next = mergeClientPutIntoRecord(existing, body)
  db.rooms[id] = next
  saveRoomsDb(db)
  return next
}

export function recordWithReviewPatch(recordRaw, imdbID, userId, { rating, text }) {
  if (!imdbID || !userId) return null
  const norm = normalizeRoomRecord(recordRaw)
  const inShelf = norm.movies.some((m) => m.imdbID === imdbID)
  if (!inShelf) return null
  if (!norm.reviews[imdbID]) norm.reviews[imdbID] = {}
  const prev = norm.reviews[imdbID][userId] || {
    rating: null,
    text: '',
    updatedAt: 0,
  }
  let nextRating = prev.rating
  if (rating !== undefined) {
    if (rating === null || rating === '') {
      nextRating = null
    } else {
      const n = Number(rating)
      nextRating = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null
    }
  }
  let nextText = prev.text
  if (typeof text === 'string') {
    nextText = text.trim().slice(0, 2000)
  }
  norm.reviews[imdbID][userId] = {
    rating: nextRating,
    text: nextText,
    updatedAt: Date.now(),
  }
  return norm
}

export function patchLocalRoomReview(roomId, imdbID, userId, patch) {
  if (!isValidRoomId(roomId) || !imdbID || !userId) return null
  const db = loadRoomsDb()
  const rec = db.rooms[roomId]
  if (!rec) return null
  const next = recordWithReviewPatch(rec, imdbID, userId, patch)
  if (!next) return null
  db.rooms[roomId] = next
  saveRoomsDb(db)
  return next
}

export function recordWithReviewDelete(recordRaw, imdbID, userId) {
  const norm = normalizeRoomRecord(recordRaw)
  if (norm.reviews[imdbID]?.[userId]) {
    delete norm.reviews[imdbID][userId]
    if (Object.keys(norm.reviews[imdbID]).length === 0) {
      delete norm.reviews[imdbID]
    }
  }
  return norm
}

export function deleteLocalRoomReview(roomId, imdbID, userId) {
  if (!isValidRoomId(roomId) || !imdbID || !userId) return null
  const db = loadRoomsDb()
  const rec = db.rooms[roomId]
  if (!rec) return null
  const norm = recordWithReviewDelete(rec, imdbID, userId)
  db.rooms[roomId] = norm
  saveRoomsDb(db)
  return norm
}

export function recordWithShareAdded(recordRaw, targetUserId) {
  if (!targetUserId) return null
  const norm = normalizeRoomRecord(recordRaw)
  if (norm.sharedUserIds.includes(targetUserId)) {
    return norm
  }
  norm.sharedUserIds.push(targetUserId)
  return norm
}

export function recordWithShareRemoved(recordRaw, targetUserId) {
  if (!targetUserId) return null
  const norm = normalizeRoomRecord(recordRaw)
  norm.sharedUserIds = norm.sharedUserIds.filter((id) => id !== targetUserId)
  return norm
}

export function addLocalRoomShare(roomId, targetUserId) {
  if (!isValidRoomId(roomId) || !targetUserId) return null
  const db = loadRoomsDb()
  const rec = db.rooms[roomId]
  if (!rec) return null
  const norm = recordWithShareAdded(rec, targetUserId)
  if (!norm) return null
  db.rooms[roomId] = norm
  saveRoomsDb(db)
  return norm
}

export function removeLocalRoomShare(roomId, targetUserId) {
  if (!isValidRoomId(roomId) || !targetUserId) return null
  const db = loadRoomsDb()
  const rec = db.rooms[roomId]
  if (!rec) return null
  const norm = recordWithShareRemoved(rec, targetUserId)
  if (!norm) return null
  db.rooms[roomId] = norm
  saveRoomsDb(db)
  return norm
}
