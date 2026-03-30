import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { WatchmodeClient } from '@watchmode/api-client'
import { loadStore, saveStore } from './store.mjs'
import {
  createLocalRoom,
  getLocalRoom,
  putLocalRoom,
  isValidRoomId,
  addLocalRoomShare,
  removeLocalRoomShare,
  patchLocalRoomReview,
  deleteLocalRoomReview,
  initialRoomRecordForCreate,
  mergeClientPutIntoRecord,
  normalizeRoomRecord,
  recordWithReviewPatch,
  recordWithReviewDelete,
  recordWithShareAdded,
  recordWithShareRemoved,
} from './roomsStore.mjs'
import { jsonBinGetRecord, jsonBinPutRecord } from './jsonBinRooms.mjs'
import { loftDataDir } from './dataDir.mjs'
import { validateStrictUsername } from './usernameValidate.mjs'
import { fetch as undiciFetch } from 'undici'

/** Render and older Node images may lack global fetch (JSONBin + TMDB use it). */
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = undiciFetch
}

const AVATAR_DIR = join(loftDataDir(), 'avatars')
const AVATAR_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

function ensureAvatarDir() {
  if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true })
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureAvatarDir()
      cb(null, AVATAR_DIR)
    },
    filename: (req, file, cb) => {
      const ext = AVATAR_MIME_TO_EXT[file.mimetype] || '.img'
      cb(null, `${req.userId}${ext}`)
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIME_TO_EXT[file.mimetype]) cb(null, true)
    else cb(new Error('Use JPEG, PNG, WebP, or GIF'))
  },
})

const PORT = Number(process.env.PORT) || 8787
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-change-me'
const JSONBIN_KEY = process.env.JSONBIN_KEY
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b'

/** Rooms: disk (`server/data/rooms.json`) by default; JSONBin if `JSONBIN_KEY` is set (override with ROOM_STORAGE). */
function roomsBackend() {
  const explicit = String(process.env.ROOM_STORAGE || '').toLowerCase()
  if (explicit === 'local') return 'local'
  if (explicit === 'jsonbin') return 'jsonbin'
  return JSONBIN_KEY ? 'jsonbin' : 'local'
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))
ensureAvatarDir()
app.use('/api/avatars', express.static(AVATAR_DIR))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

function jsonBinHeaders() {
  if (!JSONBIN_KEY) throw new Error('JSONBIN_KEY not configured on server')
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': JSONBIN_KEY,
  }
}

async function parseJsonOrThrow(response, fallback) {
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      (text && text.length < 200 ? text : null) ||
      `${fallback} (${response.status})`
    throw new Error(message)
  }
  return data
}

/* ---------- Auth helpers (rooms + API) ---------- */
function authUser(req) {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET)
    return payload
  } catch {
    return null
  }
}

function optionalAuth(req, res, next) {
  const u = authUser(req)
  if (u?.sub) {
    req.userId = u.sub
    req.username = u.username
  }
  next()
}

function requireAuth(req, res, next) {
  const u = authUser(req)
  if (!u?.sub) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.userId = u.sub
  req.username = u.username
  next()
}

function normalizeUsername(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32)
}

const MAX_SAVED_ROOMS = 50

function userSavedRooms(user) {
  if (!Array.isArray(user.savedRooms)) user.savedRooms = []
  return user.savedRooms
}

function sortSavedRoomsDesc(list) {
  return [...list].sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0))
}

function touchUserSavedRoom(db, userId, roomId, roomName) {
  const user = db.users.find((u) => u.id === userId)
  if (!user) return
  const list = userSavedRooms(user)
  const now = Date.now()
  const name = String(roomName || 'Loft').trim().slice(0, 80) || 'Loft'
  const idx = list.findIndex((r) => r.id === roomId)
  const entry = { id: roomId, name, lastVisited: now }
  if (idx >= 0) {
    list[idx] = entry
  } else {
    list.push(entry)
  }
  user.savedRooms = sortSavedRoomsDesc(list).slice(0, MAX_SAVED_ROOMS)
}

function removeUserSavedRoom(db, userId, roomId) {
  const user = db.users.find((u) => u.id === userId)
  if (!user) return
  user.savedRooms = userSavedRooms(user).filter((r) => r.id !== roomId)
}

function roomRoleForUser(record, userId) {
  if (!record || !userId) return 'link'
  if (record.ownerUserId === userId) return 'owner'
  if (record.sharedUserIds?.includes(userId)) return 'shared'
  return 'link'
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
}

/** Legacy users omit `onboardingComplete`; treat as done. New signups use explicit `false`. */
function clientOnboardingComplete(user) {
  return user.onboardingComplete !== false
}

