import { readLocalSavedRooms } from './localSavedRooms.js'

const TOKEN_KEY = 'loft_token'

export function apiPath(path) {
  const base = import.meta.env.VITE_API_URL || ''
  return base ? `${base.replace(/\/$/, '')}${path}` : path
}

/** Absolute URL for images served from the API (e.g. uploaded avatars). */
export function mediaUrl(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return ''
  const t = urlOrPath.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  const path = t.startsWith('/') ? t : `/${t}`
  return apiPath(path)
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function authHeaders() {
  const t = getStoredToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function socialFetch(path, options = {}) {
  const method = options.method || 'GET'
  const headers = {
    ...authHeaders(),
    ...options.headers,
  }
  let body = options.body
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(apiPath(path), { ...options, method, headers, body })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = data?.error || text || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

export async function signup(payload) {
  return socialFetch('/api/auth/signup', {
    method: 'POST',
    body: payload,
  })
}

export async function login(payload) {
  return socialFetch('/api/auth/login', {
    method: 'POST',
    body: payload,
  })
}

export async function fetchMe() {
  return socialFetch('/api/auth/me')
}

export async function fetchSavedRooms() {
  return socialFetch('/api/auth/rooms')
}

export async function postSavedRoom(body) {
  return socialFetch('/api/auth/rooms', {
    method: 'POST',
    body,
  })
}

export async function deleteSavedRoom(roomId) {
  return socialFetch(`/api/auth/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
  })
}

export async function mergeLocalSavedRoomsToServer() {
  const list = readLocalSavedRooms()
  if (!list.length || !getStoredToken()) return
  for (const r of list) {
    try {
      await postSavedRoom({ id: r.id, name: r.name })
    } catch {
      /* ignore */
    }
  }
}

export async function updateProfile(body) {
  return socialFetch('/api/auth/profile', {
    method: 'PATCH',
    body,
  })
}

export async function patchRoomReview(roomId, imdbID, body) {
  return socialFetch(
    `/api/rooms/${encodeURIComponent(roomId)}/reviews/${encodeURIComponent(imdbID)}`,
    { method: 'PATCH', body }
  )
}

export async function deleteRoomReview(roomId, imdbID) {
  return socialFetch(
    `/api/rooms/${encodeURIComponent(roomId)}/reviews/${encodeURIComponent(imdbID)}`,
    { method: 'DELETE' }
  )
}

export async function uploadAvatar(file) {
  const token = getStoredToken()
  if (!token) throw new Error('Not signed in')
  if (!file || !(file instanceof Blob)) throw new Error('Choose an image file')
  const form = new FormData()
  form.append('avatar', file)
  const res = await fetch(apiPath('/api/auth/avatar'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = data?.error || text || `Upload failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

export async function fetchMyWatched() {
  return socialFetch('/api/auth/watched')
}

export async function putWatched(items) {
  return socialFetch('/api/auth/watched', {
    method: 'PUT',
    body: { items },
  })
}

export async function fetchFriends() {
  return socialFetch('/api/friends')
}

export async function sendFriendRequest(username) {
  return socialFetch('/api/friends/request', {
    method: 'POST',
    body: { username },
  })
}

export async function respondFriendRequest(requestId, accept) {
  return socialFetch('/api/friends/respond', {
    method: 'POST',
    body: { requestId, accept },
  })
}

export async function fetchPublicProfile(username) {
  return socialFetch(`/api/users/${encodeURIComponent(username)}`)
}

export async function fetchPublicWatched(username) {
  return socialFetch(`/api/users/${encodeURIComponent(username)}/watched`)
}

export async function fetchRoomShareOptions(roomId) {
  return socialFetch(`/api/rooms/${encodeURIComponent(roomId)}/share-options`)
}

export async function addRoomShare(roomId, username) {
  return socialFetch(`/api/rooms/${encodeURIComponent(roomId)}/share`, {
    method: 'POST',
    body: { username },
  })
}

export async function removeRoomShare(roomId, targetUserId) {
  return socialFetch(
    `/api/rooms/${encodeURIComponent(roomId)}/share/${encodeURIComponent(targetUserId)}`,
    { method: 'DELETE' }
  )
}
