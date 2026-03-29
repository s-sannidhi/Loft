const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3/b'
const OMDB_BASE_URL = 'https://www.omdbapi.com/'

function getEnv(name) {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function getEnvOptional(name) {
  return import.meta.env[name] || ''
}

function apiUrl(path) {
  const base = getEnvOptional('VITE_API_URL')
  return base ? `${base.replace(/\/$/, '')}${path}` : path
}

function getJsonBinHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': getEnv('VITE_JSONBIN_KEY'),
  }
}

async function parseJsonOrThrow(response, fallbackMessage) {
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
      data?.Error ||
      (text && text.length < 200 ? text : null) ||
      `${fallbackMessage} (${response.status})`
    throw new Error(message)
  }
  return data
}

async function tryServerRoom(method, path, body) {
  const opts = { method }
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  return fetch(apiUrl(path), opts)
}

function canDirectJsonBin() {
  try {
    return Boolean(import.meta.env.VITE_JSONBIN_KEY)
  } catch {
    return false
  }
}

export async function createRoom() {
  const payload = { roomName: 'Loft', movies: [] }
  const serverRes = await tryServerRoom('POST', '/api/rooms', payload)
  if (serverRes.ok) {
    const data = await serverRes.json()
    if (data?.id) return data.id
  }
  if (canDirectJsonBin()) {
    const response = await fetch(JSONBIN_BASE_URL, {
      method: 'POST',
      headers: getJsonBinHeaders(),
      body: JSON.stringify(payload),
    })
    const data = await parseJsonOrThrow(response, 'Failed to create room')
    return data?.metadata?.id
  }
  const t = await serverRes.text()
  throw new Error(
    t || 'Room API unavailable. Run the Loft server or set VITE_JSONBIN_KEY for direct mode.'
  )
}

export async function getRoom(roomId) {
  const serverRes = await tryServerRoom('GET', `/api/rooms/${roomId}/latest`)
  if (serverRes.ok) {
    return serverRes.json()
  }
  if (canDirectJsonBin()) {
    const response = await fetch(`${JSONBIN_BASE_URL}/${roomId}/latest`, {
      headers: getJsonBinHeaders(),
    })
    const data = await parseJsonOrThrow(response, 'Failed to load room')
    return data?.record
  }
  throw new Error('Room API unavailable')
}

export async function updateRoom(roomId, roomData) {
  const serverRes = await tryServerRoom('PUT', `/api/rooms/${roomId}`, roomData)
  if (serverRes.ok) {
    return serverRes.json()
  }
  if (canDirectJsonBin()) {
    const response = await fetch(`${JSONBIN_BASE_URL}/${roomId}`, {
      method: 'PUT',
      headers: getJsonBinHeaders(),
      body: JSON.stringify(roomData),
    })
    const data = await parseJsonOrThrow(response, 'Failed to save room')
    return data?.record
  }
  throw new Error('Room API unavailable')
}

function normalizeOmdbMovie(movie) {
  return {
    imdbID: movie.imdbID,
    title: movie.Title,
    year: movie.Year,
    type: movie.Type,
    poster: movie.Poster,
  }
}

export async function searchMovies(query) {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }
  const key = getEnv('VITE_OMDB_KEY')
  const response = await fetch(
    `${OMDB_BASE_URL}?s=${encodeURIComponent(trimmed)}&apikey=${key}`
  )
  const data = await parseJsonOrThrow(response, 'Search failed')
  if (data?.Response === 'False') {
    return []
  }
  return (data?.Search || []).map(normalizeOmdbMovie)
}

export async function getSeasonEpisodes(seriesImdbID, season) {
  const key = getEnv('VITE_OMDB_KEY')
  const response = await fetch(
    `${OMDB_BASE_URL}?i=${encodeURIComponent(seriesImdbID)}&Season=${encodeURIComponent(
      season
    )}&apikey=${key}`
  )
  const data = await parseJsonOrThrow(response, 'Failed to load episodes')
  if (data?.Response === 'False') {
    return []
  }
  return (data?.Episodes || [])
    .map((ep) => ({
      episode: Number(ep.Episode) || 0,
      title: ep.Title || '',
      released: ep.Released || '',
      imdbID: ep.imdbID || '',
    }))
    .filter((ep) => ep.episode > 0)
}

/**
 * Where to watch — Loft server only (Watchmode and/or TMDB; avoids browser CORS).
 * Set WATCHMODE_API_KEY on the server (recommended), or TMDB_* as fallback.
 * @param {string} imdbId e.g. tt1234567
 * @returns {Promise<{ name: string, logoPath: string | null, type: string }[]>}
 */
export async function fetchWatchProvidersByImdb(imdbId) {
  const id = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`
  try {
    const res = await fetch(apiUrl(`/api/streaming/${encodeURIComponent(id)}`))
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      if (Array.isArray(data?.providers) && data.providers.length > 0) {
        return data.providers
      }
    }
  } catch {
    /* proxy unavailable */
  }
  return []
}

export async function getMovieDetails(imdbID) {
  const key = getEnv('VITE_OMDB_KEY')
  const response = await fetch(
    `${OMDB_BASE_URL}?i=${encodeURIComponent(imdbID)}&apikey=${key}`
  )
  const data = await parseJsonOrThrow(response, 'Failed to fetch movie details')
  if (data?.Response === 'False') {
    throw new Error(data?.Error || 'Unable to fetch details')
  }

  let watchProviders = []
  try {
    watchProviders = await fetchWatchProvidersByImdb(data.imdbID)
  } catch {
    watchProviders = []
  }

  const isSeries = data.Type === 'series'

  return {
    imdbID: data.imdbID,
    title: data.Title,
    year: data.Year,
    genre: data.Genre,
    type: data.Type,
    imdbRating: data.imdbRating,
    poster: data.Poster,
    totalSeasons: Number(data.totalSeasons) || null,
    watchProviders,
    progress: isSeries
      ? {
          currentSeason: 1,
          currentEpisode: 1,
          watchedEpisodes: [],
          completed: false,
        }
      : {
          completed: false,
        },
  }
}