function enrichLocalRoomForClient(record) {
  const { reviews: _rawReviews, ...base } = record
  const db = loadStore()
  const userById = Object.fromEntries(db.users.map((u) => [u.id, u]))
  const members = {
    owner: record.ownerUserId
      ? {
          userId: record.ownerUserId,
          username: userById[record.ownerUserId]?.username,
          displayName: userById[record.ownerUserId]?.displayName,
        }
      : null,
    shared: (record.sharedUserIds || []).map((id) => ({
      userId: id,
      username: userById[id]?.username,
      displayName: userById[id]?.displayName,
    })),
    accessNote: record.ownerUserId
      ? null
      : 'Anyone with the link can open this room.',
  }
  const reviewsByImdb = {}
  const revs = _rawReviews || {}
  for (const [imdb, byUser] of Object.entries(revs)) {
    reviewsByImdb[imdb] = {}
    for (const [uid, rev] of Object.entries(byUser)) {
      const u = userById[uid]
      reviewsByImdb[imdb][uid] = {
        ...rev,
        username: u?.username,
        displayName: u?.displayName,
      }
    }
  }
  return { ...base, members, reviewsByImdb }
}

const recoCache = new Map()
const RECO_CACHE_MS = 5 * 60 * 1000

/* ---------- Rooms (local disk or JSONBin) ---------- */
app.post('/api/rooms', optionalAuth, async (req, res) => {
  const payload =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body
      : { roomName: 'Loft', movies: [] }
  try {
    if (roomsBackend() === 'local') {
      const ownerId = req.userId || null
      const id = createLocalRoom(payload, ownerId)
      return res.json({ id })
    }
    if (!JSONBIN_KEY) {
      return res.status(503).json({
        error: 'JSONBin not configured. Set JSONBIN_KEY or use ROOM_STORAGE=local (default when key is absent).',
      })
    }
    const initial = initialRoomRecordForCreate(payload, req.userId || null)
    const response = await fetch(JSONBIN_BASE, {
      method: 'POST',
      headers: jsonBinHeaders(),
      body: JSON.stringify(initial),
    })
    const data = await parseJsonOrThrow(response, 'Failed to create room')
    const binId = data?.metadata?.id ?? data?.id
    if (binId == null || binId === '') {
      console.error(
        '[POST /api/rooms] JSONBin response missing id:',
        JSON.stringify(data)?.slice(0, 400)
      )
      return res.status(502).json({
        error:
          'JSONBin did not return a bin id. Check JSONBIN_KEY and JSONBin dashboard; response shape may have changed.',
      })
    }
    return res.json({ id: String(binId) })
  } catch (e) {
    console.error('[POST /api/rooms]', e)
    return res.status(500).json({ error: e.message })
  }
})

