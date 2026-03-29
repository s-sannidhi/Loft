const TOKEN_KEY = 'loft_token'

export function apiPath(path) {
  const base = import.meta.env.VITE_API_URL || ''
  return base ? `${base.replace(/\/$/, '')}${path}` : path
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
    throw new Error(msg)
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

export async function updateProfile(body) {
  return socialFetch('/api/auth/profile', {
    method: 'PATCH',
    body,
  })
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
