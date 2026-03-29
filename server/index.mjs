import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { WatchmodeClient } from '@watchmode/api-client'
import { loadStore, saveStore } from './store.mjs'

const PORT = Number(process.env.PORT) || 8787
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-change-me'
const JSONBIN_KEY = process.env.JSONBIN_KEY
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

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

/* ---------- JSONBin room proxy ---------- */
app.post('/api/rooms', async (req, res) => {
  try {
    if (!JSONBIN_KEY) {
      return res.status(503).json({ error: 'Room API not configured' })
    }
    const payload =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : { roomName: 'Loft', movies: [] }
    const response = await fetch(JSONBIN_BASE, {
      method: 'POST',
      headers: jsonBinHeaders(),
      body: JSON.stringify(payload),
    })
    const data = await parseJsonOrThrow(response, 'Failed to create room')
    return res.json({ id: data?.metadata?.id })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

app.get('/api/rooms/:id/latest', async (req, res) => {
  try {
    if (!JSONBIN_KEY) {
      return res.status(503).json({ error: 'Room API not configured' })
    }
    const response = await fetch(`${JSONBIN_BASE}/${req.params.id}/latest`, {
      headers: jsonBinHeaders(),
    })
    const data = await parseJsonOrThrow(response, 'Failed to load room')
    return res.json(data?.record)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

app.put('/api/rooms/:id', async (req, res) => {
  try {
    if (!JSONBIN_KEY) {
      return res.status(503).json({ error: 'Room API not configured' })
    }
    const response = await fetch(`${JSONBIN_BASE}/${req.params.id}`, {
      method: 'PUT',
      headers: jsonBinHeaders(),
      body: JSON.stringify(req.body),
    })
    const data = await parseJsonOrThrow(response, 'Failed to save room')
    return res.json(data?.record)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

/* ---------- Auth helpers ---------- */
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

/* ---------- Auth ---------- */
app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password || '')
  const usernameRaw = normalizeUsername(req.body?.username)
  if (!email || !password || usernameRaw.length < 2) {
    return res.status(400).json({ error: 'Email, password, and username (2+ chars) required' })
  }
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
  }
  db.users.push(user)
  saveStore(db)
  const token = jwt.sign(
    { sub: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
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
  const token = jwt.sign(
    { sub: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
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
  })
})

app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (typeof req.body?.displayName === 'string') {
    user.displayName = req.body.displayName.trim().slice(0, 80) || user.username
  }
  if (typeof req.body?.avatarUrl === 'string') {
    user.avatarUrl = req.body.avatarUrl.trim().slice(0, 500)
  }
  saveStore(db)
  return res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  })
})

app.put('/api/auth/watched', requireAuth, (req, res) => {
  const items = req.body?.items
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array required' })
  }
  const db = loadStore()
  const user = db.users.find((u) => u.id === req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  user.watched = items
    .slice(0, 500)
    .map((x) => ({
      imdbID: String(x.imdbID || ''),
      title: String(x.title || ''),
      type: String(x.type || ''),
      poster: String(x.poster || ''),
      completed: Boolean(x.completed),
    }))
    .filter((x) => x.imdbID)
  saveStore(db)
  return res.json({ ok: true, count: user.watched.length })
})

/* ---------- Friends ---------- */
app.post('/api/friends/request', requireAuth, (req, res) => {
  const toUsername = normalizeUsername(req.body?.username)
  if (toUsername.length < 2) {
    return res.status(400).json({ error: 'username required' })
  }
  const db = loadStore()
  const from = db.users.find((u) => u.id === req.userId)
  const to = db.users.find((u) => u.username === toUsername)
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
  console.log(`Loft API http://localhost:${PORT} (streaming: ${streaming})`)
})