app.get('/api/rooms/:id/latest', async (req, res) => {
  try {
    if (roomsBackend() === 'local') {
      const record = getLocalRoom(req.params.id)
      if (!record) {
        return res.status(404).json({ error: 'Room not found' })
      }
      return res.json(enrichLocalRoomForClient(record))
    }
    if (!JSONBIN_KEY) {
      return res.status(503).json({ error: 'Room API not configured' })
    }
    let raw
    try {
      raw = await jsonBinGetRecord(JSONBIN_KEY, req.params.id)
    } catch (e) {
      return res.status(502).json({ error: e.message })
    }
    if (raw == null) {
      return res.status(404).json({ error: 'Room not found' })
    }
    return res.json(enrichLocalRoomForClient(normalizeRoomRecord(raw)))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

app.put('/api/rooms/:id', async (req, res) => {
  try {
    if (roomsBackend() === 'local') {
      const body =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? req.body
          : { roomName: 'Loft', movies: [] }
      const record = putLocalRoom(req.params.id, body)
      if (!record) {
        return res.status(404).json({ error: 'Room not found' })
      }
      return res.json(enrichLocalRoomForClient(record))
    }
    if (!JSONBIN_KEY) {
      return res.status(503).json({ error: 'Room API not configured' })
    }
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : { roomName: 'Loft', movies: [] }
    let existingRaw
    try {
      existingRaw = await jsonBinGetRecord(JSONBIN_KEY, req.params.id)
    } catch (e) {
      return res.status(502).json({ error: e.message })
    }
    if (existingRaw == null) {
      return res.status(404).json({ error: 'Room not found' })
    }
    const next = mergeClientPutIntoRecord(existingRaw, body)
    let saved
    try {
      saved = await jsonBinPutRecord(JSONBIN_KEY, req.params.id, next)
    } catch (e) {
      return res.status(502).json({ error: e.message })
    }
    return res.json(enrichLocalRoomForClient(normalizeRoomRecord(saved)))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

app.get('/api/rooms/:id/share-options', requireAuth, async (req, res) => {
  const roomId = req.params.id
  if (!isValidRoomId(roomId)) {
    return res.status(400).json({ error: 'Invalid room id' })
  }
  let record
  try {
    if (roomsBackend() === 'local') {
      record = getLocalRoom(roomId)
    } else {
      if (!JSONBIN_KEY) {
        return res.status(503).json({ error: 'Room API not configured' })
      }
      const raw = await jsonBinGetRecord(JSONBIN_KEY, roomId)
      record = raw != null ? normalizeRoomRecord(raw) : null
    }
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
  if (!record) return res.status(404).json({ error: 'Room not found' })
  if (!record.ownerUserId) {
    return res.status(403).json({
      error:
        'This room has no owner. Create a new room while logged in to share with friends.',
    })
  }
  if (record.ownerUserId !== req.userId) {
    return res.status(403).json({ error: 'Only the room owner can manage sharing' })
  }
  const db = loadStore()
  const friendIds = new Set()
  for (const f of db.friendships) {
    if (f.a === req.userId) friendIds.add(f.b)
    else if (f.b === req.userId) friendIds.add(f.a)
  }
  const userById = Object.fromEntries(db.users.map((u) => [u.id, u]))
  const friends = [...friendIds].map((fid) => ({
    userId: fid,
    username: userById[fid]?.username,
    displayName: userById[fid]?.displayName,
  }))
  const sharedUsers = (record.sharedUserIds || []).map((fid) => ({
    userId: fid,
    username: userById[fid]?.username,
    displayName: userById[fid]?.displayName,
  }))
  return res.json({ friends, sharedUsers })
})

app.post('/api/rooms/:id/share', requireAuth, async (req, res) => {
  const roomId = req.params.id
  if (!isValidRoomId(roomId)) {
    return res.status(400).json({ error: 'Invalid room id' })
  }
  const vu = validateStrictUsername(req.body?.username)
  if (!vu.ok) {
    return res.status(400).json({ error: vu.error })
  }
  let recordRaw
  try {
    if (roomsBackend() === 'local') {
      recordRaw = getLocalRoom(roomId)
    } else {
      if (!JSONBIN_KEY) {
        return res.status(503).json({ error: 'Room API not configured' })
      }
      recordRaw = await jsonBinGetRecord(JSONBIN_KEY, roomId)
    }
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
  const record = recordRaw != null ? normalizeRoomRecord(recordRaw) : null
  if (!record) return res.status(404).json({ error: 'Room not found' })
  if (!record.ownerUserId || record.ownerUserId !== req.userId) {
    return res.status(403).json({ error: 'Only the room owner can share' })
  }
  const db = loadStore()
  const target = db.users.find((u) => u.username === vu.username)
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.id === record.ownerUserId) {
    return res.status(400).json({ error: 'Owner already has the room' })
  }
  if (roomsBackend() === 'local') {
    addLocalRoomShare(roomId, target.id)
  } else {
    const next = recordWithShareAdded(recordRaw, target.id)
    try {
      await jsonBinPutRecord(JSONBIN_KEY, roomId, next)
    } catch (e) {
      return res.status(502).json({ error: e.message })
    }
  }
  touchUserSavedRoom(db, target.id, roomId, record.roomName)
  saveStore(db)
  return res.json({ ok: true })
})

app.delete('/api/rooms/:id/share/:targetUserId', requireAuth, async (req, res) => {
  const roomId = req.params.id
  const targetUserId = String(req.params.targetUserId || '')
  if (!isValidRoomId(roomId)) {
    return res.status(400).json({ error: 'Invalid room id' })
  }
  let recordRaw
  try {
    if (roomsBackend() === 'local') {
      recordRaw = getLocalRoom(roomId)
    } else {
      if (!JSONBIN_KEY) {
        return res.status(503).json({ error: 'Room API not configured' })
      }
      recordRaw = await jsonBinGetRecord(JSONBIN_KEY, roomId)
    }
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
  const record = recordRaw != null ? normalizeRoomRecord(recordRaw) : null
  if (!record) return res.status(404).json({ error: 'Room not found' })
  if (!record.ownerUserId || record.ownerUserId !== req.userId) {
    return res.status(403).json({ error: 'Only the room owner can manage sharing' })
  }
  if (!targetUserId) {
    return res.status(400).json({ error: 'Invalid user' })
  }
  if (roomsBackend() === 'local') {
    removeLocalRoomShare(roomId, targetUserId)
  } else {
    const next = recordWithShareRemoved(recordRaw, targetUserId)
    if (!next) {
      return res.status(400).json({ error: 'Invalid user' })
    }
    try {
      await jsonBinPutRecord(JSONBIN_KEY, roomId, next)
    } catch (e) {
      return res.status(502).json({ error: e.message })
    }
  }
  const db = loadStore()
  removeUserSavedRoom(db, targetUserId, roomId)
  saveStore(db)
  return res.json({ ok: true })
})

app.patch('/api/rooms/:roomId/reviews/:imdbID', requireAuth, async (req, res) => {
  const roomId = req.params.roomId
  const imdbID = decodeURIComponent(req.params.imdbID || '')
  if (!isValidRoomId(roomId) || !imdbID) {
    return res.status(400).json({ error: 'Invalid room or title' })
  }
  if (roomsBackend() === 'local') {
    const record = getLocalRoom(roomId)
    if (!record) return res.status(404).json({ error: 'Room not found' })
    const next = patchLocalRoomReview(roomId, imdbID, req.userId, {
      rating: req.body?.rating,
      text: req.body?.text,
    })
    if (!next) {
      return res.status(400).json({ error: 'That title is not in this room' })
    }
    return res.json(enrichLocalRoomForClient(next))
  }
  if (!JSONBIN_KEY) {
    return res.status(503).json({ error: 'Room API not configured' })
  }
  let recordRaw
  try {
    recordRaw = await jsonBinGetRecord(JSONBIN_KEY, roomId)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
  if (recordRaw == null) return res.status(404).json({ error: 'Room not found' })
  const next = recordWithReviewPatch(recordRaw, imdbID, req.userId, {
    rating: req.body?.rating,
    text: req.body?.text,
  })
  if (!next) {
    return res.status(400).json({ error: 'That title is not in this room' })
  }
  let saved
  try {
    saved = await jsonBinPutRecord(JSONBIN_KEY, roomId, next)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
  return res.json(enrichLocalRoomForClient(normalizeRoomRecord(saved)))
})

app.delete('/api/rooms/:roomId/reviews/:imdbID', requireAuth, async (req, res) => {
  const roomId = req.params.roomId
  const imdbID = decodeURIComponent(req.params.imdbID || '')
  if (!isValidRoomId(roomId) || !imdbID) {
    return res.status(400).json({ error: 'Invalid room or title' })
  }
  if (roomsBackend() === 'local') {
    const record = getLocalRoom(roomId)
    if (!record) return res.status(404).json({ error: 'Room not found' })
    const next = deleteLocalRoomReview(roomId, imdbID, req.userId)
    return res.json(enrichLocalRoomForClient(next))
  }
  if (!JSONBIN_KEY) {
    return res.status(503).json({ error: 'Room API not configured' })
  }
  let recordRaw
  try {
    recordRaw = await jsonBinGetRecord(JSONBIN_KEY, roomId)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
  if (recordRaw == null) return res.status(404).json({ error: 'Room not found' })
  const next = recordWithReviewDelete(recordRaw, imdbID, req.userId)
  let saved
  try {
    saved = await jsonBinPutRecord(JSONBIN_KEY, roomId, next)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
  return res.json(enrichLocalRoomForClient(normalizeRoomRecord(saved)))
})

/* ---------- Auth ---------- */
app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password || '')
  const vu = validateStrictUsername(req.body?.username)
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  if (!vu.ok) {
    return res.status(400).json({ error: vu.error })
  }
  const usernameRaw = vu.username
  const db = loadStore()
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' })
  }
  if (db.users.some((u) => u.username === usernameRaw)) {
    return res.status(409).json({ error: 'Username taken' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = {
    id: randomUUID(),
    email,
    username: usernameRaw,
    passwordHash,
    displayName: usernameRaw,
    avatarUrl: '',
    watched: [],
    savedRooms: [],
    onboardingComplete: false,
  }
  db.users.push(user)
  saveStore(db)
  const token = issueToken(user)
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      onboardingComplete: clientOnboardingComplete(user),
    },
  })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password || '')
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  const db = loadStore()
  const user = db.users.find((u) => u.email === email)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const token = issueToken(user)
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      onboardingComplete: clientOnboardingComplete(user),
    },
  })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    onboardingComplete: clientOnboardingComplete(user),
  })
})

app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  let usernameChanged = false
  if (req.body?.username !== undefined) {
    const vu = validateStrictUsername(req.body.username)
    if (!vu.ok) {
      return res.status(400).json({ error: vu.error })
    }
    if (vu.username !== user.username) {
      if (db.users.some((u) => u.username === vu.username)) {
        return res.status(409).json({ error: 'Username taken' })
      }
      user.username = vu.username
      usernameChanged = true
    }
  }
  if (typeof req.body?.displayName === 'string') {
    user.displayName = req.body.displayName.trim().slice(0, 80) || user.username
  }
  if (typeof req.body?.avatarUrl === 'string') {
    user.avatarUrl = req.body.avatarUrl.trim().slice(0, 500)
  }
  if (req.body?.onboardingComplete === true) {
    user.onboardingComplete = true
  }
  saveStore(db)
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    onboardingComplete: clientOnboardingComplete(user),
  }
  if (usernameChanged) {
    return res.json({ ...payload, token: issueToken(user) })
  }
  return res.json(payload)
})

