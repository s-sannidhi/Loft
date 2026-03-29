import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/useAuth'

const COPY_CONFIRM_MS = 2200

function TopBar({
  roomName,
  movieCount,
  roomId,
  onSaveRoomName,
  onCopyInvite,
  onSyncShelf,
}) {
  const { user, logout } = useAuth()
  const [draftName, setDraftName] = useState(roomName)
  const [linkCopied, setLinkCopied] = useState(false)
  const copyResetRef = useRef(null)

  useEffect(() => {
    setDraftName(roomName)
  }, [roomName])

  useEffect(() => {
    return () => {
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
    }
  }, [])

  async function handleCopyInviteClick() {
    const ok = await onCopyInvite()
    if (!ok) return
    setLinkCopied(true)
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
    copyResetRef.current = window.setTimeout(() => {
      setLinkCopied(false)
      copyResetRef.current = null
    }, COPY_CONFIRM_MS)
  }

  function commitName() {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === roomName) {
      setDraftName(roomName)
      return
    }
    onSaveRoomName(trimmed)
  }

  return (
    <header className="sticky top-0 z-10 border-b border-mutedline bg-parchment">
      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-4 md:grid-cols-[auto_1fr_auto] lg:px-10">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link
            to="/"
            className="rounded-xl border border-mutedline border-l-[6px] border-l-honey bg-cream px-4 py-2 text-2xl font-bold leading-none tracking-tight text-ink shadow-cafe md:px-5 md:py-2.5 md:text-4xl"
            aria-label="Loft home"
          >
            <span className="bg-gradient-to-br from-accent via-ink to-accent bg-clip-text text-transparent">
              Loft
            </span>
          </Link>
          <nav className="hidden items-center gap-3 text-sm sm:flex">
            <Link to="/watch" className="text-ink/70 hover:text-ink">
              Watch
            </Link>
            {user ? (
              <>
                <Link to="/friends" className="text-ink/70 hover:text-ink">
                  Friends
                </Link>
                <Link
                  to={`/u/${user.username}`}
                  className="text-ink/70 hover:text-ink"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="text-ink/55 hover:text-ink"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-ink/70 hover:text-ink">
                  Log in
                </Link>
                <Link to="/signup" className="font-medium text-accent">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          className="min-w-0 w-full border-0 border-b-2 border-mutedline bg-transparent py-1.5 text-lg font-medium text-ink placeholder:text-ink/45 focus:border-sage focus:outline-none focus:ring-0 md:text-xl"
          aria-label="Room name"
        />
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <ThemeToggle />
          {onSyncShelf ? (
            <button
              type="button"
              onClick={onSyncShelf}
              className="meta-font rounded-lg border border-sage/50 bg-cream px-2 py-1.5 text-[11px] font-medium text-ink hover:bg-card md:text-xs"
              title="Copy this room’s titles to your public shelf"
            >
              Sync shelf
            </button>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-ink/65">
            <span className="meta-font">{movieCount} titles</span>
            <span className="text-sky/80" aria-hidden>
              ·
            </span>
            <span
              className="meta-font max-w-[220px] truncate text-xs text-ink/50"
              title={roomId}
            >
              room {roomId}
            </span>
          </div>
          <div className="relative flex shrink-0 flex-col items-end">
            <button
              type="button"
              onClick={handleCopyInviteClick}
              className={`text-sm font-semibold underline underline-offset-[5px] transition md:text-base ${
                linkCopied
                  ? 'text-sage decoration-sage/50'
                  : 'text-honey decoration-honey/70 hover:text-ink hover:decoration-ink/50'
              }`}
            >
              {linkCopied ? 'Copied!' : 'Copy invite link'}
            </button>
            {linkCopied ? (
              <span className="meta-font mt-0.5 text-[11px] text-sage md:text-xs">
                Link copied to clipboard
              </span>
            ) : null}
            <span className="sr-only" aria-live="polite">
              {linkCopied ? 'Invite link copied to clipboard.' : ''}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopBar
