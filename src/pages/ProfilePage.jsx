import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/useAuth'
import {
  fetchPublicProfile,
  fetchPublicWatched,
  updateProfile,
} from '../lib/socialApi'

function ProfilePage() {
  const { username } = useParams()
  const { user, refresh } = useAuth()
  const [profile, setProfile] = useState(null)
  const [watched, setWatched] = useState([])
  const [error, setError] = useState('')
  const [editDisplay, setEditDisplay] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      try {
        const [p, w] = await Promise.all([
          fetchPublicProfile(username),
          fetchPublicWatched(username),
        ])
        if (!cancelled) {
          setProfile(p)
          setEditDisplay(p.displayName || p.username || '')
          setEditAvatar(p.avatarUrl || '')
          setWatched(w?.items || [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [username])

  const isSelf = user && profile && user.username === profile.username

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaveMsg('')
    setError('')
    try {
      await updateProfile({
        displayName: editDisplay.trim(),
        avatarUrl: editAvatar.trim(),
      })
      setSaveMsg('Saved.')
      void refresh()
      const p = await fetchPublicProfile(username)
      setProfile(p)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-mutedline bg-parchment px-5 py-4 lg:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-bold text-accent">
              Loft
            </Link>
            <Link to="/watch" className="text-sm text-ink/70 hover:text-ink">
              Watchlist
            </Link>
            <Link to="/friends" className="text-sm text-ink/70 hover:text-ink">
              Friends
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        {error ? (
          <p className="text-red-800">{error}</p>
        ) : profile ? (
          <>
            <div className="flex flex-wrap items-start gap-4">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-24 w-24 rounded-2xl border border-mutedline object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-mutedline bg-card text-2xl font-bold text-accent">
                  {(profile.displayName || profile.username || '?')
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-semibold text-ink">
                  {profile.displayName || profile.username}
                </h1>
                <p className="meta-font text-sm text-ink/60">@{profile.username}</p>
              </div>
            </div>

            {isSelf ? (
              <form
                onSubmit={handleSaveProfile}
                className="mt-8 max-w-md space-y-3 rounded-xl border border-mutedline bg-card p-4 shadow-cafe"
              >
                <p className="text-sm font-medium text-ink">Edit your profile</p>
                <label className="block text-sm">
                  <span className="text-ink/75">Display name</span>
                  <input
                    value={editDisplay}
                    onChange={(e) => setEditDisplay(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-ink/75">Avatar image URL</span>
                  <input
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    placeholder="https://…"
                    className="mt-1 w-full rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-cream hover:brightness-110"
                >
                  Save profile
                </button>
                {saveMsg ? (
                  <p className="text-sm text-sage">{saveMsg}</p>
                ) : null}
              </form>
            ) : null}

            <section className="mt-12">
              <h2 className="text-lg font-semibold text-ink">Shelf</h2>
              <p className="mt-1 text-sm text-ink/65">
                Titles synced from their watchlist (may be empty if they have not
                synced yet).
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {watched.length === 0 ? (
                  <li className="text-sm text-ink/60">Nothing on the shelf yet.</li>
                ) : (
                  watched.map((item) => (
                    <li
                      key={item.imdbID}
                      className="flex gap-3 rounded-xl border border-mutedline bg-card p-3 shadow-cafe"
                    >
                      {item.poster && item.poster !== 'N/A' ? (
                        <img
                          src={item.poster}
                          alt=""
                          className="h-20 w-14 shrink-0 rounded object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-medium text-ink line-clamp-2">{item.title}</p>
                        <p className="meta-font text-xs text-ink/55">{item.type}</p>
                        {item.completed ? (
                          <span className="mt-1 inline-block rounded bg-honey/25 px-1.5 py-0.5 text-[10px] font-medium text-ink">
                            Completed
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        ) : (
          <p className="text-ink/70">Loading profile…</p>
        )}
      </main>
    </div>
  )
}

export default ProfilePage