app.post(
  '/api/auth/avatar',
  requireAuth,
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Image must be 2 MB or smaller' })
        }
        return res.status(400).json({ error: String(err.message || 'Upload failed') })
      }
      next()
    })
  },
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file' })
    }
    const userId = req.userId
    const saved = req.file.filename
    try {
      for (const name of readdirSync(AVATAR_DIR)) {
        if (name.startsWith(`${userId}.`) && name !== saved) {
          unlinkSync(join(AVATAR_DIR, name))
        }
      }
    } catch {
      /* ignore */
    }
    const db = loadStore()
    const user = db.users.find((u) => u.id === userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const avatarUrl = `/api/avatars/${saved}`
    user.avatarUrl = avatarUrl
    saveStore(db)
    return res.json({
      avatarUrl,
      displayName: user.displayName,
      username: user.username,
    })
  }
)

const PROFILE_WATCHED_CAP = 500

function normalizeWatchedRow(x) {
  return {
    imdbID: String(x.imdbID || ''),
    title: String(x.title || ''),
    type: String(x.type || ''),
    poster: String(x.poster || ''),
    completed: Boolean(x.completed),
  }
}

/**
 * Merge room sync into profile watched: upsert by imdbID, keep titles from other lofts.
 * If over cap, keep this payload’s titles first (in order), then fill from the rest.
 */
