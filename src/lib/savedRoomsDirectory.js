import { touchLocalSavedRoom } from './localSavedRooms'
import { postSavedRoom } from './socialApi'

const lastApiTouch = { id: '', name: '' }

export function resetSavedRoomApiThrottle() {
  lastApiTouch.id = ''
  lastApiTouch.name = ''
}

/**
 * Remember this room on the device; if logged in, sync to the Loft API when id/name changes
 * (avoids spamming POST while the room polls for updates).
 */
export function touchSavedRoom(roomId, roomName, isLoggedIn) {
  const name =
    typeof roomName === 'string' && roomName.trim()
      ? roomName.trim().slice(0, 80)
      : 'Loft'
  touchLocalSavedRoom(roomId, name)
  if (!isLoggedIn) return
  if (lastApiTouch.id === roomId && lastApiTouch.name === name) return
  lastApiTouch.id = roomId
  lastApiTouch.name = name
  void postSavedRoom({ id: roomId, name }).catch(() => {})
}
