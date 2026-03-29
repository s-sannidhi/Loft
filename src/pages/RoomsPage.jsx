import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import {
  readLocalSavedRooms,
  removeLocalSavedRoom,
} from '../lib/localSavedRooms'
import {
  deleteSavedRoom,
  fetchSavedRooms,
} from '../lib/socialApi'

function formatVisited(ts) {
  if (!ts) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

function roleLabel(role) {
  if (role === 'owner') return 'You own'
  if (role === 'shared') return 'Shared with you'
  return 'From link'
}

function RoomsPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState('')

  const load = useCallback(async () => {
    setError('')
    if (user) {
      try {
        const data = await fetchSavedRooms()
        setRooms(
          (data?.rooms || []).map((r) => ({
            id: r.id,
            name: r.name || 'Loft',
            lastVisited: r.lastVisited || 0,
            role: r.role || 'link',
          }))
        )
      } catch (e) {
        setError(e.message)
        setRooms([])
      }
    } else {
      setRooms(
        readLocalSavedRooms().map((r) => ({
          ...r,
          role: 'link',
        }))
      )
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    setLoading(true)
    void load()
  }, [authLoading, load])

  async function handleRemove(id) {
    setRemovingId(id)
    setError('')
    try {
      if (user) {
        await deleteSavedRoom(id)
      } else {
        removeLocalSavedRoom(id)
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setRemovingId('')
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink/70">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-parchment">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        <h1 className="text-3xl font-semibold text-ink">Your rooms</h1>
        <p className="mt-2 text-sm text-ink/70">
          {user
            ? 'Rooms open here are saved to your account. Removing one only hides it from this list—the share link still works for anyone who has it.'
            : 'Rooms you open are saved on this browser. Log in to sync them across devices.'}
        </p>

        {error ? (
          <p className="mt-4 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/watch')}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-cream shadow-cafe hover:brightness-110"
          >
            Open or create a room
          </button>
          {!user ? (
            <Link
              to="/login"
              className="rounded-xl border border-mutedline bg-cream px-5 py-2.5 text-sm font-semibold text-ink hover:bg-card"
            >
              Log in to sync rooms
            </Link>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-10 text-sm text-ink/60">Loading rooms…</p>
        ) : rooms.length === 0 ? (
          <p className="mt-10 text-sm text-ink/60">
            No rooms yet. Create one from the watchlist or open an invite link—
            it will show up here.
          </p>
        ) : (
          <ul className="mt-10 space-y-3">
            {rooms.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mutedline bg-card px-4 py-3 shadow-cafe"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/watch?room=${encodeURIComponent(r.id)}`}
                    className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:text-ink"
                  >
                    {r.name}
                  </Link>
                  <p className="meta-font mt-0.5 truncate text-xs text-ink/50">
                    <span className="font-medium text-ink/60">{roleLabel(r.role)}</span>
                    {' · '}
                    {r.id}
                    {r.lastVisited ? ` · ${formatVisited(r.lastVisited)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removingId === r.id}
                  onClick={() => handleRemove(r.id)}
                  className="shrink-0 text-sm text-ink/55 hover:text-ink disabled:opacity-50"
                >
                  {removingId === r.id ? 'Removing…' : 'Remove from list'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

export default RoomsPage