function mergeProfileWatched(existing, incomingRaw) {
  const incoming = incomingRaw
    .slice(0, PROFILE_WATCHED_CAP)
    .map(normalizeWatchedRow)
    .filter((row) => row.imdbID)

  const map = new Map()
  for (const x of existing || []) {
    const n = normalizeWatchedRow(x)
    if (n.imdbID) map.set(n.imdbID, n)
  }
  for (const x of incoming) {
    map.set(x.imdbID, x)
  }

  if (map.size <= PROFILE_WATCHED_CAP) {
    return [...map.values()]
  }

  const out = []
  const seen = new Set()
  for (const x of incoming) {
    if (out.length >= PROFILE_WATCHED_CAP) break
    if (!seen.has(x.imdbID)) {
      out.push(map.get(x.imdbID))
      seen.add(x.imdbID)
    }
  }
  for (const x of map.values()) {
    if (out.length >= PROFILE_WATCHED_CAP) break
    if (!seen.has(x.imdbID)) {
      out.push(x)
      seen.add(x.imdbID)
    }
  }
  return out
}

app.get('/api/auth/watched', requireAuth, (req, res) => {
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json({ items: user.watched || [] })
})

app.put('/api/auth/watched', requireAuth, (req, res) => {
  const items = req.body?.items
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array required' })
  }
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  user.watched = mergeProfileWatched(user.watched || [], items)
  saveStore(db)
  return res.json({ ok: true, count: user.watched.length })
})

app.get('/api/auth/rooms', requireAuth, async (req, res) => {
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const list = sortSavedRoomsDesc(userSavedRooms(user))
  const backend = roomsBackend()
  const rooms = await Promise.all(
    list.map(async (r) => {
      let role = 'link'
      try {
        if (backend === 'local') {
          const rec = getLocalRoom(r.id)
          if (rec) role = roomRoleForUser(rec, req.userId)
        } else if (JSONBIN_KEY) {
          const raw = await jsonBinGetRecord(JSONBIN_KEY, r.id)
          if (raw) role = roomRoleForUser(normalizeRoomRecord(raw), req.userId)
        }
      } catch {
        /* keep link */
      }
      return {
        id: r.id,
        name: r.name || 'Loft',
        lastVisited: r.lastVisited || 0,
        role,
      }
    })
  )
  return res.json({ rooms })
})

app.post('/api/auth/rooms', requireAuth, (req, res) => {
  const id = String(req.body?.id || '')
  if (!isValidRoomId(id)) {
    return res.status(400).json({ error: 'Invalid room id' })
  }
  const name = String(req.body?.name || 'Loft').trim().slice(0, 80) || 'Loft'
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const list = userSavedRooms(user)
  const now = Date.now()
  const idx = list.findIndex((r) => r.id === id)
  const entry = { id, name, lastVisited: now }
  if (idx >= 0) {
    list[idx] = entry
  } else {
    list.push(entry)
  }
  const sorted = sortSavedRoomsDesc(list)
  user.savedRooms = sorted.slice(0, MAX_SAVED_ROOMS)
  saveStore(db)
  return res.json({ ok: true })
})

app.delete('/api/auth/rooms/:id', requireAuth, (req, res) => {
  const id = String(req.params.id || '')
  if (!isValidRoomId(id)) {
    return res.status(400).json({ error: 'Invalid room id' })
  }
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  user.savedRooms = userSavedRooms(user).filter((r) => r.id !== id)
  saveStore(db)
  return res.json({ ok: true })
})

/* ---------- Friends ---------- */
app.post('/api/friends/request', requireAuth, (req, res) => {
  const vu = validateStrictUsername(req.body?.username)
  if (!vu.ok) {
    return res.status(400).json({ error: vu.error })
  }
  const db = loadStore()
  const from = db.users.find((u) => u.id === req.userId)
  const to = db.users.find((u) => u.username === vu.username)
  if (!to) return res.status(404).json({ error: 'User not found' })
  if (to.id === from.id) return res.status(400).json({ error: 'Cannot friend yourself' })
  const exists = db.friendRequests.find(
    (r) =>
      r.status === 'pending' &&
      ((r.fromUserId === from.id && r.toUserId === to.id) ||
        (r.fromUserId === to.id && r.toUserId === from.id))
  )
  if (exists) return res.status(409).json({ error: 'Request already pending' })
  const friends = db.friendships.some(
    (f) =>
      (f.a === from.id && f.b === to.id) || (f.a === to.id && f.b === from.id)
  )
  if (friends) return res.status(409).json({ error: 'Already friends' })
  const fr = {
    id: randomUUID(),
    fromUserId: from.id,
    toUserId: to.id,
    status: 'pending',
  }
  db.friendRequests.push(fr)
  saveStore(db)
  return res.json({ id: fr.id })
})

