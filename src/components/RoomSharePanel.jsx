import { useEffect, useState } from 'react'
import {
  addRoomShare,
  fetchRoomShareOptions,
  removeRoomShare,
} from '../lib/socialApi'
import { validateStrictUsername } from '../lib/usernameValidate'

function RoomSharePanel({ roomId, open, onClose, onUpdated }) {
  const [friends, setFriends] = useState([])
  const [shared, setShared] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [handleInput, setHandleInput] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !roomId) return
    let cancelled = false
    async function load() {
      setError('')
      try {
        const data = await fetchRoomShareOptions(roomId)
        if (!cancelled) {
          setFriends(data.friends || [])
          setShared(data.sharedUsers || [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, roomId])

  useEffect(() => {
    if (!open) {
      setHandleInput('')
      setSuccessMsg('')
    }
  }, [open])

  async function reload() {
    const data = await fetchRoomShareOptions(roomId)
    setFriends(data.friends || [])
    setShared(data.sharedUsers || [])
  }

  const sharedIds = new Set(shared.map((s) => s.userId))

  async function handleAdd(username) {
    setBusy(true)
    setError('')
    setSuccessMsg('')
    try {
      await addRoomShare(roomId, username)
      await reload()
      onUpdated?.()
      setSuccessMsg(`Added @${username}`)
      window.setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(targetUserId, username) {
    setBusy(true)
    setError('')
    setSuccessMsg('')
    try {
      await removeRoomShare(roomId, targetUserId)
      await reload()
      onUpdated?.()
      setSuccessMsg(username ? `Removed @${username}` : 'Removed access')
      window.setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddByHandle(e) {
    e.preventDefault()
    const v = validateStrictUsername(handleInput)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setBusy(true)
    setError('')
    setSuccessMsg('')
    try {
      await addRoomShare(roomId, v.username)
      await reload()
      onUpdated?.()
      setHandleInput('')
      setSuccessMsg(`Added @${v.username}`)
      window.setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const addableFriends = friends.filter((f) => f.userId && !sharedIds.has(f.userId))

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-share-title"
    >
      <button
        type="button"
        className="animate-modal-backdrop absolute inset-0 bg-scrim-fade-light"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-mutedline border-l-4 border-l-honey bg-card p-5 shadow-cafe-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 id="room-share-title" className="text-lg font-semibold text-ink">
            Share with friends
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink/55 hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="meta-font mt-2 text-xs text-ink/60">
          Friends you add get this room on their <strong>Your rooms</strong> list—no
          invite link needed.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        {successMsg ? (
          <p className="mt-3 text-sm text-sage" role="status">
            {successMsg}
          </p>
        ) : null}

        <section className="mt-5">
          <h3 className="text-sm font-medium text-ink">Add by handle</h3>
          <form onSubmit={handleAddByHandle} className="mt-2 flex gap-2">
            <input
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              placeholder="@username"
              className="min-w-0 flex-1 rounded-lg border border-mutedline bg-cream px-3 py-2 text-sm text-ink"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              Add
            </button>
          </form>
          <p className="meta-font mt-1 text-[11px] text-ink/50">
            They get this room on <strong>Your rooms</strong>—no link required.
          </p>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-medium text-ink">Add from friends</h3>
          {addableFriends.length === 0 ? (
            <p className="mt-2 text-sm text-ink/55">
              No friends left to add (or you have no friends yet).
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {addableFriends.map((f) => (
                <li
                  key={f.userId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-mutedline bg-cream px-3 py-2"
                >
                  <span className="text-sm text-ink">
                    {f.displayName || f.username}
                    <span className="meta-font text-ink/50"> @{f.username}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAdd(f.username)}
                    className="shrink-0 text-sm font-medium text-accent underline disabled:opacity-50"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-medium text-ink">Shared with</h3>
          {shared.length === 0 ? (
            <p className="mt-2 text-sm text-ink/55">Nobody yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {shared.map((s) => (
                <li
                  key={s.userId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-mutedline bg-cream px-3 py-2"
                >
                  <span className="text-sm text-ink">
                    {s.displayName || s.username}
                    <span className="meta-font text-ink/50"> @{s.username}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemove(s.userId, s.username)}
                    className="shrink-0 text-sm text-ink/55 hover:text-ink disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default RoomSharePanel
