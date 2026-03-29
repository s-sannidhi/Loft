import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import { HANDLE_RULES_TEXT, validateStrictUsername } from '../lib/usernameValidate'
import {
  fetchPublicProfile,
  fetchPublicWatched,
  mediaUrl,
  setStoredToken,
  updateProfile,
  uploadAvatar,
} from '../lib/socialApi'

function ProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [profile, setProfile] = useState(null)
  const [watched, setWatched] = useState([])
  const [error, setError] = useState('')
  const [editDisplay, setEditDisplay] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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
          setEditUsername(p.username || '')
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
      const body = {
        displayName: editDisplay.trim(),
        avatarUrl: editAvatar.trim(),
      }
      if (editUsername.trim() !== profile.username) {
        const vu = validateStrictUsername(editUsername)
        if (!vu.ok) {
          setError(vu.error)
          return
        }
        body.username = vu.username
      }
      const data = await updateProfile(body)
      if (data.token) setStoredToken(data.token)
      setSaveMsg(
        data.token
          ? 'Saved — your profile link changed if you updated your handle.'
          : 'Saved.'
      )
      void refresh()
      const nextName = data.username || profile.username
      if (data.username && data.username !== username) {
        navigate(`/u/${data.username}`, { replace: true })
      } else {
        const p = await fetchPublicProfile(nextName)
        setProfile(p)
        setEditUsername(p.username || '')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function copyProfileUrl() {
    if (!profile?.username) return
    const url = `${window.location.origin}/u/${profile.username}`
    try {
      await navigator.clipboard.writeText(url)
      setSaveMsg('Profile link copied.')
      window.setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setError('Could not copy link')
    }
  }

  async function copyHandle() {
    if (!profile?.username) return
    try {
      await navigator.clipboard.writeText(`@${profile.username}`)
      setSaveMsg('@handle copied.')
      window.setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setError('Could not copy handle')
    }
  }

  async function handleAvatarFileInput(e) {
    const file = e.target.files?.[0]
    const input = e.target
    if (!file) return
    setUploadingAvatar(true)
    setSaveMsg('')
    setError('')
    try {
      const data = await uploadAvatar(file)
      if (data?.avatarUrl) setEditAvatar(data.avatarUrl)
      setSaveMsg('Photo updated.')
      void refresh()
      const p = await fetchPublicProfile(username)
      setProfile(p)
    } catch (err) {
      setError(err.message)
    } finally {
      input.value = ''
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        {error ? (
          <p className="text-red-800">{error}</p>
        ) : profile ? (
          <>
            <div className="flex flex-wrap items-start gap-4">
              {profile.avatarUrl ? (
                <img
                  src={mediaUrl(profile.avatarUrl)}
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
                  <span className="text-ink/75">Handle (@username)</span>
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
                    autoComplete="username"
                  />
                  <p className="meta-font mt-1 text-xs text-ink/55">{HANDLE_RULES_TEXT}</p>
                </label>
                <label className="block text-sm">
                  <span className="text-ink/75">Display name</span>
                  <input
                    value={editDisplay}
                    onChange={(e) => setEditDisplay(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyProfileUrl()}
                    className="rounded-lg border border-mutedline bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:bg-card"
                  >
                    Copy profile link
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyHandle()}
                    className="rounded-lg border border-mutedline bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:bg-card"
                  >
                    Copy @handle
                  </button>
                </div>
                <div className="text-sm">
                  <span className="text-ink/75">Profile photo</span>
                  <p className="meta-font mt-1 text-xs text-ink/55">
                    Pick a file — it uploads right away (no second step).
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label
                      className={`inline-flex cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-cream shadow-cafe hover:brightness-110 ${
                        uploadingAvatar ? 'pointer-events-none opacity-70' : ''
                      }`}
                    >
                      {uploadingAvatar ? 'Uploading…' : 'Choose photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingAvatar}
                        onChange={handleAvatarFileInput}
                      />
                    </label>
                    <span className="meta-font text-xs text-ink/50">
                      JPEG, PNG, WebP, or GIF · max 2&nbsp;MB
                    </span>
                  </div>
                </div>
                <label className="block text-sm">
                  <span className="text-ink/75">Or paste an image URL</span>
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