app.post('/api/friends/respond', requireAuth, (req, res) => {
  const { requestId, accept } = req.body || {}
  if (!requestId) return res.status(400).json({ error: 'requestId required' })
  const db = loadStore()
  const fr = db.friendRequests.find((r) => r.id === requestId)
  if (!fr || fr.status !== 'pending') {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (fr.toUserId !== req.userId) {
    return res.status(403).json({ error: 'Not your request' })
  }
  if (accept) {
    fr.status = 'accepted'
    db.friendships.push({ a: fr.fromUserId, b: fr.toUserId })
  } else {
    fr.status = 'rejected'
  }
  saveStore(db)
  return res.json({ ok: true })
})

app.get('/api/friends', requireAuth, (req, res) => {
  const db = loadStore()
  const uid = req.userId
  const incoming = db.friendRequests.filter(
    (r) => r.toUserId === uid && r.status === 'pending'
  )
  const outgoing = db.friendRequests.filter(
    (r) => r.fromUserId === uid && r.status === 'pending'
  )
  const friendIds = new Set()
  for (const f of db.friendships) {
    if (f.a === uid) friendIds.add(f.b)
    else if (f.b === uid) friendIds.add(f.a)
  }
  const userById = Object.fromEntries(db.users.map((u) => [u.id, u]))
  return res.json({
    friends: [...friendIds].map((id) => ({
      userId: id,
      username: userById[id]?.username,
      displayName: userById[id]?.displayName,
      avatarUrl: userById[id]?.avatarUrl,
    })),
    incoming: incoming.map((r) => ({
      id: r.id,
      from: userById[r.fromUserId]?.username,
      displayName: userById[r.fromUserId]?.displayName,
    })),
    outgoing: outgoing.map((r) => ({
      id: r.id,
      to: userById[r.toUserId]?.username,
    })),
  })
})

/* ---------- Public profile ---------- */
app.get('/api/users/:username', (req, res) => {
  const un = normalizeUsername(req.params.username)
  const db = loadStore()
  const user = db.users.find((u) => u.username === un)
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json({
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  })
})

app.get('/api/users/:username/watched', (req, res) => {
  const un = normalizeUsername(req.params.username)
  const db = loadStore()
  const user = db.users.find((u) => u.username === un)
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json({ items: user.watched || [] })
})

const TMDB_BASE = 'https://api.themoviedb.org/3'

async function tmdbApiGet(path, bearer, apiKey) {
  const headers = {}
  let url = `${TMDB_BASE}${path.startsWith('/') ? path : `/${path}`}`
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`
  } else if (apiKey) {
    url += `${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(apiKey)}`
  } else {
    return { ok: false, error: 'TMDB not configured', data: null }
  }
  const res = await fetch(url, { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      error: data?.status_message || `HTTP ${res.status}`,
      data: null,
    }
  }
  return { ok: true, data, error: null }
}

function shuffleCopy(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** OMDB on the server (no TMDB account needed). */
function getOmdbServerKey() {
  return process.env.OMDB_API_KEY || process.env.VITE_OMDB_KEY || ''
}

async function fetchOmdbSearchList(apiKey, query) {
  const q = String(query || '').trim().slice(0, 48)
  if (!q) return []
  const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(apiKey)}&s=${encodeURIComponent(q)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (data.Response === 'False' || !Array.isArray(data.Search)) return []
  return data.Search
}

/**
 * Genre + title-keyword OMDB searches (weaker than TMDB similar/recommendations,
 * but works with the same OMDB key many apps already use).
 */
async function buildOmdbRecommendationsPayload(record, inRoom) {
  const apiKey = getOmdbServerKey()
  if (!apiKey) return null

  const movies = record.movies || []
  const seen = new Set(inRoom)
  const items = []

  function tryAddHit(h, label) {
    const id = h.imdbID
    if (!id || seen.has(id)) return false
    seen.add(id)
    items.push({
      imdbID: id,
      title: h.Title || id,
      poster: h.Poster && h.Poster !== 'N/A' ? h.Poster : '',
      year: h.Year || '',
      sourceLabel: label,
    })
    return true
  }

  const genreCounts = new Map()
  for (const m of movies) {
    for (const g of String(m.genre || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1)
    }
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g)
    .slice(0, 4)

  for (const g of topGenres) {
    if (items.length >= 18) break
    const query = g.includes('&') ? g.split('&')[0].trim() : g
    const hits = await fetchOmdbSearchList(apiKey, query)
    for (const h of hits) {
      if (items.length >= 18) break
      tryAddHit(h, `OMDB · ${g}`)
    }
  }

  for (const m of shuffleCopy(movies).slice(0, 4)) {
    if (items.length >= 18) break
    const words = String(m.title || '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
    const q = words.slice(0, 2).join(' ')
    if (!q) continue
    const hits = await fetchOmdbSearchList(apiKey, q)
    for (const h of hits) {
      if (items.length >= 18) break
      tryAddHit(h, `OMDB · like “${q}”`)
    }
  }

  return {
    items,
    source: 'omdb',
    message:
      items.length === 0
        ? 'No OMDB matches yet—add titles with genres, or configure TMDB on the server for smarter suggestions.'
        : undefined,
  }
}

/** Room shelf for recommendations — same sources as GET /api/rooms/:id/latest. */
async function loadRoomRecordForRecommendations(roomId) {
  if (roomsBackend() === 'local') {
    return getLocalRoom(roomId)
  }
  if (!JSONBIN_KEY) return null
  const raw = await jsonBinGetRecord(JSONBIN_KEY, roomId)
  return raw != null ? normalizeRoomRecord(raw) : null
}

app.get('/api/rooms/:id/recommendations', async (req, res) => {
  const roomId = req.params.id
  if (!isValidRoomId(roomId)) {
    return res.status(400).json({ error: 'Invalid room id' })
  }
  let record
  try {
    record = await loadRoomRecordForRecommendations(roomId)
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Failed to load room for suggestions' })
  }
  if (!record) {
    return res.status(404).json({ error: 'Room not found' })
  }
  const movies = record.movies || []
  if (movies.length === 0) {
    return res.json({
      items: [],
      message: 'Add a few titles to get suggestions.',
    })
  }

  const inRoom = new Set(movies.map((m) => m.imdbID).filter(Boolean))
  const cacheKeyBase = `${roomId}:${[...inRoom].sort().join(',')}`
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN
  const tmdbKey = process.env.TMDB_API_KEY
  const useTmdb = Boolean(bearer || tmdbKey)

  if (useTmdb) {
    const cacheKey = `tmdb:${cacheKeyBase}`
    const hit = recoCache.get(cacheKey)
    if (hit && Date.now() - hit.at < RECO_CACHE_MS) {
      return res.json(hit.payload)
    }

    const seeds = shuffleCopy(movies).slice(0, 5)
    const scores = new Map()

    function bump(list, weight, seedTitle, mediaType) {
      for (const x of list || []) {
        if (!x?.id) continue
        const k = `${mediaType}:${x.id}`
        const cur = scores.get(k) || {
          score: 0,
          mediaType,
          tmdbId: x.id,
          seedTitle,
          title: x.title || x.name || '',
          poster_path: x.poster_path || null,
        }
        cur.score += weight
        if (weight >= 2) cur.seedTitle = seedTitle
        if (!cur.title) cur.title = x.title || x.name || ''
        if (!cur.poster_path && x.poster_path) cur.poster_path = x.poster_path
        scores.set(k, cur)
      }
    }

    for (const m of seeds) {
      const imdb = m.imdbID
      if (!imdb) continue
      const findR = await tmdbApiGet(
        `/find/${encodeURIComponent(imdb)}?external_source=imdb_id`,
        bearer,
        tmdbKey
      )
      if (!findR.ok) continue
      const movieR = findR.data?.movie_results?.[0]
      const tvR = findR.data?.tv_results?.[0]
      const seedTitle = m.title || imdb
      if (movieR?.id) {
        const [reco, sim] = await Promise.all([
          tmdbApiGet(`/movie/${movieR.id}/recommendations`, bearer, tmdbKey),
          tmdbApiGet(`/movie/${movieR.id}/similar`, bearer, tmdbKey),
        ])
        if (reco.ok) bump(reco.data?.results, 2, seedTitle, 'movie')
        if (sim.ok) bump(sim.data?.results, 1, seedTitle, 'movie')
      } else if (tvR?.id) {
        const [reco, sim] = await Promise.all([
          tmdbApiGet(`/tv/${tvR.id}/recommendations`, bearer, tmdbKey),
          tmdbApiGet(`/tv/${tvR.id}/similar`, bearer, tmdbKey),
        ])
        if (reco.ok) bump(reco.data?.results, 2, seedTitle, 'tv')
        if (sim.ok) bump(sim.data?.results, 1, seedTitle, 'tv')
      }
    }

    const sorted = [...scores.values()].sort((a, b) => b.score - a.score)
    const items = []
    const seenImdb = new Set(inRoom)

    for (const row of sorted) {
      if (items.length >= 18) break
      const extR = await tmdbApiGet(
        `/${row.mediaType}/${row.tmdbId}/external_ids`,
        bearer,
        tmdbKey
      )
      if (!extR.ok) continue
      const imdb = extR.data?.imdb_id
      if (!imdb || seenImdb.has(imdb)) continue
      seenImdb.add(imdb)
      const poster = row.poster_path
        ? `https://image.tmdb.org/t/p/w185${row.poster_path}`
        : ''
      items.push({
        imdbID: imdb,
        title: row.title || imdb,
        poster,
        year: '',
        score: row.score,
        sourceLabel: row.seedTitle ? `Because you have “${row.seedTitle}”` : '',
      })
    }

    const payload = { items, source: 'tmdb' }
    recoCache.set(cacheKey, { at: Date.now(), payload })
    return res.json(payload)
  }

  const omdbKey = getOmdbServerKey()
  if (!omdbKey) {
    return res.status(503).json({
      error:
        'No suggestion API configured. Add OMDB_API_KEY (or VITE_OMDB_KEY) to the server .env for OMDB search picks, or TMDB_READ_ACCESS_TOKEN / TMDB_API_KEY for richer TMDB suggestions.',
    })
  }

  const cacheKey = `omdb:${cacheKeyBase}`
  const hit = recoCache.get(cacheKey)
  if (hit && Date.now() - hit.at < RECO_CACHE_MS) {
    return res.json(hit.payload)
  }

  const payload = await buildOmdbRecommendationsPayload(record, inRoom)
  recoCache.set(cacheKey, { at: Date.now(), payload })
  return res.json(payload)
})

