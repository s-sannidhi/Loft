import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/useAuth'

/**
 * Shared app chrome: Loft badge, primary nav, auth, theme toggle.
 * Inner width matches watchlist TopBar (max-w-[90rem]).
 */
function SiteHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="border-b border-mutedline bg-parchment">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-10">
        <Link
          to="/"
          className="rounded-xl border border-mutedline border-l-[6px] border-l-honey bg-cream px-3 py-1.5 text-xl font-bold leading-none shadow-cafe md:px-4 md:py-2 md:text-2xl"
          aria-label="Loft home"
        >
          <span className="bg-gradient-to-br from-accent via-ink to-accent bg-clip-text text-transparent">
            Loft
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/watch"
            className="text-sm font-medium text-accent underline decoration-accent/50 underline-offset-4 hover:text-ink"
          >
            Watchlist
          </Link>
          <Link to="/rooms" className="text-sm font-medium text-ink/80 hover:text-ink">
            Your rooms
          </Link>
          {user ? (
            <>
              <Link to="/friends" className="text-sm font-medium text-ink/80 hover:text-ink">
                Friends
              </Link>
              <Link
                to={`/u/${user.username}`}
                className="text-sm font-medium text-ink/80 hover:text-ink"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={logout}
                className="text-sm font-medium text-ink/70 hover:text-ink"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-ink/80 hover:text-ink">
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-lg border border-mutedline bg-cream px-3 py-1.5 text-sm font-medium text-ink hover:bg-card"
              >
                Sign up
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
