/**
 * Retries Loft API fetches when the host is waking (Render free tier, etc.):
 * network errors and 502/503/504. Does not abort slow first responses — one long
 * cold start can still succeed without counting as failure.
 */
const DEFAULT_ATTEMPTS = 6
const DEFAULT_DELAY_MS = 3500

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetriableStatus(status) {
  return status === 502 || status === 503 || status === 504
}

function isRetriableError(err) {
  if (!err || typeof err !== 'object') return false
  if (err.name === 'TypeError') return true
  const msg = String(err.message || '')
  return /network|failed|load|fetch/i.test(msg)
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {{ attempts?: number, delayMs?: number }} [options]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, init = {}, options = {}) {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  let lastError

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, init)
      if (isRetriableStatus(res.status) && attempt < attempts - 1) {
        await sleep(delayMs)
        continue
      }
      return res
    } catch (e) {
      lastError = e
      if (isRetriableError(e) && attempt < attempts - 1) {
        await sleep(delayMs)
        continue
      }
      throw e
    }
  }
  throw lastError
}
