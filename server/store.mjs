import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { loftDataDir } from './dataDir.mjs'

const DATA_PATH = join(loftDataDir(), 'loft-db.json')

function defaultData() {
  return {
    users: [],
    friendRequests: [],
    friendships: [],
  }
}

export function loadStore() {
  try {
    const dir = dirname(DATA_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    if (!existsSync(DATA_PATH)) {
      const initial = defaultData()
      writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), 'utf8')
      return initial
    }
    const raw = readFileSync(DATA_PATH, 'utf8')
    return { ...defaultData(), ...JSON.parse(raw) }
  } catch {
    return defaultData()
  }
}

export function saveStore(data) {
  const dir = dirname(DATA_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}