const WM_TYPE_ORDER = { sub: 0, free: 1, rent: 2, buy: 3, tve: 4 }

async function fetchWatchmodeProviders(imdbId, region) {
  const wmKey = process.env.WATCHMODE_API_KEY
  if (!wmKey) {
    return { providers: [] }
  }
  const client = new WatchmodeClient({ apiKey: wmKey })
  try {
    const { data, error } = await client.title.getDetails(imdbId, {
      appendToResponse: 'sources',
      regions: region,
    })
    if (error) {
      return {
        providers: [],
        watchmodeError: `${error.statusCode ?? ''} ${error.statusMessage ?? ''}`.trim(),
      }
    }
    let list = data?.sources
    if (!list?.length && data?.id != null) {
      const src = await client.title.getSources(String(data.id), { regions: region })
      if (src.error) {
        return {
          providers: [],
          watchmodeError: `${src.error.statusCode ?? ''} ${src.error.statusMessage ?? ''}`.trim(),
        }
      }
      list = src.data
    }
    if (!list?.length) {
      return { providers: [] }
    }
    const r = region.toUpperCase()
    let filtered = list.filter(
      (s) => !s.region || String(s.region).toUpperCase() === r
    )
    if (!filtered.length) {
      filtered = list
    }
    const sorted = [...filtered].sort(
      (a, b) =>
        (WM_TYPE_ORDER[a.type] ?? 9) - (WM_TYPE_ORDER[b.type] ?? 9)
    )
    const seen = new Set()
    const merged = []
    for (const s of sorted) {
      const sid = s.source_id
      if (sid == null || seen.has(sid)) continue
      seen.add(sid)
      merged.push({
        name: s.name || 'Provider',
        logoPath: null,
        type: s.type || 'sub',
      })
      if (merged.length >= 12) break
    }
    return { providers: merged }
  } catch (e) {
    return { providers: [], watchmodeError: e.message }
  }
}

