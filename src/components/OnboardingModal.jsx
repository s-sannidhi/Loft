import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { updateProfile, uploadAvatar } from '../lib/socialApi'

function OnboardingModal() {
  const { user, refresh } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setDisplayName((user.displayName || user.username || '').trim())
    }
  }, [user])

  if (!user || user.onboardingComplete !== false) {
    return null
  }

  async function handleFinish(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (avatarFile) {
        await uploadAvatar(avatarFile)
      }
      const name = displayName.trim() || user.username
      await updateProfile({
        displayName: name,
        onboardingComplete: true,
      })
      await refresh()
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="absolute inset-0 bg-scrim-fade-light" aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-mutedline border-l-4 border-l-honey bg-card p-6 shadow-cafe-lg">
        <h2 id="onboarding-title" className="text-xl font-semibold text-ink">
          Welcome to Loft
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/80">
          Your <strong className="font-medium text-ink">profile shelf</strong> combines titles
          from every room you sync—each loft can have different shows and films without
          overwriting the others.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Find <Link className="font-medium text-accent underline" to="/rooms">Rooms</Link> and{' '}
          <Link className="font-medium text-accent underline" to="/friends">Friends</Link> in the
          header anytime.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleFinish}>
          <div>
            <label htmlFor="onboarding-display" className="meta-font text-xs font-medium text-ink/70">
              Display name
            </label>
            <input
              id="onboarding-display"
              type="text"
              value={displayName}
              onChange={(ev) => setDisplayName(ev.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-xl border border-mutedline bg-parchment px-3 py-2 text-sm text-ink focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
              autoComplete="nickname"
            />
          </div>
          <div>
            <label htmlFor="onboarding-avatar" className="meta-font text-xs font-medium text-ink/70">
              Profile photo (optional)
            </label>
            <input
              id="onboarding-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(ev) => {
                const f = ev.target.files?.[0]
                setAvatarFile(f || null)
              }}
              className="mt-1 block w-full text-sm text-ink/80 file:mr-3 file:rounded-lg file:border-0 file:bg-cream file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-cafe hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Finish'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default OnboardingModal
