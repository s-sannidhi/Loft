import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import RoomToolbar from './RoomToolbar'
import { useAuth } from '../context/useAuth'

function TopBar({
  roomName,
  movieCount,
  roomId,
  onSaveRoomName,
  onCopyInvite,
  onSyncShelf,
  onOpenShare,
  showShareRoom,
  onOpenMembers,
}) {
  const { user, logout } = useAuth()
  const [draftName, setDraftName] = useState(roomName)

  useEffect(() => {
    setDraftName(roomName)
  }, [roomName])

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
      <div className="mx-auto w-full max-w-[90rem] px-5 lg:px-10">
        <div className="grid grid-cols-1 items-center gap-x-6 gap-y-3 py-4 md:grid-cols-[auto_1fr_auto]">
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
              <Link to="/rooms" className="text-ink/70 hover:text-ink">
                Rooms
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
          <div className="flex items-center justify-end">
            <ThemeToggle />
          </div>
        </div>
        <RoomToolbar
          roomId={roomId}
          movieCount={movieCount}
          onCopyInvite={onCopyInvite}
          onOpenMembers={onOpenMembers}
          onOpenShare={onOpenShare}
          showShareRoom={showShareRoom}
          onSyncShelf={onSyncShelf}
        />
      </div>
    </header>
  )
}

export default TopBar