async function fetchTmdbProviders(imdbId, region, bearer, apiKey) {
  const headers = {}
  let findUrl = `${TMDB_BASE}/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`
  } else {
    findUrl += `&api_key=${encodeURIComponent(apiKey)}`
  }

  const findRes = await fetch(findUrl, { headers })
  const findData = await findRes.json().catch(() => ({}))
  if (!findRes.ok) {
    return { providers: [], tmdbError: findData?.status_message || 'find failed' }
  }

  const movie = findData?.movie_results?.[0]
  const tv = findData?.tv_results?.[0]
  let mediaType
  let mediaId
  if (movie?.id) {
    mediaType = 'movie'
    mediaId = movie.id
  } else if (tv?.id) {
    mediaType = 'tv'
    mediaId = tv.id
  } else {
    return { providers: [] }
  }

  let provUrl = `${TMDB_BASE}/${mediaType}/${mediaId}/watch/providers`
  if (!bearer) {
    provUrl += `?api_key=${encodeURIComponent(apiKey)}`
  }
  const provRes = await fetch(provUrl, { headers })
  const provData = await provRes.json().catch(() => ({}))
  if (!provRes.ok) {
    return { providers: [], tmdbError: provData?.status_message || 'providers failed' }
  }

  const bucket = provData?.results?.[region] || provData?.results?.US || {}
  const seen = new Set()
  const merged = []
  function pushList(list, kind) {
    for (const p of list || []) {
      if (!p?.provider_id || seen.has(p.provider_id)) continue
      seen.add(p.provider_id)
      merged.push({
        name: p.provider_name || 'Provider',
        logoPath: p.logo_path
          ? `https://image.tmdb.org/t/p/w45${p.logo_path}`
          : null,
        type: kind,
      })
    }
  }
  pushList(bucket.flatrate, 'sub')
  pushList(bucket.rent, 'rent')
  pushList(bucket.buy, 'buy')

  return { providers: merged.slice(0, 12) }
}

/**
 * Streaming providers: Watchmode (recommended) or TMDB fallback.
 * Region: WATCH_REGION or TMDB_REGION (default US).
 */
app.get('/api/streaming/:imdbId', async (req, res) => {
  const raw = String(req.params.imdbId || '').replace(/^\/+/, '')
  const imdbId = raw.startsWith('tt') ? raw : `tt${raw}`
  const region = String(
    process.env.WATCH_REGION || process.env.TMDB_REGION || 'US'
  )
    .toUpperCase()
    .slice(0, 4)

  const out = { providers: [] }

  const wm = await fetchWatchmodeProviders(imdbId, region)
  if (wm.watchmodeError) {
    out.watchmodeError = wm.watchmodeError
  }
  if (wm.providers.length > 0) {
    out.providers = wm.providers
    return res.json(out)
  }

  const bearer = process.env.TMDB_READ_ACCESS_TOKEN
  const tmdbKey = process.env.TMDB_API_KEY
  if (!bearer && !tmdbKey) {
    return res.json(out)
  }

  try {
    const tmdb = await fetchTmdbProviders(imdbId, region, bearer, tmdbKey)
    if (tmdb.tmdbError) {
      out.tmdbError = tmdb.tmdbError
    }
    if (tmdb.providers.length > 0) {
      out.providers = tmdb.providers
    }
  } catch (e) {
    out.tmdbError = e.message
  }
  return res.json(out)
})

app.listen(PORT, () => {
  const parts = []
  if (process.env.WATCHMODE_API_KEY) parts.push('watchmode')
  if (process.env.TMDB_READ_ACCESS_TOKEN) parts.push('tmdb-bearer')
  else if (process.env.TMDB_API_KEY) parts.push('tmdb-key')
  const streaming = parts.length ? parts.join('+') : 'off'
  const rooms = roomsBackend()
  console.log(
    `Loft API http://localhost:${PORT} (rooms: ${rooms}, streaming: ${streaming}, data: ${loftDataDir()})`
  )
})
