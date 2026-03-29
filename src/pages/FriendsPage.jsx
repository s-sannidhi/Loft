import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import {
  fetchFriends,
  respondFriendRequest,
  sendFriendRequest,
} from '../lib/socialApi'

function FriendsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const f = await fetchFriends()
      setData(f)
    } catch (e) {
      setError(e.message)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSend(e) {
    e.preventDefault()
    if (!username.trim()) return
    setBusy(true)
    setError('')
    try {
      await sendFriendRequest(username.trim())
      setUsername('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function respond(id, accept) {
    setBusy(true)
    setError('')
    try {
      await respondFriendRequest(id, accept)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink/70">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-parchment px-5 py-16 text-center">
        <p className="text-ink/80">Log in to manage friends.</p>
        <Link to="/login" className="mt-4 inline-block font-medium text-accent underline">
          Log in
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-parchment">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        <h1 className="text-3xl font-semibold text-ink">Friends</h1>
        <form onSubmit={handleSend} className="mt-8 flex flex-wrap gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="min-w-[12rem] flex-1 rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
          >
            Send request
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-ink">Incoming</h2>
          <ul className="mt-3 space-y-2">
            {(data?.incoming || []).length === 0 ? (
              <li className="text-sm text-ink/60">No pending requests.</li>
            ) : (
              data.incoming.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-mutedline bg-card px-3 py-2"
                >
                  <span className="text-sm text-ink">
                    <span className="font-medium">{r.from}</span>
                    {r.displayName ? (
                      <span className="text-ink/60"> · {r.displayName}</span>
                    ) : null}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(r.id, true)}
                      className="text-sm font-medium text-sage underline"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(r.id, false)}
                      className="text-sm text-ink/60"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-ink">Your friends</h2>
          <ul className="mt-3 space-y-2">
            {(data?.friends || []).length === 0 ? (
              <li className="text-sm text-ink/60">No friends yet.</li>
            ) : (
              data.friends.map((f) => (
                <li key={f.username}>
                  <Link
                    to={`/u/${f.username}`}
                    className="text-accent underline hover:text-ink"
                  >
                    {f.displayName || f.username}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default FriendsPage
