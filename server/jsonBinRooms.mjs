const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b'

function binHeaders(masterKey) {
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': masterKey,
  }
}

async function parseJsonBinResponse(res, fallbackLabel) {
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      (text && text.length < 200 ? text : null) ||
      `${fallbackLabel} (${res.status})`
    throw new Error(message)
  }
  return data
}

/** Latest bin record (raw), or throws on network / API error. */
export async function jsonBinGetRecord(masterKey, roomId) {
  const res = await fetch(`${JSONBIN_BASE}/${roomId}/latest`, {
    headers: binHeaders(masterKey),
  })
  if (res.status === 404) {
    return null
  }
  const data = await parseJsonBinResponse(res, 'Failed to load room')
  return data?.record ?? null
}

/** Replace bin body; returns parsed API record field if present. */
export async function jsonBinPutRecord(masterKey, roomId, record) {
  const res = await fetch(`${JSONBIN_BASE}/${roomId}`, {
    method: 'PUT',
    headers: binHeaders(masterKey),
    body: JSON.stringify(record),
  })
  const data = await parseJsonBinResponse(res, 'Failed to save room')
  return data?.record ?? record
}
