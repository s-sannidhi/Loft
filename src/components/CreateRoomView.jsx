import { Link } from 'react-router-dom'
import SiteHeader from './SiteHeader'

function CreateRoomView({ onCreate, creating }) {
  return (
    <div className="min-h-screen bg-parchment">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        <p className="text-sm font-medium uppercase tracking-wide text-honey">
          New watch room
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Start a watch room
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink/80">
          Create a shared list everyone can open from one link. Add movies and
          series, track progress together, and sync your shelf to your profile
          when you are logged in.
        </p>

        <div className="mt-10 rounded-2xl border border-mutedline border-l-4 border-l-sage bg-card p-6 shadow-cafe-lg md:p-8">
          <h2 className="text-sm font-semibold text-ink">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-ink/80">
            <li className="flex gap-3">
              <span className="meta-font shrink-0 font-medium text-accent">1</span>
              <span>
                <strong className="text-ink">Create</strong> — we give your room a
                private link you can copy anytime from the watchlist.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="meta-font shrink-0 font-medium text-accent">2</span>
              <span>
                <strong className="text-ink">Add titles</strong> — search with OMDB
                and build the shelf; changes save for everyone in the room.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="meta-font shrink-0 font-medium text-accent">3</span>
              <span>
                <strong className="text-ink">Optional</strong> — log in to sync your
                public shelf, share the room with friends from the watch bar, and
                keep rooms under <strong className="text-ink">Your rooms</strong>.
              </span>
            </li>
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              aria-busy={creating}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-cream shadow-cafe hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create a room'}
            </button>
            <Link
              to="/rooms"
              className="rounded-xl border border-mutedline bg-cream px-6 py-3 text-sm font-semibold text-ink hover:bg-card"
            >
              Your rooms
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default CreateRoomView
